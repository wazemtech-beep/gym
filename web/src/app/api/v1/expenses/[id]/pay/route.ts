import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, ExpenseStatus, PaymentMethod } from "@prisma/client";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json(
        { success: false, error: "Expense payment record karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      amount,
      paymentDate,
      paymentMethod = "CASH",
      receivingAccountId,
      referenceNumber,
      notes,
    } = body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Payment amount positive number honi chahiye." },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findFirst({
      where: {
        OR: [{ id }, { expenseNumber: id }],
      },
      include: { category: true },
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense nahi mila." }, { status: 404 });
    }

    if (expense.status === ExpenseStatus.VOID) {
      return NextResponse.json(
        { success: false, error: "Void shuda expense par payment record nahi ho sakti." },
        { status: 400 }
      );
    }

    if (expense.balanceAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Yeh expense pehle se fully PAID ho chuka hai." },
        { status: 400 }
      );
    }

    if (parsedAmount > expense.balanceAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment amount baqi payable balance (Rs. ${expense.balanceAmount.toLocaleString()}) se zyada nahi ho sakti.`,
        },
        { status: 400 }
      );
    }

    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Link active CashSession if cash drawer payment
      let openSessionId: string | null = null;
      if (paymentMethod === PaymentMethod.CASH) {
        const activeSession = await tx.cashSession.findFirst({
          where: { status: "OPEN", staffId: current.user.id },
          orderBy: { openedAt: "desc" },
        });
        if (activeSession) {
          openSessionId = activeSession.id;
          await tx.cashSession.update({
            where: { id: activeSession.id },
            data: {
              expectedCash: Math.max(0, activeSession.expectedCash - parsedAmount),
            },
          });
        }
      }

      // 2. Create ExpensePayment record
      const paymentRecord = await tx.expensePayment.create({
        data: {
          expenseId: expense.id,
          amount: parsedAmount,
          paymentDate: parsedPaymentDate,
          method: paymentMethod as PaymentMethod,
          receivingAccountId: receivingAccountId || null,
          cashSessionId: openSessionId,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          notes: notes ? notes.trim() : null,
          recordedById: current.user.id,
        },
        include: {
          receivingAccount: { select: { displayName: true } },
          cashSession: { select: { sessionNumber: true } },
        },
      });

      // 3. Update Expense paidAmount, balanceAmount, status
      const newPaid = expense.paidAmount + parsedAmount;
      const newBalance = Math.max(0, expense.totalAmount - newPaid);
      const newStatus = newBalance === 0 ? ExpenseStatus.PAID : ExpenseStatus.PARTIALLY_PAID;

      const updatedExpense = await tx.expense.update({
        where: { id: expense.id },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
        },
        include: {
          category: true,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "EXPENSE_PAYMENT_RECORDED",
          entityType: "EXPENSE_PAYMENT",
          entityId: paymentRecord.id,
          details: JSON.stringify({
            expenseNumber: expense.expenseNumber,
            paidNow: parsedAmount,
            totalPaid: newPaid,
            remainingBalance: newBalance,
            newStatus,
            method: paymentMethod,
            cashSessionId: openSessionId,
          }),
        },
      });

      return { paymentRecord, updatedExpense };
    });

    return NextResponse.json({
      success: true,
      message: `Rs. ${parsedAmount.toLocaleString()} payment recorded against ${result.updatedExpense.expenseNumber}! Remaining balance: Rs. ${result.updatedExpense.balanceAmount.toLocaleString()}`,
      expense: result.updatedExpense,
      payment: result.paymentRecord,
    });
  } catch (error) {
    console.error("Record Expense Payment Error:", error);
    return NextResponse.json(
      { success: false, error: "Payment record karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
