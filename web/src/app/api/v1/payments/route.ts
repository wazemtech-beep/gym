import { withReadCache } from "@/lib/serverReadCache";
import { lockMember } from "@/lib/recordLocks";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { PaymentMethod, PaymentStatus, Role, NotificationCategory, InvoiceStatus } from "@prisma/client";
import { dispatchNotification, enqueueNotification } from "@/lib/notifications";
import { allocatePaymentToInvoicesAndInstallments, generateReceiptNumber } from "@/lib/financialAllocation";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "PAYMENT_RECORD_VERIFY")) {
      return NextResponse.json(
        { success: false, error: "Payment record karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      gymMemberId,
      invoiceId,
      amount,
      method,
      receivingAccountId,
      paymentDate,
      referenceNumber,
      notes,
      idempotencyKey,
      requestKey,
      backdateReason,
      customAllocations,
    } = body;

    // Stable idempotency key check to prevent duplicate double-clicks / network retries (Requirement 3.7 / Line 340)
    const effectiveKey = (idempotencyKey || requestKey || req.headers.get("x-idempotency-key"))?.trim();
    if (effectiveKey) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey: effectiveKey },
        include: {
          allocations: { include: { invoice: true } },
          gymMember: { select: { fullName: true, memberId: true } },
        },
      });

      if (existingPayment) {
        if (existingPayment.gymMemberId !== gymMemberId || existingPayment.amount !== Number(amount) || existingPayment.method !== (method || "CASH")) return NextResponse.json({ success: false, error: "This request ID was already used for a different payment." }, { status: 409 });
        return NextResponse.json({
          success: true,
          message: "Payment pehle hi process ho chuki hai (Idempotent response).",
          payment: existingPayment,
          receiptNumber: existingPayment.receiptNumber,
          isDuplicate: true,
        });
      }
    }

    const parsedAmount = parseFloat(amount);
    if (!gymMemberId || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Member aur durust amount (greater than 0) lazmi hain." },
        { status: 400 }
      );
    }

    const targetMember = await prisma.gymMember.findUnique({
      where: { id: gymMemberId },
      select: { fullName: true, memberId: true, userId: true, phone: true, advanceBalance: true },
    });

    if (!targetMember) {
      return NextResponse.json({ success: false, error: "Member record nahi mila." }, { status: 404 });
    }

    const targetMethod = (method || "CASH") as PaymentMethod;

    if (targetMethod === PaymentMethod.ADVANCE_CREDIT) {
      if ((targetMember.advanceBalance || 0) < parsedAmount) {
        return NextResponse.json(
          {
            success: false,
            error: `Member ka advance credit balance (Rs. ${(targetMember.advanceBalance || 0).toLocaleString()}) payment amount (Rs. ${parsedAmount.toLocaleString()}) se kam hai.`,
          },
          { status: 400 }
        );
      }
    }

    // Verify invoice ownership if specific invoiceId provided
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, gymMemberId: true, status: true, balanceAmount: true },
      });
      if (!invoice) {
        return NextResponse.json({ success: false, error: "Muntakhib invoice nahi mili." }, { status: 404 });
      }
      if (invoice.gymMemberId !== gymMemberId) {
        return NextResponse.json(
          { success: false, error: "Muntakhib invoice is member se mutalliq nahi hai." },
          { status: 400 }
        );
      }
    }

    // Duplicate transaction reference check for transfer accounts (Requirement 3.7 / Line 342)
    if (referenceNumber && receivingAccountId) {
      const existingTrx = await prisma.payment.findFirst({
        where: {
          referenceNumber: referenceNumber.trim(),
          receivingAccountId,
          status: PaymentStatus.CONFIRMED,
        },
        select: { receiptNumber: true, paymentDate: true },
      });

      if (existingTrx) {
        return NextResponse.json(
          {
            success: false,
            error: `Transaction reference '${referenceNumber}' pehle se is account mein Receipt #${existingTrx.receiptNumber} mein record ho chuka hai. Duplicate entry block kar di gayi hai.`,
          },
          { status: 400 }
        );
      }
    }

    const actualPaymentDate = paymentDate ? new Date(paymentDate) : new Date();
    if (!Number.isFinite(parsedAmount) || !Object.values(PaymentMethod).includes(targetMethod) || !Number.isFinite(actualPaymentDate.getTime()) || actualPaymentDate.getTime() > Date.now()) return NextResponse.json({ success: false, error: "Invalid payment amount, method or date." }, { status: 400 });

    // Backdating control (Requirement 4 / Line 306): Entries > 2 days in the past require reason & owner authorization
    const daysDifference = (Date.now() - actualPaymentDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDifference > 2) {
      if (!backdateReason?.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "2 din se purani payment date darj karne ke liye backdate ki wajah (reason) batana lazmi hai.",
          },
          { status: 400 }
        );
      }
      if (current.user.role !== Role.OWNER && !hasUserPermission(current.user, "PAYMENT_REVERSAL_REFUND")) {
        return NextResponse.json(
          {
            success: false,
            error: "Sirf authorized staff ya Owner purani dates ki payment enter kar sakta hai.",
          },
          { status: 403 }
        );
      }
    }

    const gymSettings = await prisma.gymSettings.findFirst();
    const prefix = gymSettings?.receiptPrefix || "OXG-RCP";

    // Atomic transaction for Payment creation + Invoice allocation + Installment settlement + Cash Drawer
    const { payment, allocationSummary } = await prisma.$transaction(async (tx) => {
      if (effectiveKey) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-request:${effectiveKey}`}))`;
      await lockMember(tx, gymMemberId);
      if (referenceNumber && receivingAccountId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`transfer-reference:${receivingAccountId}:${referenceNumber.trim()}`}))`;
      if (effectiveKey) {
        const duplicate = await tx.payment.findUnique({ where: { idempotencyKey: effectiveKey } });
        if (duplicate && (duplicate.gymMemberId !== gymMemberId || duplicate.amount !== parsedAmount || duplicate.method !== targetMethod)) throw new Error("Request ID belongs to a different payment.");
        if (duplicate) return { payment: duplicate, allocationSummary: { allocations: [], advanceCreditAmount: 0, totalAllocated: 0 } };
      }
      if (targetMethod === PaymentMethod.ADVANCE_CREDIT) {
        const lockedMember = await tx.gymMember.findUniqueOrThrow({ where: { id: gymMemberId } });
        const dues = await tx.invoice.aggregate({ where: { gymMemberId, status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] } }, _sum: { balanceAmount: true } });
        if (parsedAmount > (lockedMember.advanceBalance || 0) || parsedAmount > (dues._sum.balanceAmount || 0)) throw new Error("Advance payment exceeds available credit or outstanding dues.");
      }
      // 1. Concurrency-safe unique receipt number
      const nextReceiptNum = await generateReceiptNumber(tx, prefix);
      if (referenceNumber && receivingAccountId) {
        const duplicateReference = await tx.payment.findFirst({ where: { referenceNumber: referenceNumber.trim(), receivingAccountId, status: PaymentStatus.CONFIRMED } });
        if (duplicateReference) throw new Error("Transaction reference already recorded for this receiving account.");
      }

      // 2. Create Payment record with immutable branding snapshot
      const p = await tx.payment.create({
        data: {
          receiptNumber: nextReceiptNum,
          idempotencyKey: effectiveKey || null,
          gymMemberId,
          amount: parsedAmount,
          method: targetMethod,
          receivingAccountId: receivingAccountId || null,
          paymentDate: actualPaymentDate,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          status: PaymentStatus.CONFIRMED,
          recordedById: current.user.id,
          verifiedById: targetMethod !== PaymentMethod.CASH ? current.user.id : null,
          notes: notes || null,
          backdateReason: backdateReason ? backdateReason.trim() : null,
          brandingSnapshot: {
            memberName: targetMember.fullName,
            memberId: targetMember.memberId,
            memberPhone: targetMember.phone,
            logoUrl: gymSettings?.logoUrl,
            gymName: gymSettings?.gymName || "OXGEN GYM",
            tagline: gymSettings?.tagline,
            contactPhone: gymSettings?.contactPhone,
            contactEmail: gymSettings?.contactEmail,
            address: gymSettings?.address,
            receiptFooter: gymSettings?.receiptFooter,
            currency: gymSettings?.currency || "PKR",
          },
        },
      });

      const allocationSummary = await allocatePaymentToInvoicesAndInstallments(tx, {
        gymMemberId,
        paymentId: p.id,
        amount: parsedAmount,
        preferredInvoiceId: invoiceId || null,
        customAllocations,
      });

      // Freeze total member remaining dues on Payment record
      const remainingDuesAgg = await tx.invoice.aggregate({
        where: {
          gymMemberId,
          balanceAmount: { gt: 0 },
          status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
        },
        _sum: { balanceAmount: true },
      });
      const frozenMemberRemainingDues = remainingDuesAgg._sum.balanceAmount || 0;

      await tx.payment.update({
        where: { id: p.id },
        data: {
          memberRemainingDues: frozenMemberRemainingDues,
        },
      });

      // 3.5. If ADVANCE_CREDIT payment, deduct advance balance and consume unapplied AdvanceCredit records
      if (targetMethod === PaymentMethod.ADVANCE_CREDIT) {
        await tx.gymMember.update({
          where: { id: gymMemberId },
          data: {
            advanceBalance: { decrement: parsedAmount },
          },
        });

        const activeCredits = await tx.advanceCredit.findMany({
          where: { gymMemberId },
          orderBy: { createdAt: "asc" },
        });

        let remainingToDeduct = parsedAmount;
        for (const ac of activeCredits) {
          if (remainingToDeduct <= 0.001) break;
          const availableInRow = ac.amount - ac.appliedAmount;
          if (availableInRow > 0) {
            const consume = Math.min(availableInRow, remainingToDeduct);
            await tx.advanceCredit.update({
              where: { id: ac.id },
              data: {
                appliedAmount: { increment: consume },
                appliedInvoiceId: invoiceId || null,
              },
            });
            remainingToDeduct = Math.round((remainingToDeduct - consume) * 100) / 100;
          }
        }
      }

      // 4. If Cash payment, increment open cash session expected cash
      if (targetMethod === PaymentMethod.CASH) {
        const activeCashSession = await tx.cashSession.findFirst({
          where: { status: "OPEN", staffId: current.user.id },
          orderBy: { openedAt: "desc" },
        });
        if (!activeCashSession) throw new Error("Open your cash session before recording a cash payment.");

        if (activeCashSession) {
          await tx.cashSession.update({
            where: { id: activeCashSession.id },
            data: {
              expectedCash: { increment: parsedAmount },
            },
          });
        }
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "PAYMENT_RECORDED",
          entityType: "PAYMENT",
          entityId: p.id,
          details: JSON.stringify({
            receiptNumber: nextReceiptNum,
            amount: parsedAmount,
            method: targetMethod,
            member: targetMember.fullName,
            memberId: targetMember.memberId || gymMemberId,
            allocationsCount: allocationSummary.allocations.length,
            advanceCredited: allocationSummary.advanceCreditAmount,
          }),
        },
      });

      if (targetMember.userId) await enqueueNotification(tx, { recipientUserId: targetMember.userId, eventType: "PAYMENT_CONFIRMED", title: "Payment Confirmed", message: `Payment Rs. ${p.amount.toLocaleString()} confirmed. Receipt #${p.receiptNumber}.`, category: NotificationCategory.PAYMENT, entityType: "RECEIPT", entityId: p.id, actionUrl: "/dashboard", dedupKey: `payment-conf-${p.id}` });
      if (gymSettings?.emailReceiptsAutomatically && targetMember.userId) await enqueueNotification(tx, { recipientUserId: targetMember.userId, eventType: "RECEIPT_EMAIL", title: `Receipt ${p.receiptNumber}`, message: "Your payment receipt is attached.", category: NotificationCategory.PAYMENT, entityType: "RECEIPT", entityId: p.id, dedupKey: `receipt-email:${p.id}`, channels: ["EMAIL"] });
      return { payment: p, allocationSummary };
    }, { maxWait: 10000, timeout: 25000 });

    // Feature 20: Safe notification dispatch to member
    if (targetMember.userId) {
      dispatchNotification({
        recipientUserId: targetMember.userId,
        eventType: "PAYMENT_CONFIRMED",
        title: "Payment Confirmed",
        message: `Aapki Rs. ${payment.amount.toLocaleString()} ki payment confirm ho gayi hai. Receipt #${payment.receiptNumber} issue ho chuki hai.`,
        category: NotificationCategory.PAYMENT,
        entityType: "RECEIPT",
        entityId: payment.id,
        actionUrl: `/dashboard`,
        dedupKey: `payment-conf-${payment.id}`,
      }).catch((e) => console.error("Payment notification dispatch error:", e));
    }

    return NextResponse.json({
      success: true,
      message: `Payment kamiyabi se save ho gayi! Receipt #${payment.receiptNumber} issue ho chuki hai.`,
      payment,
      receiptNumber: payment.receiptNumber,
      allocations: allocationSummary.allocations,
      advanceCredit: allocationSummary.advanceCreditAmount,
    });
  } catch (error: any) {
    console.error("Record Payment API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Payment record karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role === Role.TRAINER) {
      return NextResponse.json(
        { success: false, error: "Trainers ko gym financial records dekhne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    // Member can view own payments, Staff/Owner can view gym payments
    const searchParams = req.nextUrl.searchParams;
    const memberIdParam = searchParams.get("memberId");
    const search = searchParams.get("search")?.trim();
    const method = searchParams.get("method") as PaymentMethod | null;
    const receivingAccountId = searchParams.get("receivingAccountId");
    const staffId = searchParams.get("staffId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const where: any = {
      status: PaymentStatus.CONFIRMED,
    };

    if (current.user.role === Role.MEMBER) {
      const myMember = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
        select: { id: true },
      });
      if (!myMember) {
        return NextResponse.json({ success: true, payments: [], total: 0 });
      }
      where.gymMemberId = myMember.id;
    } else {
      // Staff / Owner
      if (memberIdParam) {
        where.gymMemberId = memberIdParam;
      }
      if (method) {
        where.method = method;
      }
      if (receivingAccountId) {
        where.receivingAccountId = receivingAccountId;
      }
      if (staffId) {
        where.recordedById = staffId;
      }
      if (startDate || endDate) {
        where.paymentDate = {};
        if (startDate) {
          where.paymentDate.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.paymentDate.lte = end;
        }
      }
      if (search) {
        where.OR = [
          { receiptNumber: { contains: search, mode: "insensitive" } },
          { referenceNumber: { contains: search, mode: "insensitive" } },
          { gymMember: { fullName: { contains: search, mode: "insensitive" } } },
          { gymMember: { memberId: { contains: search, mode: "insensitive" } } },
          { gymMember: { phone: { contains: search, mode: "insensitive" } } },
        ];
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit,
        include: {
          gymMember: {
            select: { id: true, fullName: true, memberId: true, phone: true },
          },
          receivingAccount: {
            select: { id: true, displayName: true, type: true, accountNumber: true },
          },
          recordedBy: {
            select: { id: true, name: true, role: true },
          },
          allocations: {
            include: {
              invoice: {
                select: { id: true, invoiceNumber: true, totalAmount: true, balanceAmount: true, status: true },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET Payments API Error:", error);
    return NextResponse.json(
      { success: false, error: "Payments load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
export const GET = withReadCache(getHandler);
