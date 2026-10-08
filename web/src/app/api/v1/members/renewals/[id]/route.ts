import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { enqueueNotification } from "@/lib/notifications";
import { lockMember } from "@/lib/recordLocks";
import { calculateMembershipEndDate } from "@/lib/pricing";
import { prisma } from "@/lib/db";
import {
  RenewalRequestStatus,
  MembershipStatus,
  InvoiceStatus,
  InvoiceItemType,
  DurationUnit,
} from "@prisma/client";

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
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, rejectionReason, startDateOverride } = body;

    if (!action || (action !== "APPROVE" && action !== "REJECT")) {
      return NextResponse.json(
        { success: false, error: "Action (APPROVE ya REJECT) lazmi hai." },
        { status: 400 }
      );
    }

    const renewalReq = await prisma.renewalRequest.findUnique({
      where: { id },
      include: {
        gymMember: true,
        feePlan: true,
      },
    });

    if (!renewalReq) {
      return NextResponse.json({ success: false, error: "Renewal request nahi mili." }, { status: 404 });
    }

    if (renewalReq.status !== RenewalRequestStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: `Yeh request pehle hi ${renewalReq.status} ho chuki hai.` },
        { status: 400 }
      );
    }

    if (action === "REJECT") {
      if (!rejectionReason || !rejectionReason.trim()) {
        return NextResponse.json(
          { success: false, error: "Reject karne ki wajah (rejection reason) darj karein." },
          { status: 400 }
        );
      }

      const updated = await prisma.$transaction(async tx => {
        await lockMember(tx, renewalReq.gymMemberId);
        const request = await tx.renewalRequest.update({ where: { id, status: RenewalRequestStatus.PENDING }, data: { status: RenewalRequestStatus.REJECTED, rejectionReason: rejectionReason.trim(), reviewedById: current.user.id, reviewedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: current.user.id, actorName: current.user.name, actorRole: current.user.role, action: "RENEWAL_REQUEST_REJECTED", entityType: "RENEWAL_REQUEST", entityId: id, details: JSON.stringify({ memberId: renewalReq.gymMemberId, reason: rejectionReason.trim() }) } });
        if (renewalReq.gymMember.userId) await enqueueNotification(tx, { recipientUserId: renewalReq.gymMember.userId, eventType: "RENEWAL_REQUEST_REJECTED", title: "Renewal request declined", message: rejectionReason.trim(), category: "MEMBERSHIP", actionUrl: "/membership", dedupKey: "renewal-rejected:" + id });
        return request;
      });

      return NextResponse.json({
        success: true,
        message: "Renewal request reject kar di gayi.",
        data: updated,
      });
    }

    // ACTION: APPROVE
    const plan = renewalReq.feePlan;
    const startDate = startDateOverride ? new Date(startDateOverride) : new Date(renewalReq.preferredStartDate);

    // Calculate end date based on feePlan duration
    const endDate = calculateMembershipEndDate(startDate, plan.durationValue, plan.durationUnit);
    const settings = await prisma.gymSettings.findFirst();

    const now = new Date();
    const initialStatus = startDate > now ? MembershipStatus.UPCOMING : MembershipStatus.ACTIVE;

    const result = await prisma.$transaction(
      async (tx) => {
        await lockMember(tx, renewalReq.gymMemberId);
        const liveRequest = await tx.renewalRequest.findUniqueOrThrow({ where: { id } });
        if (liveRequest.status !== "PENDING") throw new Error("Request already reviewed.");
        const overlap = await tx.membership.findFirst({ where: { gymMemberId: renewalReq.gymMemberId, status: { in: ["ACTIVE", "UPCOMING", "FROZEN"] }, startDate: { lte: endDate }, endDate: { gte: startDate } } });
        if (overlap) throw new Error("Renewal overlaps an existing membership.");
        // 1. Create renewal Membership
        const newMembership = await tx.membership.create({
          data: {
            gymMemberId: renewalReq.gymMemberId,
            feePlanId: plan.id,
            planName: plan.name,
            durationValue: plan.durationValue,
            durationUnit: plan.durationUnit,
            startDate,
            endDate,
            status: initialStatus,
            feeAmount: plan.membershipFee,
            admissionFeeCharged: 0,
            discountApplied: 0,
            servicesSnapshot: plan.includedServices || "Gym Access, Locker",
          },
        });

        // 2. Create renewal Invoice
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('invoice-number'))`;
        const invCount = await tx.invoice.count();
        const invoiceNumber = `OXG-INV-${String(invCount + 1).padStart(6, "0")}`;

        const createdInvoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            gymMemberId: renewalReq.gymMemberId,
            membershipId: newMembership.id,
            title: `${plan.name} Renewal Subscription`,
            totalAmount: plan.membershipFee,
            paidAmount: 0,
            balanceAmount: plan.membershipFee,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + (settings?.invoiceDueDays ?? 7) * 86400000),
            status: InvoiceStatus.UNPAID,
            notes: `Renewal validity: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          },
        });

        // 3. Create Line Item
        await tx.invoiceLineItem.create({
          data: {
            invoiceId: createdInvoice.id,
            description: `${plan.name} (${plan.durationValue} ${plan.durationUnit.toLowerCase()})`,
            amount: plan.membershipFee,
            itemType: InvoiceItemType.MEMBERSHIP_FEE,
          },
        });

        // 4. Update RenewalRequest
        const updatedReq = await tx.renewalRequest.update({
          where: { id, status: RenewalRequestStatus.PENDING },
          data: {
            status: RenewalRequestStatus.APPROVED,
            reviewedById: current.user.id,
            reviewedAt: new Date(),
            resultingMembershipId: newMembership.id,
          },
        });

        // 5. Audit Log
        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "RENEWAL_REQUEST_APPROVED",
            entityType: "RENEWAL_REQUEST",
            entityId: id,
            details: JSON.stringify({
              memberId: renewalReq.gymMemberId,
              planName: plan.name,
              membershipId: newMembership.id,
              invoiceId: createdInvoice.id,
            }),
          },
        });

        if (renewalReq.gymMember.userId) await enqueueNotification(tx, { recipientUserId: renewalReq.gymMember.userId, eventType: "INVOICE_ISSUED", title: "Renewal approved", message: `${createdInvoice.invoiceNumber} is available in your account.`, category: "PAYMENT", entityType: "INVOICE", entityId: createdInvoice.id, actionUrl: "/dashboard", dedupKey: `invoice-issued:${createdInvoice.id}` });
        return {
          renewalRequest: updatedReq,
          membership: newMembership,
          invoice: createdInvoice,
        };
      },
      { maxWait: 10000, timeout: 25000 }
    );

    return NextResponse.json({
      success: true,
      message: "Renewal request approve ho gayi aur membership + invoice create ho gaya.",
      data: result,
    });
  } catch (error: any) {
    console.error("APPROVE_RENEWAL_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Renewal request process karne mein masla aya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
