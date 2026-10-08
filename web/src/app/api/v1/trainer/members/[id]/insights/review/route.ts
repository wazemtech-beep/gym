import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, NotificationCategory } from "@prisma/client";
import { dispatchNotification } from "@/lib/notifications";

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
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }

    const { id } = await params;
    const trainerId = current.user.id;

    const member = await prisma.gymMember.findUnique({
      where: { id },
      include: {
        trainerAssignments: { where: { trainerId, ...effectiveTrainerAssignment() }, take: 1 },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member record nahi mila." }, { status: 404 });
    }

    if (current.user.role === Role.TRAINER && member.trainerId !== trainerId && member.trainerAssignments.length === 0) {
      return NextResponse.json({ success: false, error: "Aap is member ke assigned trainer nahi hain." }, { status: 403 });
    }

    const body = await req.json();
    const {
      reviewedStartDate,
      reviewedEndDate,
      observation,
      memberFeedback,
      suggestedAction,
      memberFacingNote,
      relatedWorkoutPlanId,
      relatedDietPlanId,
    } = body;

    if (!observation || typeof observation !== "string") {
      return NextResponse.json({ success: false, error: "Trainer observation / assessment lazmi hai." }, { status: 400 });
    }

    const review = await prisma.trainerActivityReview.create({
      data: {
        trainerId,
        gymMemberId: id,
        reviewedStartDate: reviewedStartDate || new Date().toISOString().slice(0, 10),
        reviewedEndDate: reviewedEndDate || new Date().toISOString().slice(0, 10),
        observation,
        memberFeedback: memberFeedback || null,
        suggestedAction: suggestedAction || "FOLLOW_UP",
        memberFacingNote: memberFacingNote || null,
        relatedWorkoutPlanId: relatedWorkoutPlanId || null,
        relatedDietPlanId: relatedDietPlanId || null,
      },
    });

    // If member-facing guidance is provided and member has account, notify member
    if (memberFacingNote && member.userId) {
      await dispatchNotification({
        recipientUserId: member.userId,
        eventType: "TRAINER_FEEDBACK",
        title: "Coach Guidance Update",
        message: `Coach ${current.user.name} ne aapki fitness activity review karke guidance note add kiya hai.`,
        category: NotificationCategory.TRAINING,
        actionUrl: "/dashboard",
        dedupKey: `trainer-review-${review.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Trainer observation record ho gayi.",
      data: { review },
    });
  } catch (error: any) {
    console.error("POST trainer review error:", error);
    return NextResponse.json({ success: false, error: error.message || "Review save karne mein khata aayi." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
