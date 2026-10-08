import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";
import { Role, WorkoutSessionStatus, ExerciseType } from "@prisma/client";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.MEMBER) return NextResponse.json({ success: false, error: "Only members can submit their workout logs." }, { status: 403 });
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
      const bodyPreview = await req.clone().json().catch(() => ({}));
      gymMemberId = bodyPreview.memberId || null;
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid workout request." }, { status: 400 });
    if (current.user.mustChangePassword || (body.expectedMemberId !== undefined && body.expectedMemberId !== gymMemberId)) return NextResponse.json({ success: false, error: "Sign in to the account that recorded this workout." }, { status: 403 });
    const {
      sessionId,
      sessionDate,
      planId,
      workoutDayId,
      status = "COMPLETED",
      startedAt,
      completedAt,
      durationMinutes,
      skipReason,
      memberNotes,
      exerciseLogs = [],
    } = body;

    if (!Object.values(WorkoutSessionStatus).includes(status)) return NextResponse.json({ success: false, error: "Invalid session status." }, { status: 400 });
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 100) return NextResponse.json({ success: false, error: "A stable session ID is required." }, { status: 400 });
    if (!Array.isArray(exerciseLogs) || exerciseLogs.length > 500) return NextResponse.json({ success: false, error: "Invalid exercise log." }, { status: 400 });
    const sessionStatus = status as WorkoutSessionStatus;
    const now = new Date();
    const recordedAt = sessionDate ? new Date(sessionDate) : now;
    if (!Number.isFinite(recordedAt.getTime()) || recordedAt.getTime() > now.getTime() + 60000 || recordedAt.getTime() < now.getTime() - 90 * 86400000) return NextResponse.json({ success: false, error: "Workout date must be within the last 90 days." }, { status: 400 });

    const result = await prisma.$transaction(
      async (tx) => {
        await lockMember(tx, gymMemberId!);
        const plan = planId ? await tx.workoutPlan.findFirst({ where: { id: planId, gymMemberId: gymMemberId!, status: { in: ["PUBLISHED", "ARCHIVED"] } }, include: { workoutDays: { include: { exercises: true } } } }) : null;
        if (planId && !plan) throw new Error("Workout plan does not belong to this member.");
        const day = plan?.workoutDays.find(day => day.id === workoutDayId);
        if (workoutDayId && !day) throw new Error("Workout day does not belong to this plan.");
        if (exerciseLogs.some(log => log.workoutExerciseId && !day?.exercises.some(ex => ex.id === log.workoutExerciseId))) throw new Error("Exercise is not part of the selected workout day.");
        let session;

        // If sessionId was provided and exists, update it (stable ID idempotency)
        if (sessionId) {
          const existing = await tx.workoutSession.findUnique({
            where: { id: sessionId },
          });

          if (existing && (existing.gymMemberId !== gymMemberId || existing.planId !== (planId || null) || existing.workoutDayId !== (workoutDayId || null))) throw new Error("Session ID belongs to a different workout.");
          if (existing && existing.gymMemberId === gymMemberId) {
            session = await tx.workoutSession.update({
              where: { id: sessionId },
              data: {
                status: sessionStatus,
                completedAt: sessionStatus === WorkoutSessionStatus.COMPLETED ? (completedAt ? new Date(completedAt) : now) : null,
                durationMinutes: durationMinutes ? parseInt(durationMinutes) : existing.durationMinutes,
                skipReason: skipReason?.trim() || null,
                memberNotes: memberNotes?.trim() || null,
                isSynced: true,
              },
            });
          }
        }

        // If not found or not provided, create a new session
        if (!session) {
          // Get current version of plan if linked
          let planVersion = 1;
          if (planId) {
            const plan = await tx.workoutPlan.findUnique({ where: { id: planId } });
            if (plan) planVersion = plan.version;
          }

          session = await tx.workoutSession.create({
            data: {
              ...(sessionId ? { id: sessionId } : {}),
              gymMemberId,
              planId: planId || null,
              workoutDayId: workoutDayId || null,
              planVersion,
              sessionDate: recordedAt,
              status: sessionStatus,
              startedAt: startedAt ? new Date(startedAt) : now,
              completedAt: sessionStatus === WorkoutSessionStatus.COMPLETED ? (completedAt ? new Date(completedAt) : now) : null,
              durationMinutes: durationMinutes ? parseInt(durationMinutes) : 30,
              skipReason: skipReason?.trim() || null,
              memberNotes: memberNotes?.trim() || null,
              isSynced: true,
            },
          });
        }

        // Upsert / Save Exercise Logs
        if (Array.isArray(exerciseLogs)) {
          // Clean existing logs for this session to allow accurate edits without duplication
          await tx.exerciseLog.deleteMany({
            where: { sessionId: session.id },
          });

          for (let i = 0; i < exerciseLogs.length; i++) {
            const log = exerciseLogs[i];
            await tx.exerciseLog.create({
              data: {
                sessionId: session.id,
                workoutExerciseId: log.workoutExerciseId || null,
                exerciseName: log.exerciseName || `Exercise ${i + 1}`,
                exerciseType: (log.exerciseType as ExerciseType) || ExerciseType.STRENGTH,
                setNumber: log.setNumber ?? i + 1,
                plannedReps: log.plannedReps ? String(log.plannedReps) : null,
                plannedWeight: log.plannedWeight ? parseFloat(log.plannedWeight) : null,
                actualReps: log.actualReps !== undefined && log.actualReps !== null ? parseInt(log.actualReps) : null,
                actualWeight: log.actualWeight !== undefined && log.actualWeight !== null ? parseFloat(log.actualWeight) : null,
                actualDuration: log.actualDuration ? parseInt(log.actualDuration) : null,
                isSkipped: !!log.isSkipped,
                skipReason: log.skipReason?.trim() || null,
                notes: log.notes?.trim() || null,
              },
            });
          }
        }

        return session;
      },
      { maxWait: 10000, timeout: 25000 }
    );

    const fullSession = await prisma.workoutSession.findUnique({
      where: { id: result.id },
      include: {
        exerciseLogs: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workout session kamyabi se record ho gayi aur sync ho chuki hai.",
      data: fullSession,
    });
  } catch (error: any) {
    console.error("LOG_WORKOUT_SESSION_ERROR:", error);
    return NextResponse.json({ success: false, error: "Workout log record karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
