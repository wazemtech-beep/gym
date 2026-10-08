import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { sessionId } = await params;
    const body = await req.json();
    const { feedback } = body;

    if (!feedback || !feedback.trim()) {
      return NextResponse.json({ success: false, error: "Trainer feedback comments darj karein." }, { status: 400 });
    }

    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        gymMember: true,
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Workout session nahi mili." }, { status: 404 });
    }

    // Verify trainer is assigned to this member if role is TRAINER
    if (current.user.role === Role.TRAINER) {
      const isAssigned = await prisma.trainerAssignment.findFirst({
        where: {
          gymMemberId: session.gymMemberId,
          trainerId: current.user.id,
          ...effectiveTrainerAssignment(),
        },
      });

      if (!isAssigned) {
        return NextResponse.json(
          { success: false, error: "Aap is member ke assigned trainer nahi hain." },
          { status: 403 }
        );
      }
    }

    // Update feedback without touching member's actual logged sets/reps
    const updated = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        trainerFeedback: feedback.trim(),
        reviewedById: current.user.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "WORKOUT_FEEDBACK_ADDED",
        entityType: "WORKOUT_SESSION",
        entityId: sessionId,
        details: JSON.stringify({
          memberId: session.gymMemberId,
          trainerName: current.user.name,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Feedback mehfooz ho gaya aur member ke dashboard par update ho gaya.",
      data: updated,
    });
  } catch (error: any) {
    console.error("TRAINER_FEEDBACK_ERROR:", error);
    return NextResponse.json({ success: false, error: "Feedback save karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
