import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, WorkoutPlanStatus, NotificationCategory } from "@prisma/client";
import { dispatchNotification, enqueueNotification } from "@/lib/notifications";
import { lockMember } from "@/lib/recordLocks";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";

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
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { id } = await params;
    const plan = await prisma.workoutPlan.findUnique({
      where: { id },
      include: {
        gymMember: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Workout plan nahi mila." }, { status: 404 });
    }

    if (current.user.role === Role.TRAINER && plan.trainerId !== current.user.id) {
      return NextResponse.json(
        { success: false, error: "Aap sirf apna banaya hua plan publish kar sakte hain." },
        { status: 403 }
      );
    }

    if (current.user.role === Role.TRAINER && !await prisma.trainerAssignment.findFirst({ where: { gymMemberId: plan.gymMemberId, trainerId: current.user.id, ...effectiveTrainerAssignment() } })) return NextResponse.json({ success: false, error: "You are no longer assigned to this member." }, { status: 403 });

    const updated = await prisma.$transaction(
      async (tx) => {
        await lockMember(tx, plan.gymMemberId);
        if (current.user.role === Role.TRAINER && !await tx.trainerAssignment.findFirst({ where: { gymMemberId: plan.gymMemberId, trainerId: current.user.id, ...effectiveTrainerAssignment() } })) throw new Error("Trainer assignment changed before publishing.");
        const livePlan = await tx.workoutPlan.findUniqueOrThrow({ where: { id } });
        if (livePlan.status === "PUBLISHED") return livePlan;
        // Archive previous published plans for this member
        if (plan.startDate <= new Date()) await tx.workoutPlan.updateMany({
          where: {
            gymMemberId: plan.gymMemberId,
            status: WorkoutPlanStatus.PUBLISHED,
            id: { not: id },
            startDate: { lte: plan.startDate },
          },
          data: {
            status: WorkoutPlanStatus.ARCHIVED,
          },
        });

        // Set this plan to PUBLISHED
        const published = await tx.workoutPlan.update({
          where: { id },
          data: {
            status: WorkoutPlanStatus.PUBLISHED,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "WORKOUT_PLAN_PUBLISHED",
            entityType: "WORKOUT_PLAN",
            entityId: id,
            details: JSON.stringify({
              memberId: plan.gymMemberId,
              planTitle: plan.title,
              version: plan.version,
            }),
          },
        });

        if (plan.gymMember.userId) await enqueueNotification(tx, { recipientUserId: plan.gymMember.userId, eventType: "WORKOUT_PUBLISHED", title: "Workout published", message: `Your workout ${plan.title} is ready.`, category: NotificationCategory.TRAINING, entityType: "WORKOUT_PLAN", entityId: plan.id, actionUrl: "/dashboard", dedupKey: `workout-pub-${plan.id}` });
        return published;
      },
      { maxWait: 10000, timeout: 25000 }
    );

    // Feature 20: Notify member of published routine
    if (plan.gymMember.userId) {
      dispatchNotification({
        recipientUserId: plan.gymMember.userId,
        eventType: "WORKOUT_PUBLISHED",
        title: "New Workout Routine Published",
        message: `Aapke coach ne naya workout routine "${plan.title}" publish kar diya hai. Aaj ka session shuru karein!`,
        category: NotificationCategory.TRAINING,
        entityType: "WORKOUT_PLAN",
        entityId: plan.id,
        actionUrl: "/dashboard",
        dedupKey: `workout-pub-${plan.id}`,
      }).catch((e) => console.error("Workout publish notification error:", e));
    }

    return NextResponse.json({
      success: true,
      message: "Workout plan kamyabi se publish ho gaya! Member ke dashboard par available hai.",
      data: updated,
    });
  } catch (error: any) {
    console.error("PUBLISH_PLAN_ERROR:", error);
    return NextResponse.json({ success: false, error: "Plan publish karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
