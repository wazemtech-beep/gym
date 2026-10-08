import { withReadCache } from "@/lib/serverReadCache";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, PaymentMethod, PaymentStatus, TransferProofStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.RECEPTIONIST && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Access unauthorized." }, { status: 403 });
    }

    // Karachi start of day calculation
    const now = new Date();
    const { start: startOfToday, end: endOfToday } = getDateRangeForPeriod("today");

    // 1. My payments recorded today + pending items
    const [myTodayPayments, pendingTransfers, todayCheckIns, pendingFreezeRequests] = await Promise.all([
      prisma.payment.findMany({
        where: {
          recordedById: current.user.id,
          paymentDate: { gte: startOfToday, lte: endOfToday },
          status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.REFUNDED] },
      method: { not: "ADVANCE_CREDIT" },
        },
        orderBy: { paymentDate: "desc" },
        include: {
          gymMember: {
            select: { id: true, fullName: true, memberId: true, phone: true },
          },
          receivingAccount: {
            select: { displayName: true },
          },
        },
      }),
      prisma.transferSubmission.findMany({
        where: { status: TransferProofStatus.PENDING },
        orderBy: { submittedAt: "desc" },
        take: 10,
        include: {
          gymMember: {
            select: { id: true, fullName: true, memberId: true, phone: true },
          },
          receivingAccount: {
            select: { displayName: true, accountNumber: true },
          },
        },
      }),
      prisma.attendanceRecord.findMany({
        where: {
          checkIn: { gte: startOfToday, lte: endOfToday },
          isVoid: false,
        },
        orderBy: { checkIn: "desc" },
        take: 15,
        include: {
          gymMember: {
            select: { id: true, fullName: true, memberId: true, photoUrl: true },
          },
        },
      }),
      prisma.membershipFreezeRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          gymMember: {
            select: { id: true, fullName: true, memberId: true, phone: true },
          },
          membership: {
            select: { id: true, planName: true, endDate: true },
          },
        },
      }),
    ]);

    // Financial breakdown for receptionist's own drawer
    const todayMyCash = myTodayPayments
      .filter((p) => p.method === PaymentMethod.CASH)
      .reduce((sum, p) => sum + p.amount, 0);

    const todayMyTotal = myTodayPayments.reduce((sum, p) => sum + p.amount, 0);

    // Active drawer cash session
    const activeCashSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN", staffId: current.user.id },
      orderBy: { openedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      stats: {
        todayMyCash,
        todayMyTotal,
        todayMyReceiptsCount: myTodayPayments.length,
        todayTotalCheckIns: todayCheckIns.length,
        pendingTransfersCount: pendingTransfers.length,
        pendingFreezeCount: pendingFreezeRequests.length,
        drawerExpectedCash: activeCashSession?.expectedCash ?? 0,
      },
      myTodayPayments,
      activeCashSession,
      pendingTransfers,
      pendingFreezeRequests,
      recentCheckIns: todayCheckIns.map((ci) => ({
        id: ci.id,
        memberId: ci.gymMember.id,
        code: ci.gymMember.memberId,
        name: ci.gymMember.fullName,
        photoUrl: ci.gymMember.photoUrl,
        checkInTime: ci.checkIn,
        checkInMethod: ci.method,
      })),
    });
  } catch (error) {
    console.error("GET Reception Dashboard API Error:", error);
    return NextResponse.json(
      { success: false, error: "Reception dashboard load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
