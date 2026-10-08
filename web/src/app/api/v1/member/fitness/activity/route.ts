import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import {
  getKarachiTodayDate,
  getKarachiDateRange,
  calculateActivityAggregates,
} from "@/lib/fitness";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.MEMBER) return NextResponse.json({ success: false, error: "Only the member can manage personal fitness data and consent." }, { status: 403 });

    let gymMemberId: string | null = null;
    if (current.user.role === Role.MEMBER) {
      const member = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!member) {
        return NextResponse.json({ success: false, error: "Member profile nahi mili." }, { status: 404 });
      }
      gymMemberId = member.id;
    } else {
      const searchParams = req.nextUrl.searchParams;
      gymMemberId = searchParams.get("memberId");
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const rangeParam = (searchParams.get("range") || "week") as "today" | "week" | "month" | "custom";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;

    const { startDate, endDate, totalDays } = getKarachiDateRange(rangeParam, customStart, customEnd);
    const todayStr = getKarachiTodayDate();

    // Fetch existing daily summaries in date range
    const savedSummaries = await prisma.dailyActivitySummary.findMany({
      where: {
        gymMemberId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });

    // Create a lookup map by date
    const summaryMap = new Map<string, typeof savedSummaries[0]>();
    for (const s of savedSummaries) {
      summaryMap.set(s.date, s);
    }

    // Build day-by-day sequence to preserve gaps and missing dates accurately
    const summariesSequence: Array<{
      date: string;
      steps: number | null;
      distanceKm: number | null;
      activeCalories: number | null;
      hasData: boolean;
      source: string | null;
      coverageNote: string | null;
      isToday: boolean;
    }> = [];

    const cur = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");

    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      const item = summaryMap.get(dStr);

      if (item) {
        summariesSequence.push({
          date: dStr,
          steps: item.steps,
          distanceKm: item.distanceKm,
          activeCalories: item.activeCalories,
          hasData: item.hasData,
          source: item.source,
          coverageNote: item.coverageNote,
          isToday: dStr === todayStr,
        });
      } else {
        // Missing day: NOT zero, accurately marked as hasData = false with null metrics
        summariesSequence.push({
          date: dStr,
          steps: null,
          distanceKm: null,
          activeCalories: null,
          hasData: false,
          source: null,
          coverageNote: null,
          isToday: dStr === todayStr,
        });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Fetch synced workouts in date range
    const startDateTime = new Date(startDate + "T00:00:00+05:00");
    const endDateTime = new Date(endDate + "T23:59:59.999+05:00");

    const workoutSessions = await prisma.syncedExerciseSession.findMany({
      where: {
        gymMemberId,
        startTime: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: { startTime: "desc" },
    });

    // Calculate aggregated metrics with missing-day aware rules
    const aggregates = calculateActivityAggregates(
      summariesSequence,
      workoutSessions,
      totalDays
    );

    // Fetch member connection state
    const connection = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId },
    });

    const todaySummary = summariesSequence.find((s) => s.isToday) || null;

    return NextResponse.json({
      success: true,
      data: {
        range: rangeParam,
        startDate,
        endDate,
        todayDate: todayStr,
        aggregates,
        todaySummary,
        dailySummaries: summariesSequence,
        workoutSessions,
        connection: connection || {
          status: "DISCONNECTED",
          platform: "HEALTH_CONNECT",
          backendUploadConsent: false,
          reportedPermissions: [],
          trainerSharingEnabled: false,
          lastSyncedAt: null,
        },
      },
    });
  } catch (error: any) {
    console.error("GET fitness activity error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load activity." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
