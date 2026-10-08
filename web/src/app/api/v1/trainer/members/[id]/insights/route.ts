import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, FitnessDataCategory } from "@prisma/client";
import {
  getTwoWeekComparisonRanges,
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
    const trainerId = current.user.id;

    const member = await prisma.gymMember.findUnique({
      where: { id },
      include: {
        trainer: { select: { id: true, name: true } },
        trainerAssignments: {
          where: { ...effectiveTrainerAssignment() },
          take: 1,
        },
        fitnessConnection: true,
        workoutPlans: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { workoutDays: true },
        },
        dietPlans: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member record nahi mila." }, { status: 404 });
    }

    // Verify assignment if trainer
    if (current.user.role === Role.TRAINER) {
      const isDirect = member.trainerId === trainerId;
      const isActiveAssigned = member.trainerAssignments.some((a) => a.trainerId === trainerId);
      if (!isDirect && !isActiveAssigned) {
        return NextResponse.json(
          { success: false, error: "Aap is member ke assigned trainer nahi hain." },
          { status: 403 }
        );
      }

      // Check sharing consent
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

      // Check coach reassignment
      if (conn.trainerConfirmedCoachId && conn.trainerConfirmedCoachId !== trainerId) {
        return NextResponse.json(
          {
            success: false,
            error: "Trainer assignment tabdeel ho chuki hai. Naye trainer ke liye fresh confirmation darkaar hai.",
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

    // Date boundaries: if member defined historyRangeStart, do not expose prior data
    const dateBoundary = conn?.historyRangeStart
      ? conn.historyRangeStart.toISOString().slice(0, 10)
      : null;

    // Get 2-week comparison boundaries
    const { currentWeek, previousWeek } = getTwoWeekComparisonRanges();

    // Helper to fetch and sanitize week data
    const fetchWeekData = async (range: { startDate: string; endDate: string }) => {
      let effectiveStart = range.startDate;
      if (dateBoundary && dateBoundary > effectiveStart) {
        effectiveStart = dateBoundary;
      }

      const summaries = await prisma.dailyActivitySummary.findMany({
        where: {
          gymMemberId: id,
          date: { gte: effectiveStart, lte: range.endDate },
        },
        orderBy: { date: "asc" },
      });

      const summaryMap = new Map<string, typeof summaries[0]>();
      for (const s of summaries) {
        summaryMap.set(s.date, s);
      }

      const seq: any[] = [];
      const cur = new Date(range.startDate + "T00:00:00Z");
      const end = new Date(range.endDate + "T00:00:00Z");

      while (cur <= end) {
        const dStr = cur.toISOString().slice(0, 10);
        const item = summaryMap.get(dStr);

        if (item && (!dateBoundary || dStr >= dateBoundary)) {
          seq.push({
            date: dStr,
            steps: allowSteps ? item.steps : null,
            distanceKm: allowDistance ? item.distanceKm : null,
            activeCalories: allowCalories ? item.activeCalories : null,
            hasData: item.hasData,
            source: item.source,
          });
        } else {
          seq.push({
            date: dStr,
            steps: null,
            distanceKm: null,
            activeCalories: null,
            hasData: false,
            source: null,
          });
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      let workouts: any[] = [];
      if (allowSessions) {
        workouts = await prisma.syncedExerciseSession.findMany({
          where: {
            gymMemberId: id,
            startTime: {
              gte: new Date(effectiveStart + "T00:00:00Z"),
              lte: new Date(range.endDate + "T23:59:59.999Z"),
            },
          },
          orderBy: { startTime: "desc" },
        });
      }

      const rawAggregates = calculateActivityAggregates(seq, workouts, 7);

      return {
        startDate: range.startDate,
        endDate: range.endDate,
        aggregates: {
          stepsPerAvailableDay: allowSteps ? rawAggregates.averageDailySteps : null,
          daysWithStepsData: allowSteps ? `${rawAggregates.availableDaysSteps}/7` : "0/7",
          totalSteps: allowSteps ? rawAggregates.totalSteps : 0,
          totalDistanceKm: allowDistance ? rawAggregates.totalDistanceKm : 0,
          totalActiveCalories: allowCalories ? rawAggregates.totalActiveCalories : 0,
          recordedWorkoutsCount: allowSessions ? rawAggregates.totalWorkouts : 0,
          recordedWorkoutDurationMinutes: allowSessions ? rawAggregates.totalWorkoutDurationMinutes : 0,
        },
        dailySummaries: seq,
        workouts: workouts.map((w) => ({
          id: w.id,
          exerciseType: w.exerciseType,
          title: w.title,
          startTime: w.startTime,
          durationMinutes: w.durationMinutes,
          activeCalories: allowCalories ? w.activeCalories : null,
          distanceKm: allowDistance ? w.distanceKm : null,
          source: w.source,
        })),
      };
    };

    const currentWeekData = await fetchWeekData(currentWeek);
    const previousWeekData = await fetchWeekData(previousWeek);

    // Also fetch assigned gym workout logs to keep separate from synced exercise
    const assignedWorkoutSessions = await prisma.workoutSession.findMany({
      where: {
        gymMemberId: id,
        sessionDate: {
          gte: new Date(currentWeek.startDate + "T00:00:00Z"),
          lte: new Date(currentWeek.endDate + "T23:59:59.999Z"),
        },
      },
      include: {
        workoutDay: { select: { title: true } },
      },
      orderBy: { sessionDate: "desc" },
      take: 10,
    });

    // Past reviews
    const pastReviews = await prisma.trainerActivityReview.findMany({
      where: { gymMemberId: id },
      include: {
        trainer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          memberId: member.memberId,
          fullName: member.fullName,
          phone: member.phone,
          fitnessGoal: member.fitnessGoal,
          limitations: member.limitations,
          activeWorkoutPlan: member.workoutPlans[0] || null,
          activeDietPlan: member.dietPlans[0] || null,
        },
        sharedCategories: Array.from(permittedCategories),
        historyRangeType: conn?.historyRangeType || "ALL",
        lastSyncedAt: conn?.lastSyncedAt || null,
        comparison: {
          currentWeek: currentWeekData,
          previousWeek: previousWeekData,
        },
        assignedWorkoutSessions: assignedWorkoutSessions.map((s) => ({
          id: s.id,
          title: s.workoutDay?.title || "Gym Session",
          sessionDate: s.sessionDate,
          status: s.status,
          durationMinutes: s.durationMinutes,
          skipReason: s.skipReason,
          isManualAssigned: true,
        })),
        pastReviews,
      },
    });
  } catch (error: any) {
    console.error("GET trainer member insights error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load insights." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
