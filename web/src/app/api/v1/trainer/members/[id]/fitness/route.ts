import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, FitnessDataCategory } from "@prisma/client";
import {
  getKarachiTodayDate,
  getKarachiDateRange,
  calculateActivityAggregates,
} from "@/lib/fitness";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }

    const { id } = await params;

    const member = await prisma.gymMember.findUnique({
      where: { id },
      include: {
        trainer: { select: { id: true, name: true } },
        trainerAssignments: {
          where: { ...effectiveTrainerAssignment() },
          take: 1,
        },
        fitnessConnection: true,
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member record nahi mila." }, { status: 404 });
    }

    // If caller is TRAINER, enforce strict coaching assignment check
    if (current.user.role === Role.TRAINER) {
      const isAssignedDirect = member.trainerId === current.user.id;
      const isAssignedActive = member.trainerAssignments.some((a) => a.trainerId === current.user.id);

      if (!isAssignedDirect && !isAssignedActive) {
        return NextResponse.json(
          { success: false, error: "Aap is member ke assigned trainer nahi hain." },
          { status: 403 }
        );
      }

      // Check member's trainer sharing consent
      const conn = member.fitnessConnection;
      if (!conn || !conn.trainerSharingEnabled) {
        return NextResponse.json(
          {
            success: false,
            error: "Member ne fitness data trainer ke sath share nahi kiya.",
            sharingDisabled: true,
          },
          { status: 403 }
        );
      }

      // Check if trainer changed since confirmation
      if (conn.trainerConfirmedCoachId && conn.trainerConfirmedCoachId !== current.user.id) {
        return NextResponse.json(
          {
            success: false,
            error: "Trainer assignment change ho chuki hai. Naye trainer ke liye member ki fresh sharing confirmation darkaar hai.",
            coachReassigned: true,
          },
          { status: 403 }
        );
      }
    }

    const conn = member.fitnessConnection;
    const permittedCategories = new Set(conn?.trainerSharingCategories || []);

    const allowSteps = permittedCategories.has(FitnessDataCategory.STEPS);
    const allowDistance = permittedCategories.has(FitnessDataCategory.DISTANCE);
    const allowCalories = permittedCategories.has(FitnessDataCategory.ACTIVE_CALORIES);
    const allowSessions = permittedCategories.has(FitnessDataCategory.EXERCISE_SESSIONS);

    const { searchParams } = new URL(req.url);
    const rangeParam = (searchParams.get("range") || "week") as "today" | "week" | "month" | "custom";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;

    const { startDate, endDate, totalDays } = getKarachiDateRange(rangeParam, customStart, customEnd);
    const todayStr = getKarachiTodayDate();

    // Fetch summaries in range
    const savedSummaries = await prisma.dailyActivitySummary.findMany({
      where: {
        gymMemberId: id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    });

    const summaryMap = new Map<string, typeof savedSummaries[0]>();
    for (const s of savedSummaries) {
      summaryMap.set(s.date, s);
    }

    const sanitizedSummaries: Array<{
      date: string;
      steps: number | null;
      distanceKm: number | null;
      activeCalories: number | null;
      hasData: boolean;
      source: string | null;
      isToday: boolean;
    }> = [];

    const cur = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");

    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      const item = summaryMap.get(dStr);

      if (item) {
        sanitizedSummaries.push({
          date: dStr,
          steps: allowSteps ? item.steps : null,
          distanceKm: allowDistance ? item.distanceKm : null,
          activeCalories: allowCalories ? item.activeCalories : null,
          hasData: item.hasData,
          source: item.source,
          isToday: dStr === todayStr,
        });
      } else {
        sanitizedSummaries.push({
          date: dStr,
          steps: null,
          distanceKm: null,
          activeCalories: null,
          hasData: false,
          source: null,
          isToday: dStr === todayStr,
        });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Workouts: only if permitted
    let sanitizedSessions: any[] = [];
    if (allowSessions) {
      const startDateTime = new Date(startDate + "T00:00:00Z");
      const endDateTime = new Date(endDate + "T23:59:59.999Z");

      const workouts = await prisma.syncedExerciseSession.findMany({
        where: {
          gymMemberId: id,
          startTime: { gte: startDateTime, lte: endDateTime },
        },
        orderBy: { startTime: "desc" },
      });

      sanitizedSessions = workouts.map((w) => ({
        id: w.id,
        exerciseType: w.exerciseType,
        title: w.title,
        startTime: w.startTime,
        endTime: w.endTime,
        durationMinutes: w.durationMinutes,
        activeCalories: allowCalories ? w.activeCalories : null,
        distanceKm: allowDistance ? w.distanceKm : null,
        source: w.source,
        notes: w.notes,
      }));
    }

    const rawAggregates = calculateActivityAggregates(
      sanitizedSummaries,
      sanitizedSessions,
      totalDays
    );

    // Redact unpermitted aggregate metrics
    const aggregates = {
      ...rawAggregates,
      totalSteps: allowSteps ? rawAggregates.totalSteps : 0,
      availableDaysSteps: allowSteps ? rawAggregates.availableDaysSteps : 0,
      averageDailySteps: allowSteps ? rawAggregates.averageDailySteps : null,
      totalDistanceKm: allowDistance ? rawAggregates.totalDistanceKm : 0,
      averageDailyDistanceKm: allowDistance ? rawAggregates.averageDailyDistanceKm : null,
      totalActiveCalories: allowCalories ? rawAggregates.totalActiveCalories : 0,
      averageDailyActiveCalories: allowCalories ? rawAggregates.averageDailyActiveCalories : null,
      totalWorkouts: allowSessions ? rawAggregates.totalWorkouts : 0,
      totalWorkoutDurationMinutes: allowSessions ? rawAggregates.totalWorkoutDurationMinutes : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        memberName: member.fullName,
        memberCode: member.memberId,
        sharedCategories: Array.from(permittedCategories),
        range: rangeParam,
        startDate,
        endDate,
        aggregates,
        dailySummaries: sanitizedSummaries,
        workoutSessions: sanitizedSessions,
        lastSyncedAt: conn?.lastSyncedAt || null,
      },
    });
  } catch (error: any) {
    console.error("GET trainer member fitness error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load fitness data." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
