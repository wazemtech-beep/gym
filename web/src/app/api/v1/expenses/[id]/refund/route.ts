import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasUserPermission } from "@/lib/permissions";
import { PaymentMethod, CashSessionStatus, ExpenseStatus } from "@prisma/client";

function generateExpenseRefundNumber(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `OXG-VRF-${dateStr}-${randomSuffix}`;
}

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "EXPENSES_MANAGE")) {
      return NextResponse.json(
        { success: false, error: "Vendor refunds manage karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      amount,
      reason,
      method = PaymentMethod.CASH,
      receivingAccountId,
    } = body;

    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Refund amount 0 se zyada honi chahiye." },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Vendor refund ki wajah (reason) lazmi hai." },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        refunds: true,
      },
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense nahi mila." }, { status: 404 });
    }

    const totalPriorRefunds = expense.refunds.reduce((sum, r) => sum + r.amount, 0);
    const maxRefundable = expense.paidAmount;

    if (refundAmount > maxRefundable) {
      return NextResponse.json(
        {
          success: false,
          error: `Refund amount (Rs. ${refundAmount}) ada shuda raqam (Rs. ${maxRefundable}) se zyada nahi ho sakti.`,
        },
        { status: 400 }
      );
    }

    // If CASH, find active CashSession to record cash inflow into drawer
    let cashSessionId: string | null = null;
    if (method === PaymentMethod.CASH) {
      const activeSession = await prisma.cashSession.findFirst({
        where: { status: CashSessionStatus.OPEN },
      });
      if (activeSession) {
        cashSessionId = activeSession.id;
      }
    }

    const refundNumber = generateExpenseRefundNumber();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create ExpenseRefund record
      const refundRecord = await tx.expenseRefund.create({
        data: {
          refundNumber,
          expenseId: expense.id,
          amount: refundAmount,
          method: method as PaymentMethod,
          receivingAccountId: receivingAccountId || null,
          cashSessionId,
          reason: reason.trim(),
          recordedById: current.user.id,
        },
      });

      // 2. If cash drawer session exists, increment expected cash
      if (cashSessionId) {
        await tx.cashSession.update({
          where: { id: cashSessionId },
          data: {
            expectedCash: { increment: refundAmount },
          },
        });
      }

      // 3. Update expense paid amount and status
      const newPaidAmount = Math.max(0, expense.paidAmount - refundAmount);
      const newBalanceAmount = Math.max(0, expense.totalAmount - newPaidAmount);

      let newStatus: ExpenseStatus = expense.status;
      if (newPaidAmount === 0) {
        newStatus = ExpenseStatus.UNPAID;
      } else if (newPaidAmount < expense.totalAmount) {
        newStatus = ExpenseStatus.PARTIALLY_PAID;
      } else {
        newStatus = ExpenseStatus.PAID;
      }

      const updatedExpense = await tx.expense.update({
        where: { id: expense.id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "EXPENSE_VENDOR_REFUND",
          entityType: "EXPENSE",
          entityId: expense.id,
          details: JSON.stringify({
            refundNumber,
            expenseNumber: expense.expenseNumber,
            payee: expense.payee,
            refundAmount,
            method,
            reason,
            cashSessionId,
            newPaidAmount,
          }),
        },
      });

      return { refundRecord, updatedExpense };
    });

    return NextResponse.json({
      success: true,
      message: `Vendor refund (${result.refundRecord.refundNumber}) Rs. ${refundAmount.toLocaleString()} kamiyabi se record ho gaya.`,
      data: result,
    });
  } catch (error: any) {
    console.error("VENDOR_EXPENSE_REFUND_ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
