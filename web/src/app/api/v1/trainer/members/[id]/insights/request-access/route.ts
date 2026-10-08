import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, NotificationCategory, FitnessDataCategory } from "@prisma/client";
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

    const body = await req.json().catch(() => ({}));
    const message = body.message || "Plan optimization aur daily energy monitoring ke liye fitness activity access request.";

    const request = await prisma.fitnessSharingRequest.create({
      data: {
        trainerId,
        gymMemberId: id,
        requestedCategories: [FitnessDataCategory.STEPS, FitnessDataCategory.EXERCISE_SESSIONS],
        message,
        status: "PENDING",
      },
    });

    if (member.userId) {
      await dispatchNotification({
        recipientUserId: member.userId,
        eventType: "TRAINER_ASSIGNMENT",
        title: "Fitness Sharing Request",
        message: `Coach ${current.user.name} ne fitness activity data review karne ki request bheji hai.`,
        category: NotificationCategory.TRAINING,
        actionUrl: "/dashboard",
        dedupKey: `sharing-request-${request.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Coach permission request member ko bhej di gayi (${member.fullName}). Member approve karega tab access milega.`,
      data: { request },
    });
  } catch (error: any) {
    console.error("POST request access error:", error);
    return NextResponse.json({ success: false, error: error.message || "Request bhejne mein khata aayi." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
