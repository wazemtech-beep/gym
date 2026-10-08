import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, DietPlanStatus, NotificationCategory } from "@prisma/client";
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
    const plan = await prisma.dietPlan.findUnique({
      where: { id },
      include: {
        gymMember: true,
        mealSlots: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Diet plan nahi mila." }, { status: 404 });
    }

    if (current.user.role === Role.TRAINER && plan.trainerId !== current.user.id) {
      return NextResponse.json(
        { success: false, error: "Aap sirf apna banaya hua diet plan publish kar sakte hain." },
        { status: 403 }
      );
    }

    if (current.user.role === Role.TRAINER && !await prisma.trainerAssignment.findFirst({ where: { gymMemberId: plan.gymMemberId, trainerId: current.user.id, ...effectiveTrainerAssignment() } })) return NextResponse.json({ success: false, error: "You are no longer assigned to this member." }, { status: 403 });
    const preferences = await prisma.memberDietPreference.findUnique({ where: { gymMemberId: plan.gymMemberId } });
    const allergens = (preferences?.allergies || "").toLowerCase().split(/[,;\n]+/).map(word => word.trim()).filter(Boolean);
    const conflicts = plan.mealSlots.filter(slot => allergens.some(allergen => `${slot.title} ${slot.foodItems} ${slot.alternatives || ""}`.toLowerCase().includes(allergen)));
    if (conflicts.length) return NextResponse.json({ success: false, error: "Review the current allergy preferences and replace conflicting foods before publishing.", conflicts: conflicts.map(slot => slot.title) }, { status: 409 });

    const updated = await prisma.$transaction(
      async (tx) => {
        await lockMember(tx, plan.gymMemberId);
        if (current.user.role === Role.TRAINER && !await tx.trainerAssignment.findFirst({ where: { gymMemberId: plan.gymMemberId, trainerId: current.user.id, ...effectiveTrainerAssignment() } })) throw new Error("Trainer assignment changed before publishing.");
        const livePlan = await tx.dietPlan.findUniqueOrThrow({ where: { id } });
        if (livePlan.status === "PUBLISHED") return livePlan;
        // Archive previous published plans for this member
        if (plan.startDate <= new Date()) await tx.dietPlan.updateMany({
          where: {
            gymMemberId: plan.gymMemberId,
            status: DietPlanStatus.PUBLISHED,
            id: { not: id },
            startDate: { lte: plan.startDate },
          },
          data: {
            status: DietPlanStatus.ARCHIVED,
          },
        });

        const published = await tx.dietPlan.update({
          where: { id },
          data: {
            status: DietPlanStatus.PUBLISHED,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "DIET_PLAN_PUBLISHED",
            entityType: "DIET_PLAN",
            entityId: id,
            details: JSON.stringify({
              memberId: plan.gymMemberId,
              planTitle: plan.title,
              version: plan.version,
            }),
          },
        });

        if (plan.gymMember.userId) await enqueueNotification(tx, { recipientUserId: plan.gymMember.userId, eventType: "DIET_PUBLISHED", title: "Diet plan published", message: `Your diet plan ${plan.title} is ready.`, category: NotificationCategory.TRAINING, entityType: "DIET_PLAN", entityId: plan.id, actionUrl: "/dashboard", dedupKey: `diet-pub-${plan.id}` });
        return published;
      },
      { maxWait: 10000, timeout: 25000 }
    );

    // Feature 20: Notify member of published diet plan
    if (plan.gymMember?.userId) {
      dispatchNotification({
        recipientUserId: plan.gymMember.userId,
        eventType: "DIET_PUBLISHED",
        title: "New Diet & Meal Plan Published",
        message: `Aapke coach ne naya diet routine "${plan.title}" assign kiya hai. Aaj ke meal portions check karein!`,
        category: NotificationCategory.TRAINING,
        entityType: "DIET_PLAN",
        entityId: plan.id,
        actionUrl: "/dashboard",
        dedupKey: `diet-pub-${plan.id}`,
      }).catch((e) => console.error("Diet publish notification error:", e));
    }

    return NextResponse.json({
      success: true,
      message: "Diet plan publish ho gaya aur member ke dashboard par active hai.",
      data: updated,
    });
  } catch (error: any) {
    console.error("PUBLISH_DIET_PLAN_ERROR:", error);
    return NextResponse.json({ success: false, error: "Plan publish karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
