import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, WorkoutPlanStatus, ExerciseType } from "@prisma/client";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;
    const plans = await prisma.workoutPlan.findMany({
      where: { gymMemberId: id },
      include: {
        trainer: {
          select: { id: true, name: true },
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error: any) {
    console.error("GET_PLANS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Workout plans load nahi huay." }, { status: 500 });
  }
}

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Sirf trainer workout plan bana sakta hai." }, { status: 403 });
    }

    const { id } = await params;
    const member = await prisma.gymMember.findUnique({
      where: { id },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    // Verify trainer assignment if not OWNER
    if (current.user.role === Role.TRAINER) {
      const activeAssignment = await prisma.trainerAssignment.findFirst({
        where: {
          gymMemberId: id,
          trainerId: current.user.id,
          ...effectiveTrainerAssignment(),
        },
      });

      if (!activeAssignment) {
        return NextResponse.json(
          { success: false, error: "Aap is member ke assigned trainer nahi hain." },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const {
      title,
      goal,
      startDate,
      endDate,
      weeklySchedule,
      notes,
      workoutDays = [],
      status = "DRAFT",
    } = body;

    if (!title || !goal) {
      return NextResponse.json(
        { success: false, error: "Plan title aur coaching goal lazmi hain." },
        { status: 400 }
      );
    }

    const effectiveStart = startDate ? new Date(startDate) : new Date();
    const effectiveEnd = endDate ? new Date(endDate) : null;
    const planStatus = status === "PUBLISHED" ? WorkoutPlanStatus.PUBLISHED : WorkoutPlanStatus.DRAFT;

    const result = await prisma.$transaction(
      async (tx) => {
        // If publishing directly, archive prior published plans
        if (planStatus === WorkoutPlanStatus.PUBLISHED) {
          await tx.workoutPlan.updateMany({
            where: {
              gymMemberId: id,
              status: WorkoutPlanStatus.PUBLISHED,
            },
            data: {
              status: WorkoutPlanStatus.ARCHIVED,
            },
          });
        }

        // Count previous plans to set version number
        const prevCount = await tx.workoutPlan.count({
          where: { gymMemberId: id },
        });

        // Create the WorkoutPlan
        const plan = await tx.workoutPlan.create({
          data: {
            title: title.trim(),
            goal: goal.trim(),
            startDate: effectiveStart,
            endDate: effectiveEnd,
            weeklySchedule: weeklySchedule?.trim() || "Monday, Wednesday, Friday",
            notes: notes?.trim() || null,
            status: planStatus,
            version: prevCount + 1,
            gymMemberId: id,
            trainerId: current.user.id,
          },
        });

        // Create days and exercises
        for (let dayIdx = 0; dayIdx < workoutDays.length; dayIdx++) {
          const day = workoutDays[dayIdx];
          const createdDay = await tx.workoutDay.create({
            data: {
              planId: plan.id,
              title: day.title?.trim() || `Day ${dayIdx + 1}`,
              dayOfWeek: day.dayOfWeek ? day.dayOfWeek.toUpperCase() : null,
              dayNumber: dayIdx + 1,
              order: day.order ?? dayIdx,
            },
          });

          if (Array.isArray(day.exercises)) {
            for (let exIdx = 0; exIdx < day.exercises.length; exIdx++) {
              const ex = day.exercises[exIdx];
              await tx.workoutExercise.create({
                data: {
                  workoutDayId: createdDay.id,
                  name: ex.name?.trim() || `Exercise ${exIdx + 1}`,
                  type: (ex.type as ExerciseType) || ExerciseType.STRENGTH,
                  sets: ex.sets ? parseInt(ex.sets) : null,
                  reps: ex.reps ? String(ex.reps).trim() : null,
                  targetLoad: ex.targetLoad ? String(ex.targetLoad).trim() : null,
                  durationMinutes: ex.durationMinutes ? parseInt(ex.durationMinutes) : null,
                  distanceMeters: ex.distanceMeters ? parseInt(ex.distanceMeters) : null,
                  restSeconds: ex.restSeconds !== undefined && ex.restSeconds !== "" ? Math.max(0, parseInt(ex.restSeconds)) : 60,
                  instructions: ex.instructions?.trim() || null,
                  alternativeExercise: ex.alternativeExercise?.trim() || null,
                  demoVideoUrl: ex.demoVideoUrl?.trim() || null,
                  order: ex.order ?? exIdx,
                },
              });
            }
          }
        }

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: planStatus === WorkoutPlanStatus.PUBLISHED ? "WORKOUT_PLAN_PUBLISHED" : "WORKOUT_PLAN_DRAFTED",
            entityType: "WORKOUT_PLAN",
            entityId: plan.id,
            details: JSON.stringify({
              memberId: id,
              planTitle: plan.title,
              version: plan.version,
              daysCount: workoutDays.length,
            }),
          },
        });

        return plan;
      },
      { maxWait: 10000, timeout: 25000 }
    );

    // Fetch full plan with nested days & exercises
    const fullPlan = await prisma.workoutPlan.findUnique({
      where: { id: result.id },
      include: {
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

    return NextResponse.json({
      success: true,
      message:
        planStatus === WorkoutPlanStatus.PUBLISHED
          ? "Workout plan kamyabi se publish ho gaya!"
          : "Workout plan draft mehfooz ho gaya.",
      data: fullPlan,
    });
  } catch (error: any) {
    console.error("CREATE_WORKOUT_PLAN_ERROR:", error);
    return NextResponse.json({ success: false, error: "Workout plan banane mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
