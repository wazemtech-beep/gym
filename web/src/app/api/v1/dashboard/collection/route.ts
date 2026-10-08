import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { PaymentMethod, PaymentStatus, InvoiceStatus, TransferProofStatus } from "@prisma/client";

import { getDateRangeForPeriod } from "@/lib/businessDates";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Role check: Only Owner and Receptionist can view collection metrics
    if (current.user.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: "Collection access karne ki permission nahi hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "today";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;

    const { start, end } = getDateRangeForPeriod(period, customStart, customEnd);

    // 1. Fetch payments in date range with CONFIRMED status
    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: start,
          lte: end,
        },
        status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.REFUNDED] },
      method: { not: "ADVANCE_CREDIT" },
      },
      include: {
        gymMember: {
          select: { fullName: true, memberId: true },
        },
        recordedBy: {
          select: { name: true },
        },
        receivingAccount: {
          select: { displayName: true },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    // 2. Fetch refunds in date range
    const refunds = await prisma.refund.findMany({
      where: {
        refundDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        recordedBy: { select: { name: true } },
      },
    });

    // 3. Compute collection totals
    let cashReceived = 0;
    let bankReceived = 0;

    for (const p of payments) {
      if (p.method === PaymentMethod.CASH) {
        cashReceived += p.amount;
      } else {
        bankReceived += p.amount;
      }
    }

    const totalReceived = cashReceived + bankReceived;
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
    const netCollection = totalReceived - totalRefunds;

    // 4. Pending Bank Transfer Proofs (Always real-time, separate from collection)
    const pendingTransfers = await prisma.transferSubmission.findMany({
      where: { status: TransferProofStatus.PENDING },
      include: {
        gymMember: { select: { fullName: true, memberId: true, phone: true } },
        receivingAccount: { select: { displayName: true, accountNumber: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    const pendingTransfersAmount = pendingTransfers.reduce((sum, t) => sum + t.amount, 0);

    // 5. Invoices & Dues summary
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
      },
      include: {
        gymMember: { select: { fullName: true, memberId: true } },
      },
    });

    const totalOutstandingDues = outstandingInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
    const now = new Date();
    const overdueInvoices = outstandingInvoices.filter((inv) => new Date(inv.dueDate) < now);
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

    // 6. Active Cash Session (Shift checking)
    const activeCashSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN", staffId: current.user.id },
      include: {
        staff: { select: { name: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    // 7. Total Active Gym Members count
    const activeMembersCount = await prisma.gymMember.count({
      where: { status: "CURRENT", memberships: { some: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } } } },
    });

    const expiringMembershipsCount = await prisma.membership.count({ where: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) }, gymMember: { status: "CURRENT" } } });
    return NextResponse.json({
      success: true,
      period,
      dateRange: { start, end },
      metrics: {
        netCollection,
        totalReceived,
        cashReceived,
        bankReceived,
        totalRefunds,
        pendingTransfersCount: pendingTransfers.length,
        pendingTransfersAmount,
        totalOutstandingDues,
        totalOverdue,
        activeMembersCount,
        expiringMembershipsCount,
      },
      payments,
      refunds,
      pendingTransfers,
      activeCashSession,
    });
  } catch (error) {
    console.error("Dashboard Collection API Error:", error);
    return NextResponse.json(
      { success: false, error: "Collection data load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
