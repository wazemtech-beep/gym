import { withReadCache } from "@/lib/serverReadCache";
import { enqueueNotification } from "@/lib/notifications";
import { lockMember } from "@/lib/recordLocks";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  MembershipStatus,
  InvoiceStatus,
  DurationUnit,
  InvoiceItemType,
  InstallmentStatus,
  Role,
  Prisma,
  type Invoice,
} from "@prisma/client";
import { calculateMembershipEndDate, calculatePricingBreakdown } from "@/lib/pricing";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "MEMBERSHIP_ASSIGN_RENEW")) {
      return NextResponse.json(
        { success: false, error: "Membership assign karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { actionType, action } = body;
    const effectiveAction = actionType || action || "ASSIGN";

    const member = await prisma.gymMember.findFirst({
      where: { OR: [{ id }, { memberId: id }] },
      include: {
        memberships: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    // 1. FREEZE ACTION
    if (effectiveAction === "FREEZE") {
      // Requirement 14.4: "Freeze requests: Owner approval required"
      if (current.user.role !== Role.OWNER) {
        return NextResponse.json(
          { success: false, error: "Membership freeze karne ka ikhtiyar sirf Owner ke paas hai." },
          { status: 403 }
        );
      }

      const { membershipId, freezeReason, freezeDays, plannedResumeDate } = body;
      const settings = await prisma.gymSettings.findFirst();
      const maxDays = settings?.maxFreezeDays || 30;

      if (freezeDays && parseInt(freezeDays, 10) > maxDays) {
        return NextResponse.json(
          {
            success: false,
            error: `Freeze policy ke mutabiq zyada se zyada ${maxDays} din freeze allow hai (Requested: ${freezeDays} din).`,
          },
          { status: 400 }
        );
      }

      const freezeStart = body.freezeStartDate ? new Date(`${String(body.freezeStartDate).slice(0, 10)}T00:00:00+05:00`) : new Date();
      const resumeDate = plannedResumeDate ? new Date(`${String(plannedResumeDate).slice(0, 10)}T00:00:00+05:00`) : freezeDays ? new Date(freezeStart.getTime() + Number(freezeDays) * 86400000) : null;
      const target = await prisma.membership.findFirst({ where: { id: membershipId, gymMemberId: member.id, status: "ACTIVE", frozenAt: null } });
      if (!target || !Number.isFinite(freezeStart.getTime()) || freezeStart < target.startDate || freezeStart > target.endDate || (resumeDate && (!Number.isFinite(resumeDate.getTime()) || resumeDate <= freezeStart || (resumeDate.getTime() - freezeStart.getTime()) / 86400000 > maxDays))) return NextResponse.json({ success: false, error: "Invalid membership or freeze period." }, { status: 400 });

      const frozen = await prisma.membership.update({
        where: { id: membershipId, gymMemberId: member.id, status: "ACTIVE", frozenAt: null },
        data: {
          status: freezeStart > new Date() ? MembershipStatus.ACTIVE : MembershipStatus.FROZEN,
          frozenAt: freezeStart,
          freezeResumeDate: resumeDate,
          freezeReason: freezeReason || "Member requested freeze",
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "MEMBERSHIP_FROZEN",
          entityType: "GYM_MEMBER",
          entityId: member.id,
          details: JSON.stringify({
            memberId: member.memberId,
            membershipId,
            planName: frozen.planName,
            freezeReason,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${frozen.planName} kamiyabi se freeze kar di gayi hai.`,
        membership: frozen,
      });
    }

    // 2. UNFREEZE ACTION
    if (effectiveAction === "UNFREEZE") {
      if (current.user.role !== Role.OWNER) return NextResponse.json({ success: false, error: "Only owner can resume membership." }, { status: 403 });
      const { membershipId } = body;
      const targetMembership = await prisma.membership.findFirst({
        where: { id: membershipId, gymMemberId: member.id },
      });

      if (!targetMembership || targetMembership.status !== MembershipStatus.FROZEN) {
        return NextResponse.json(
          { success: false, error: "Frozen membership nahi mili." },
          { status: 400 }
        );
      }

      // Calculate days frozen and extend end date accordingly (Requirement Point 2)
      const frozenDays = targetMembership.frozenAt
        ? Math.max(1, Math.ceil((Date.now() - new Date(targetMembership.frozenAt).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const extendedEndDate = new Date(targetMembership.endDate);
      extendedEndDate.setDate(extendedEndDate.getDate() + frozenDays);

      const unfreeze = await prisma.$transaction(async tx => {
        await lockMember(tx, member.id);
        const live = await tx.membership.findUnique({ where: { id: targetMembership.id } });
        if (!live || live.status !== "FROZEN" || live.frozenAt?.getTime() !== targetMembership.frozenAt?.getTime()) throw new Error("Membership changed. Refresh before resuming.");
        const renewals = await tx.membership.findMany({ where: { gymMemberId: member.id, status: "UPCOMING", startDate: { gt: targetMembership.endDate } } });
        for (const renewal of renewals) await tx.membership.update({ where: { id: renewal.id }, data: { startDate: new Date(renewal.startDate.getTime() + frozenDays * 86400000), endDate: new Date(renewal.endDate.getTime() + frozenDays * 86400000) } });
        return tx.membership.update({
        where: { id: membershipId, gymMemberId: member.id },
        data: {
          status: MembershipStatus.ACTIVE,
          frozenAt: null,
          freezeResumeDate: null,
          endDate: extendedEndDate,
          notes: `${targetMembership.notes || ""} [Unfrozen after ${frozenDays} days; validity extended to ${extendedEndDate.toLocaleDateString()}]`.trim(),
        },
      });
      });

      await prisma.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "MEMBERSHIP_UNFROZEN",
          entityType: "GYM_MEMBER",
          entityId: member.id,
          details: JSON.stringify({
            memberId: member.memberId,
            planName: unfreeze.planName,
            frozenDays,
            newEndDate: extendedEndDate,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${unfreeze.planName} unfreeze ho gayi aur ${frozenDays} din ki validity extend kar di gayi hai!`,
        membership: unfreeze,
      });
    }

    // 3. CANCEL ACTION (Owner only approval)
    if (effectiveAction === "CANCEL") {
      if (current.user.role !== Role.OWNER) {
        return NextResponse.json(
          { success: false, error: "Membership cancel karne ka ikhtiyar sirf Owner ke paas hai." },
          { status: 403 }
        );
      }

      const { membershipId, cancellationReason, financialTreatment = "NONE" } = body;

      const targetMembership = await prisma.membership.findFirst({
        where: { id: membershipId, gymMemberId: member.id },
        include: { invoices: true },
      });

      if (!targetMembership) {
        return NextResponse.json({ success: false, error: "Membership nahi mili." }, { status: 404 });
      }

      if (targetMembership.gymMemberId !== member.id) {
        return NextResponse.json(
          { success: false, error: "Yeh membership is member se mutalliq nahi hai." },
          { status: 400 }
        );
      }

      let creditAmount = 0;
      let actualPaid = 0;
      let remainingDays = 0;
      if (financialTreatment === "CREDIT_ADVANCE" && targetMembership.feeAmount > 0) {
        const startMs = new Date(targetMembership.startDate).getTime();
        const endMs = new Date(targetMembership.endDate).getTime();
        const nowMs = Date.now();

        const totalDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
        remainingDays = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));

        // Calculate credit based on what was ACTUALLY paid, not arbitrary plan fee
        actualPaid = targetMembership.invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
        const eligibleAmount = Math.min(targetMembership.feeAmount, actualPaid);

        creditAmount = Math.round(Math.min(1, remainingDays / totalDays) * eligibleAmount);
      }

      // Single atomic transaction for member balance, credit creation, and cancellation
      const cancelled = await prisma.$transaction(async (tx) => {
        await lockMember(tx, member.id);
        const live = await tx.membership.findUniqueOrThrow({ where: { id: targetMembership.id }, include: { invoices: true } });
        if (live.status === "CANCELLED") throw new Error("Membership is already cancelled.");
        const livePaid = live.invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
        if (livePaid !== actualPaid && financialTreatment === "CREDIT_ADVANCE") throw new Error("Payments changed during cancellation. Refresh and review the recalculated credit.");
        if (creditAmount > 0) {
          await tx.gymMember.update({
            where: { id: member.id },
            data: {
              advanceBalance: { increment: creditAmount },
            },
          });

          await tx.advanceCredit.create({
            data: {
              gymMemberId: member.id,
              amount: creditAmount,
              sourceType: "CANCELLATION_CREDIT",
              notes: `Pro-rata Cancellation Credit for ${targetMembership.planName} (Bache din: ${remainingDays || 0}, Ada shuda: Rs. ${actualPaid})`,
            },
          });
        }

        const can = await tx.membership.update({
          where: { id: membershipId, gymMemberId: member.id },
          data: {
            status: MembershipStatus.CANCELLED,
            notes: `Cancelled: ${cancellationReason || "Owner cancelled"} [Financial Treatment: ${financialTreatment}${creditAmount > 0 ? `, Advance Credited: Rs. ${creditAmount}` : ""}]`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "MEMBERSHIP_CANCELLED",
            entityType: "GYM_MEMBER",
            entityId: member.id,
            details: JSON.stringify({
              memberId: member.memberId,
              planName: can.planName,
              reason: cancellationReason,
              financialTreatment,
              actualPaid,
              creditAmount,
            }),
          },
        });

        return can;
      });

      return NextResponse.json({
        success: true,
        message: `${cancelled.planName} cancel kar di gayi.${creditAmount > 0 ? ` Rs. ${creditAmount.toLocaleString()} member ke advance credit balance mein jama ho gaye.` : ""}`,
        membership: cancelled,
        creditedAdvance: creditAmount,
      });
    }

    // 4. ASSIGN / RENEW ACTION (Requirement Point 2, 4, 5, 6, 7, 13)
    const {
      feePlanId,
      planName,
      durationValue = 1,
      durationUnit = "CALENDAR_MONTHS",
      startDate,
      membershipFee,
      applyAdmissionFee = false,
      admissionFee = 0,
      admissionDiscountValue = 0,
      discountType = "NONE",
      discountValue = 0,
      discountReason,
      services,
      paymentTerms = "FULL",
      installments = [],
      createInvoice = true,
    } = body;

    let authoritativePlanName = planName ? String(planName).trim() : "";
    let authoritativeFee = parseFloat(membershipFee) || 0;
    let authoritativeAdmission = parseFloat(admissionFee) || 0;
    let durVal = parseInt(durationValue, 10) || 1;
    let durUnit = (durationUnit as DurationUnit) || "CALENDAR_MONTHS";
    let planServices = services ? String(services).trim() : "Gym Access, Locker";

    // Requirement 9 (Server Pricing): If feePlanId provided, load authoritative values from FeePlan record
    if (feePlanId) {
      const dbPlan = await prisma.feePlan.findUnique({
        where: { id: feePlanId },
      });
      if (!dbPlan || !dbPlan.isActive) {
        return NextResponse.json(
          { success: false, error: "Muntakhib fee plan active nahi hai ya mojood nahi hai." },
          { status: 400 }
        );
      }
      authoritativePlanName = dbPlan.name;
      authoritativeFee = dbPlan.membershipFee;
      authoritativeAdmission = dbPlan.admissionFee;
      durVal = dbPlan.durationValue;
      durUnit = dbPlan.durationUnit;
      if (dbPlan.includedServices) {
        planServices = dbPlan.includedServices;
      }
    }

    if (!authoritativePlanName || !startDate) {
      return NextResponse.json(
        { success: false, error: "Plan ka naam aur start date lazmi hain." },
        { status: 400 }
      );
    }

    const start = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(startDate)) ? `${startDate}T00:00:00+05:00` : startDate);
    if (!Number.isFinite(start.getTime()) || !Number.isInteger(durVal) || durVal < 1 || !Object.values(DurationUnit).includes(durUnit) || !Number.isFinite(authoritativeFee) || authoritativeFee < 0 || !Number.isFinite(authoritativeAdmission) || authoritativeAdmission < 0) return NextResponse.json({ success: false, error: "Valid start date, duration aur non-negative fees chahiye." }, { status: 400 });
    const calculatedEnd = calculateMembershipEndDate(start, durVal, durUnit);

    const parsedAdmissionDiscount = parseFloat(admissionDiscountValue) || 0;
    const parsedDiscountValue = parseFloat(discountValue) || 0;
    if (!["NONE", "FIXED", "PERCENTAGE"].includes(discountType) || parsedDiscountValue < 0 || parsedAdmissionDiscount < 0 || !Number.isFinite(parsedDiscountValue) || !Number.isFinite(parsedAdmissionDiscount)) return NextResponse.json({ success: false, error: "Invalid discount details." }, { status: 400 });

    // Requirement 9 / Line 1144: Custom discount or admission waiver requires Owner authorization
    if (parsedDiscountValue > 0 || parsedAdmissionDiscount > 0) {
      if (current.user.role !== Role.OWNER) {
        return NextResponse.json(
          {
            success: false,
            error: "Custom discount ya admission fee waiver sirf Gym Owner approve kar sakta hai.",
          },
          { status: 403 }
        );
      }
      if (!discountReason || !String(discountReason).trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Discount ya admission waiver dene ke liye wajah (discountReason) batana lazmi hai.",
          },
          { status: 400 }
        );
      }
    }

    const previouslyAdmitted = member.admissionFeePreviouslyPaid || member.memberships.length > 0;
    if (applyAdmissionFee && previouslyAdmitted && (current.user.role !== Role.OWNER || body.rejoiningFeeApproved !== true || !String(body.rejoiningFeeReason || "").trim())) return NextResponse.json({ success: false, error: "Rejoining admission fees require owner approval and a reason. Ordinary renewals have no admission fee." }, { status: 403 });
    const breakdown = calculatePricingBreakdown({
      membershipFee: authoritativeFee,
      admissionFee: authoritativeAdmission,
      applyAdmissionFee: Boolean(applyAdmissionFee),
      discountType: discountType as any,
      discountValue: parsedDiscountValue,
      admissionDiscountValue: parsedAdmissionDiscount,
    });

    // Determine initial status based on start date
    const now = new Date();
    let initialStatus: MembershipStatus = MembershipStatus.ACTIVE;
    if (start > now) {
      initialStatus = MembershipStatus.UPCOMING;
    }

    // Overlapping period prevention (Point 2: "Same gym-access membership ke overlapping periods backend block karega")
    const activeOverlap = member.memberships.find(
      (m) =>
        (m.status === MembershipStatus.ACTIVE || m.status === MembershipStatus.UPCOMING || m.status === MembershipStatus.FROZEN) &&
        new Date(m.endDate) >= start &&
        new Date(m.startDate) <= calculatedEnd
    );

    if (activeOverlap) {
      return NextResponse.json(
        {
          success: false,
          error: `Member ki pehle se ${activeOverlap.status.toLowerCase()} membership '${activeOverlap.planName}' (${new Date(activeOverlap.startDate).toLocaleDateString()} se ${new Date(activeOverlap.endDate).toLocaleDateString()}) mojood hai. Overlapping roknay ke liye agla renewal period pichli expiry ke agle din start karein.`,
        },
        { status: 400 }
      );
    }

    // Validate installment schedule if installments allowed
    if (!["FULL", "INSTALLMENTS"].includes(paymentTerms) || !Array.isArray(installments) || installments.length > 24 || (paymentTerms === "INSTALLMENTS" && (!createInvoice || !installments.length || installments.some((inst: any) => !inst || !Number.isFinite(Number(inst.amount)) || Number(inst.amount) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(inst.dueDate) || !Number.isFinite(new Date(inst.dueDate).getTime()))))) return NextResponse.json({ success: false, error: "Installments ke liye invoice aur valid amount/due date wali schedule chahiye." }, { status: 400 });
    if (paymentTerms === "INSTALLMENTS" && installments.length > 0) {
      const installmentSum = installments.reduce((sum: number, inst: any) => sum + (parseFloat(inst.amount) || 0), 0);
      if (Math.abs(installmentSum - breakdown.totalPayable) > 1) {
        return NextResponse.json(
          {
            success: false,
            error: `Installments ka total (Rs. ${installmentSum.toLocaleString()}) total payable amount (Rs. ${breakdown.totalPayable.toLocaleString()}) ke barabar hona chahiye.`,
          },
          { status: 400 }
        );
      }
    }

    // Execute atomic transaction for Membership + Invoice + Line Items + Installments + AuditLog
    const invoiceSettings = await prisma.gymSettings.findFirst();
    const result = await prisma.$transaction(async (tx) => {
      await lockMember(tx, member.id);
      const overlap = await tx.membership.findFirst({ where: { gymMemberId: member.id, status: { in: [MembershipStatus.ACTIVE, MembershipStatus.UPCOMING, MembershipStatus.FROZEN] }, startDate: { lte: calculatedEnd }, endDate: { gte: start } } });
      if (overlap) throw new Error("Membership overlaps an existing period. Refresh and choose another start date.");
      // 1. Create Membership Record with snapshot terms
      const newMembership = await tx.membership.create({
        data: {
          gymMemberId: member.id,
          feePlanId: feePlanId || null,
          planName: authoritativePlanName,
          durationValue: durVal,
          durationUnit: durUnit,
          startDate: start,
          endDate: calculatedEnd,
          status: initialStatus,
          feeAmount: breakdown.membershipFee,
          admissionFeeCharged: breakdown.netAdmissionFee,
          discountApplied: breakdown.computedDiscount + breakdown.admissionDiscountValue,
          discountReason: discountReason ? String(discountReason).trim() : null,
          servicesSnapshot: planServices,
          notes: body.rejoiningFeeApproved ? `Rejoining fee approved by ${current.user.name}: ${String(body.rejoiningFeeReason || "").trim()}` : null,
        },
      });

      // 2. Optionally create Invoice
      let createdInvoice: Invoice | null = null;
      if (createInvoice && breakdown.totalPayable > 0) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('invoice-number'))`;
        const sequence = await tx.$queryRaw<Array<{ next: string }>>`SELECT (COALESCE(MAX(substring("invoiceNumber" from '^OXG-INV-([0-9]+)$')::bigint), 0) + 1)::text AS next FROM "Invoice"`;
        const invoiceNumber = `OXG-INV-${sequence[0].next.padStart(6, "0")}`;

        createdInvoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            gymMemberId: member.id,
            membershipId: newMembership.id,
            title: `${authoritativePlanName} Subscription`,
            totalAmount: breakdown.totalPayable,
            paidAmount: 0,
            balanceAmount: breakdown.totalPayable,
            issueDate: new Date(),
            dueDate: paymentTerms === "INSTALLMENTS" && installments.length > 0 ? new Date(installments[0].dueDate) : new Date(Date.now() + (invoiceSettings?.invoiceDueDays ?? 7) * 86400000),
            status: InvoiceStatus.UNPAID,
            notes: `Plan validity: ${start.toLocaleDateString()} to ${calculatedEnd.toLocaleDateString()}`,
          },
        });

        const invoiceId = createdInvoice.id;
        // 3. Create Line Items
        // a. Membership Fee line
        const lineItems: Prisma.InvoiceLineItemCreateManyInput[] = [{
            invoiceId,
            description: `${authoritativePlanName} (${durVal} ${durUnit.toLowerCase()})`,
            amount: breakdown.membershipFee,
            itemType: InvoiceItemType.MEMBERSHIP_FEE,
          }];

        // b. Admission Fee line (if applicable)
        if (breakdown.rawAdmissionFee > 0) {
          lineItems.push({
              invoiceId,
              description: "One-time Admission / Registration Fee",
              amount: breakdown.rawAdmissionFee,
              itemType: InvoiceItemType.ADMISSION_FEE,
          });
        }

        // c. Discount line (if applicable)
        if (breakdown.computedDiscount > 0) {
          lineItems.push({
              invoiceId,
              description: `Approved Membership Discount (${discountType === "PERCENTAGE" ? `${discountValue}%` : "Fixed"})`,
              amount: -breakdown.computedDiscount,
              itemType: InvoiceItemType.DISCOUNT,
          });
        }

        // d. Admission Waiver line (if applicable)
        if (breakdown.admissionDiscountValue > 0) {
          lineItems.push({
              invoiceId,
              description: "Admission Fee Waiver Discount",
              amount: -breakdown.admissionDiscountValue,
              itemType: InvoiceItemType.DISCOUNT,
          });
        }

        await tx.invoiceLineItem.createMany({ data: lineItems });
        // 4. Create Installments Schedule (if applicable)
        if (paymentTerms === "INSTALLMENTS" && Array.isArray(installments) && installments.length > 0) {
            await tx.invoiceInstallment.createMany({
              data: installments.map((inst: any, i: number) => ({
                invoiceId,
                installmentNumber: i + 1,
                amount: parseFloat(inst.amount),
                dueDate: new Date(inst.dueDate),
                status: InstallmentStatus.PENDING,
              })),
            });
        }
      }

      // 5. Audit Log Entry
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "MEMBERSHIP_ASSIGNED",
          entityType: "GYM_MEMBER",
          entityId: member.id,
          details: JSON.stringify({
            memberId: member.memberId,
            planName: newMembership.planName,
            startDate: start,
            endDate: calculatedEnd,
            breakdown,
            invoiceNumber: createdInvoice?.invoiceNumber,
            paymentTerms,
          }),
        },
      });

      if (member.userId && createdInvoice) await enqueueNotification(tx, { recipientUserId: member.userId, eventType: "INVOICE_ISSUED", title: "Membership invoice issued", message: `${createdInvoice.invoiceNumber} is available in your account.`, category: "PAYMENT", entityType: "INVOICE", entityId: createdInvoice.id, actionUrl: "/dashboard", dedupKey: `invoice-issued:${createdInvoice.id}` });
      return { newMembership, createdInvoice, breakdown };
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({
      success: true,
      message: `Membership plan '${result.newMembership.planName}' kamiyabi se assign ho gaya! Validity: ${start.toLocaleDateString()} to ${calculatedEnd.toLocaleDateString()}`,
      membership: result.newMembership,
      invoice: result.createdInvoice,
      breakdown: result.breakdown,
    });
  } catch (error) {
    console.error("Assign Membership Error:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2028") return NextResponse.json({ success: false, error: "Database busy thi; membership save nahi hui. Dobara try karein." }, { status: 503 });
    return NextResponse.json(
      { success: false, error: "Membership assign karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
export const PATCH = POST;
