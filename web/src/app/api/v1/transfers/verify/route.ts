import { withReadCache } from "@/lib/serverReadCache";
import { lockMember } from "@/lib/recordLocks";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { PaymentMethod, PaymentStatus, TransferProofStatus, NotificationCategory } from "@prisma/client";
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
        { success: false, error: "Transfers verify karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { submissionId, action, rejectionReason } = body;

    if (!submissionId || !action) {
      return NextResponse.json(
        { success: false, error: "Submission ID aur action (APPROVE ya REJECT) lazmi hain." },
        { status: 400 }
      );
    }

    const submission = await prisma.transferSubmission.findUnique({
      where: { id: submissionId },
      include: {
        gymMember: true,
        receivingAccount: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ success: false, error: "Transfer submission nahi mili." }, { status: 404 });
    }

    if (submission.status !== TransferProofStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: `Yeh transfer pehle hi ${submission.status} ho chuka hai.` },
        { status: 400 }
      );
    }

    // Action: REJECT
    if (action === "REJECT") {
      const updated = await prisma.transferSubmission.update({
        where: { id: submissionId },
        data: {
          status: TransferProofStatus.REJECTED,
          rejectionReason: rejectionReason || "Account verification mein raqam nahi mili.",
          verifiedAt: new Date(),
          verifiedById: current.user.id,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "TRANSFER_PROOF_REJECTED",
          entityType: "TRANSFER_SUBMISSION",
          entityId: submission.id,
          details: JSON.stringify({
            member: submission.gymMember.fullName,
            amount: submission.amount,
            reason: rejectionReason,
          }),
        },
      });

      // Feature 20: Notify member of transfer rejection
      if (submission.gymMember.userId) {
        dispatchNotification({
          recipientUserId: submission.gymMember.userId,
          eventType: "TRANSFER_REJECTED",
          title: "Transfer Proof Rejected",
          message: `Aapka Rs. ${submission.amount.toLocaleString()} ka transfer proof reject kar diya gaya hai. Wajah: ${rejectionReason || "Details match nahi huin."}`,
          category: NotificationCategory.PAYMENT,
          entityType: "TRANSFER_SUBMISSION",
          entityId: submission.id,
          actionUrl: "/dashboard",
          dedupKey: `transfer-rej-${submission.id}`,
        }).catch((e) => console.error("Transfer rejected notification error:", e));
      }

      return NextResponse.json({
        success: true,
        message: "Transfer proof reject kar diya gaya hai. Collection unchanged rahi.",
        transfer: updated,
      });
    }

    // Action: APPROVE -> Creates confirmed Payment & Receipt with configured prefix and branding snapshot
    const gymSettings = await prisma.gymSettings.findFirst();
    const prefix = gymSettings?.receiptPrefix || "OXG-RCP";

    // TXT requirement (Line 295, 319): paymentDate is actual receiving date, NOT staff approval timestamp
    const actualPaymentDate = submission.transferDate || submission.submittedAt || new Date();

    const { payment, allocationSummary } = await prisma.$transaction(async (tx) => {
      await lockMember(tx, submission.gymMemberId);
      if (submission.transactionReference && submission.receivingAccountId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`transfer-reference:${submission.receivingAccountId}:${submission.transactionReference.trim()}`}))`;
      // 1. Concurrency guard: Atomically verify status is still PENDING
      const updateCheck = await tx.transferSubmission.updateMany({
        where: { id: submissionId, status: TransferProofStatus.PENDING },
        data: {
          status: TransferProofStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedById: current.user.id,
        },
      });

      if (updateCheck.count === 0) {
        throw new Error("Yeh transfer pehle hi kisi aur staff ne verify ya process kar di hai.");
      }

      // 2. Duplicate reference check against same receiving account (TXT line 342)
      if (submission.transactionReference && submission.receivingAccountId) {
        const existingRef = await tx.payment.findFirst({
          where: {
            referenceNumber: submission.transactionReference.trim(),
            receivingAccountId: submission.receivingAccountId,
            status: PaymentStatus.CONFIRMED,
          },
        });
        if (existingRef) {
          throw new Error(`Transaction reference '${submission.transactionReference}' pehle se Receipt #${existingRef.receiptNumber} mein use ho chuka hai.`);
        }
      }

      // 3. Concurrency-safe unique receipt number
      const nextReceiptNum = await generateReceiptNumber(tx, prefix);

      // 4. Create confirmed payment with actual receiving date
      const p = await tx.payment.create({
        data: {
          receiptNumber: nextReceiptNum,
          gymMemberId: submission.gymMemberId,
          amount: submission.amount,
          method: submission.receivingAccount.type || PaymentMethod.BANK_TRANSFER,
          receivingAccountId: submission.receivingAccountId,
          paymentDate: actualPaymentDate, // Actual transfer date in PKT
          referenceNumber: submission.transactionReference || null,
          status: PaymentStatus.CONFIRMED,
          recordedById: current.user.id,
          verifiedById: current.user.id,
          notes: `Verified Bank Transfer from ${submission.gymMember.fullName} (Submitted: ${new Date(submission.submittedAt).toLocaleDateString()})`,
          brandingSnapshot: {
            memberName: submission.gymMember.fullName,
            memberId: submission.gymMember.memberId,
            memberPhone: submission.gymMember.phone,
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

      // 5. Link payment to transfer submission
      await tx.transferSubmission.update({
        where: { id: submissionId },
        data: {
          paymentId: p.id,
        },
      });

      // 6. Allocate payment to member's unpaid invoices, installments, and advance credit
      const allocationSummary = await allocatePaymentToInvoicesAndInstallments(tx, {
        gymMemberId: submission.gymMemberId,
        paymentId: p.id,
        amount: submission.amount,
      });

      // 7. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "TRANSFER_PROOF_VERIFIED_AND_PAID",
          entityType: "PAYMENT",
          entityId: p.id,
          details: JSON.stringify({
            member: submission.gymMember.fullName,
            amount: submission.amount,
            receiptNumber: nextReceiptNum,
            actualPaymentDate: actualPaymentDate.toISOString(),
            allocationsCount: allocationSummary.allocations.length,
            advanceCredited: allocationSummary.advanceCreditAmount,
          }),
        },
      });

      if (submission.gymMember.userId) await enqueueNotification(tx, { recipientUserId: submission.gymMember.userId, eventType: "PAYMENT_CONFIRMED", title: "Transfer confirmed", message: `Transfer confirmed. Receipt #${p.receiptNumber}.`, category: NotificationCategory.PAYMENT, entityType: "RECEIPT", entityId: p.id, actionUrl: "/dashboard", dedupKey: `transfer-appr-${p.id}` });
      if (gymSettings?.emailReceiptsAutomatically && submission.gymMember.userId) await enqueueNotification(tx, { recipientUserId: submission.gymMember.userId, eventType: "RECEIPT_EMAIL", title: `Receipt ${p.receiptNumber}`, message: "Your payment receipt is attached.", category: NotificationCategory.PAYMENT, entityType: "RECEIPT", entityId: p.id, dedupKey: `receipt-email:${p.id}`, channels: ["EMAIL"] });
      return { payment: p, allocationSummary };
    });

    // Feature 20: Notify member of transfer approval
    if (submission.gymMember.userId) {
      dispatchNotification({
        recipientUserId: submission.gymMember.userId,
        eventType: "TRANSFER_APPROVED",
        title: "Transfer Approved & Confirmed",
        message: `Aapka Rs. ${payment.amount.toLocaleString()} ka transfer verify ho gaya hai. Receipt #${payment.receiptNumber} issue ho chuki hai. Invoices settled: ${allocationSummary.allocations.length}.`,
        category: NotificationCategory.PAYMENT,
        entityType: "RECEIPT",
        entityId: payment.id,
        actionUrl: "/dashboard",
        dedupKey: `transfer-appr-${payment.id}`,
      }).catch((e) => console.error("Transfer approved notification error:", e));
    }

    return NextResponse.json({
      success: true,
      message: `Bank transfer verify ho gaya! Confirmed Receipt #${payment.receiptNumber} issue ho gayi.`,
      payment,
      allocations: allocationSummary.allocations,
      advanceCredit: allocationSummary.advanceCreditAmount,
    });
  } catch (error: any) {
    console.error("Transfer Verify API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Transfer verify karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
