import { withReadCache } from "@/lib/serverReadCache";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, MembershipStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Memberships report access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "this_month";

    const now = new Date();
    const dates = getDateRangeForPeriod(dateRange === "next_30_days" ? "today" : dateRange, searchParams.get("startDate") || undefined, searchParams.get("endDate") || undefined);
    const gteDate = dates.start;
    const lteDate = dateRange === "next_30_days" ? new Date(dates.end.getTime() + 30 * 86400000) : dates.end;

    // 1. Overall counts
    const [activeCount, upcomingCount, frozenCount, expiredCount] = await Promise.all([
      prisma.membership.count({ where: { status: MembershipStatus.ACTIVE } }),
      prisma.membership.count({ where: { status: MembershipStatus.UPCOMING } }),
      prisma.membership.count({ where: { status: MembershipStatus.FROZEN } }),
      prisma.membership.count({ where: { status: MembershipStatus.EXPIRED } }),
    ]);

    // 2. Memberships expiring in selected period
    const expiringInPeriod = await prisma.membership.findMany({
      where: {
        endDate: { gte: gteDate, lte: lteDate },
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.EXPIRED] },
      },
      include: {
        gymMember: {
          select: { id: true, memberId: true, fullName: true, phone: true },
        },
      },
      orderBy: { endDate: "asc" },
    });

    // 3. New memberships / renewals started in period
    const renewalsInPeriod = await prisma.membership.findMany({
      where: {
        startDate: { gte: gteDate, lte: lteDate },
      },
      include: {
        gymMember: {
          select: { id: true, memberId: true, fullName: true, phone: true },
        },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      summary: {
        active: activeCount,
        upcoming: upcomingCount,
        frozen: frozenCount,
        expired: expiredCount,
        total: activeCount + upcomingCount + frozenCount + expiredCount,
        expiringCount: expiringInPeriod.length,
        renewalsCount: renewalsInPeriod.length,
      },
      expiringMemberships: expiringInPeriod,
      renewedMemberships: renewalsInPeriod,
    });
  } catch (error) {
    console.error("Memberships Report Error:", error);
    return NextResponse.json(
      { success: false, error: "Memberships report generate karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
