import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { lockMember } from "@/lib/recordLocks";
import { prisma } from "@/lib/db";
import { Role, PaymentStatus, InvoiceStatus, PaymentMethod, InstallmentStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role === Role.TRAINER) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const paymentId = searchParams.get("paymentId");

    const where: any = {};

    if (current.user.role === Role.MEMBER) {
      const myMember = await prisma.gymMember.findFirst({
        where: { userId: current.user.id },
      });
      if (!myMember) {
        return NextResponse.json({ success: true, refunds: [], totalRefunded: 0 });
      }
      // Member can ONLY view their own refunds, ignoring any tampered memberId
      where.payment = { gymMemberId: myMember.id };
      if (paymentId) {
        where.paymentId = paymentId;
      }
    } else {
      if (memberId) {
        where.payment = { gymMemberId: memberId };
      }
      if (paymentId) {
        where.paymentId = paymentId;
      }
    }

    const refunds = await prisma.refund.findMany({
      where,
      include: {
        payment: {
          select: {
            id: true,
            receiptNumber: true,
            amount: true,
            method: true,
            gymMember: {
              select: { id: true, fullName: true, memberId: true, phone: true },
            },
          },
        },
        recordedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { refundDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      refunds,
      totalRefunded: refunds.reduce((sum, r) => sum + r.amount, 0),
    });
  } catch (error) {
    console.error("GET Refunds Error:", error);
    return NextResponse.json({ success: false, error: "Refunds load karne mein khata aayi." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Role check: Owner or staff with PAYMENT_REVERSAL_REFUND permission
    if (
      current.user.role !== Role.OWNER &&
      !hasUserPermission(current.user, "PAYMENT_REVERSAL_REFUND")
    ) {
      return NextResponse.json(
        { success: false, error: "Member refund record karne ka ikhtiyar nahi hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      paymentId,
      amount,
      reason,
      refundMethod = PaymentMethod.CASH,
      feeObligationTreatment = "KEEP_FEE_DUE",
    } = body;

    if (!paymentId) {
      return NextResponse.json({ success: false, error: "Payment ID lazmi hai." }, { status: 400 });
    }

    const refundAmount = Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return NextResponse.json({ success: false, error: "Durust refund raqam darj karein." }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ success: false, error: "Refund ki wajah (reason) likhna lazmi hai." }, { status: 400 });
    }

    // Fetch payment and previous refunds
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        gymMember: true,
        refunds: true,
        allocations: {
          include: {
            invoice: {
              include: {
                installments: {
                  orderBy: { installmentNumber: "desc" },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment nahi mili." }, { status: 404 });
    }

    if (payment.status === PaymentStatus.REVERSED) {
      return NextResponse.json({ success: false, error: "Reversed payment par refund jari nahi ho sakta." }, { status: 400 });
    }

    const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
    const maxRefundable = Math.max(0, payment.amount - alreadyRefunded);

    if (refundAmount > maxRefundable) {
      return NextResponse.json(
        {
          success: false,
          error: `Is payment par zyada se zyada Rs. ${maxRefundable.toLocaleString()} refund ho sakte hain (pehle se refunded: Rs. ${alreadyRefunded.toLocaleString()}).`,
        },
        { status: 400 }
      );
    }

    const voucherNumber = `OXG-RFD-${Date.now().toString().slice(-6)}`;

    // Execute atomic refund transaction
    const result = await prisma.$transaction(async (tx) => {
      await lockMember(tx, payment.gymMemberId);
      const livePayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { refunds: true } });
      const refundedNow = livePayment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
      if (livePayment.status === "REVERSED" || refundAmount > livePayment.amount - refundedNow) throw new Error("Refund balance changed. Refresh before retrying.");
      if (await tx.paymentAllocation.count({ where: { paymentId: payment.id, invoice: { status: "VOID" } } })) throw new Error("Paid funds have been released from a void invoice. Resolve its advance credit before refunding the original receipt.");
      // 1. Create Refund record
      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          refundVoucherNumber: voucherNumber,
          amount: refundAmount,
          reason: reason.trim(),
          refundMethod,
          recordedById: current.user.id,
          feeObligationTreatment,
          refundDate: new Date(),
        },
      });

      // 2. Update Payment status if fully refunded
      const isFullyRefunded = refundedNow + refundAmount >= payment.amount;
      if (isFullyRefunded) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      }

      // 3. Overpayment advance credit adjustment
      // If payment had an unallocated advance portion, the refund first consumes this excess credit
      const totalAllocatedOnInvoices = payment.allocations.reduce((sum, a) => sum + a.amount, 0);
      const paymentAdvancePortion = Math.max(0, payment.amount - totalAllocatedOnInvoices);
      let advanceDeduction = 0;

      if (paymentAdvancePortion > 0 && payment.gymMemberId) {
        advanceDeduction = Math.min(paymentAdvancePortion, refundAmount);
        const member = await tx.gymMember.findUnique({ where: { id: payment.gymMemberId } });
        if (member && (member.advanceBalance || 0) > 0) {
          const actualDeduction = Math.min(member.advanceBalance || 0, advanceDeduction);
          const newAdvance = Math.max(0, (member.advanceBalance || 0) - actualDeduction);
          await tx.gymMember.update({
            where: { id: member.id },
            data: { advanceBalance: newAdvance },
          });

          await tx.advanceCredit.create({
            data: {
              gymMemberId: member.id,
              amount: -actualDeduction,
              sourceType: "REFUND_DEDUCTION",
              paymentId: payment.id,
              notes: `Deducted advance credit due to refund ${voucherNumber}`,
            },
          });
        }
      }

      // 4. Fee obligation treatment on linked invoices & installments
      // The remaining refund amount (after deducting advance overpayment) unsettles invoice balances
      if (feeObligationTreatment === "KEEP_FEE_DUE") {
        let remainingRefundToUnsettle = Math.max(0, refundAmount - advanceDeduction);

        for (const alloc of payment.allocations) {
          if (remainingRefundToUnsettle <= 0) break;

          const inv = await tx.invoice.findUniqueOrThrow({ where: { id: alloc.invoiceId }, include: { installments: { orderBy: { installmentNumber: "desc" } } } });
          const unsettleFromInvoice = Math.min(alloc.amount, remainingRefundToUnsettle);

          const newPaid = Math.max(0, inv.paidAmount - unsettleFromInvoice);
          const newBalance = inv.totalAmount - newPaid;
          const newStatus = newPaid === 0 ? InvoiceStatus.UNPAID : InvoiceStatus.PARTIALLY_PAID;

          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBalance,
              status: newStatus,
            },
          });

          // Reduce the allocation amount accordingly
          await tx.paymentAllocation.update({
            where: { id: alloc.id },
            data: {
              amount: Math.max(0, alloc.amount - unsettleFromInvoice),
            },
          });

          // Re-open installments if applicable
          let installmentUnsettle = unsettleFromInvoice;
          for (const inst of inv.installments) {
            if (installmentUnsettle <= 0) break;
            if (inst.paidAmount > 0) {
              const reduceInst = Math.min(inst.paidAmount, installmentUnsettle);
              const updatedInstPaid = inst.paidAmount - reduceInst;
              const isOverdue = new Date(inst.dueDate) < new Date();
              const updatedInstStatus =
                updatedInstPaid === 0
                  ? isOverdue
                    ? InstallmentStatus.OVERDUE
                    : InstallmentStatus.PENDING
                  : InstallmentStatus.PENDING;

              await tx.invoiceInstallment.update({
                where: { id: inst.id },
                data: {
                  paidAmount: updatedInstPaid,
                  status: updatedInstStatus,
                },
              });

              installmentUnsettle -= reduceInst;
            }
          }

          remainingRefundToUnsettle -= unsettleFromInvoice;
        }
      }

      // 5. Cash Session balance impact if refunded in CASH
      if (refundMethod === PaymentMethod.CASH) {
        const openSession = await tx.cashSession.findFirst({
          where: { status: "OPEN", staffId: current.user.id },
          orderBy: { openedAt: "desc" },
        });

        if (openSession) {
          await tx.cashSession.update({
            where: { id: openSession.id },
            data: {
              expectedCash: Math.max(0, openSession.expectedCash - refundAmount),
            },
          });
        }
      }

      // 6. Immutable Audit Log Entry
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "MEMBER_REFUND_RECORDED",
          entityType: "REFUND",
          entityId: refund.id,
          details: JSON.stringify({
            voucherNumber,
            paymentId: payment.id,
            receiptNumber: payment.receiptNumber,
            amount: refundAmount,
            refundMethod,
            feeObligationTreatment,
            reason: reason.trim(),
            memberId: payment.gymMember?.memberId,
            memberName: payment.gymMember?.fullName,
          }),
        },
      });

      return refund;
    }, { maxWait: 15000, timeout: 25000 });

    return NextResponse.json({
      success: true,
      message: `Refund Voucher ${voucherNumber} kamiyabi se record ho gaya (Rs. ${refundAmount.toLocaleString()}).`,
      refund: result,
      refundVoucherNumber: voucherNumber,
    });
  } catch (error: any) {
    console.error("POST Refund Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Refund record karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
