import { withReadCache } from "@/lib/serverReadCache";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, ExpenseStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Expense report access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "this_month";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const { start: gteDate, end: lteDate } = getDateRangeForPeriod(startDateParam && endDateParam ? "custom" : dateRange, startDateParam || undefined, endDateParam || undefined);

    // 1. Recorded Expenses in period (by charge date)
    const recordedExpenses = await prisma.expense.findMany({
      where: {
        expenseDate: { gte: gteDate, lte: lteDate },
        status: { not: ExpenseStatus.VOID },
      },
      include: {
        category: true,
        recordedBy: { select: { name: true } },
      },
      orderBy: { expenseDate: "desc" },
    });

    // 2. Actual Expense Outflow in period (by payment date)
    const expensePayments = await prisma.expensePayment.findMany({
      where: {
        paymentDate: { gte: gteDate, lte: lteDate },
      },
      include: {
        expense: { select: { expenseNumber: true, title: true, payee: true } },
        receivingAccount: { select: { displayName: true } },
        cashSession: { select: { sessionNumber: true } },
        recordedBy: { select: { name: true } },
      },
      orderBy: { paymentDate: "desc" },
    });

    // 3. Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const exp of recordedExpenses) {
      const cat = exp.category.name;
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + exp.totalAmount;
    }

    // 4. Source breakdown of actual expense payments
    const cashOutflow = expensePayments
      .filter((ep) => ep.method === PaymentMethod.CASH)
      .reduce((sum, ep) => sum + ep.amount, 0);

    const bankOutflow = expensePayments
      .filter((ep) => ep.method !== PaymentMethod.CASH)
      .reduce((sum, ep) => sum + ep.amount, 0);

    const totalRecorded = recordedExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
    const totalPaidOutflow = expensePayments.reduce((sum, ep) => sum + ep.amount, 0);

    // 5. Net Cash Movement in same period
    // Confirmed member payments in period
    const memberPayments = await prisma.payment.findMany({
      where: {
        paymentDate: { gte: gteDate, lte: lteDate },
        status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.REFUNDED] },
      method: { not: "ADVANCE_CREDIT" },
      },
    });
    const totalMemberCollection = memberPayments.reduce((sum, p) => sum + p.amount, 0);

    // Member refunds
    const refunds = await prisma.refund.findMany({
      where: {
        refundDate: { gte: gteDate, lte: lteDate },
      },
    });
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);

    // Net cash movement (Collection - Refunds - Expense Payments)
    const netCashMovement = totalMemberCollection - totalRefunds - totalPaidOutflow;

    return NextResponse.json({
      success: true,
      period: { gteDate, lteDate },
      summary: {
        totalRecordedExpenses: totalRecorded,
        totalPaidOutflow,
        cashOutflow,
        bankOutflow,
        categoryBreakdown,
        // Net Cash Flow Analysis
        cashMovementAnalysis: {
          confirmedMemberCollection: totalMemberCollection,
          memberRefunds: totalRefunds,
          expensePaymentsOutflow: totalPaidOutflow,
          netCashMovement, // Note: per specs 12.5, labelled as Net Cash Movement, not Profit
        },
      },
      recordedExpenses,
      expensePayments,
    });
  } catch (error) {
    console.error("Expense Report Error:", error);
    return NextResponse.json(
      { success: false, error: "Expense report generate karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
