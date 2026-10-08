import { withReadCache } from "@/lib/serverReadCache";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, WorkoutPlanStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

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

    const now = new Date();
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const currentDayName = dayNames[new Date(now.getTime() + 18000000).getUTCDay()];

    // Find active published workout plan
    const publishedPlan = await prisma.workoutPlan.findFirst({
      orderBy: { startDate: "desc" },
      where: {
        gymMemberId,
        status: WorkoutPlanStatus.PUBLISHED,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        trainer: {
          select: { id: true, name: true, phone: true },
        },
        workoutDays: {
          include: {
            exercises: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!publishedPlan) {
      return NextResponse.json({
        success: true,
        data: {
          hasPlan: false,
          message: "Workout plan abhi available nahi",
        },
      });
    }

    // Match today's day of week or pick the first day
    let matchingDay = publishedPlan.workoutDays.find(
      (d) => d.dayOfWeek?.toUpperCase() === currentDayName
    );


    // Check if there is an existing session for today
    const { start: startOfDay, end: endOfDay } = getDateRangeForPeriod("today");

    const existingSession = await prisma.workoutSession.findFirst({
      where: {
        gymMemberId,
        planId: publishedPlan.id,
        sessionDate: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        exerciseLogs: {
          orderBy: { setNumber: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        hasPlan: true,
        plan: {
          id: publishedPlan.id,
          title: publishedPlan.title,
          goal: publishedPlan.goal,
          version: publishedPlan.version,
          weeklySchedule: publishedPlan.weeklySchedule,
          trainerName: publishedPlan.trainer.name,
        },
        todayDay: matchingDay
          ? {
              id: matchingDay.id,
              title: matchingDay.title,
              dayOfWeek: matchingDay.dayOfWeek,
              exercises: matchingDay.exercises,
            }
          : null,
        session: existingSession
          ? {
              id: existingSession.id,
              status: existingSession.status,
              startedAt: existingSession.startedAt,
              completedAt: existingSession.completedAt,
              durationMinutes: existingSession.durationMinutes,
              skipReason: existingSession.skipReason,
              memberNotes: existingSession.memberNotes,
              trainerFeedback: existingSession.trainerFeedback,
              exerciseLogs: existingSession.exerciseLogs,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("GET_TODAY_WORKOUT_ERROR:", error);
    return NextResponse.json({ success: false, error: "Aaj ka workout load nahi ho saka." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
