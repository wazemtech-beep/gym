import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { logId } = await params;
    const body = await req.json();
    const { feedback } = body;

    if (!feedback || !feedback.trim()) {
      return NextResponse.json({ success: false, error: "Feedback comments darj karein." }, { status: 400 });
    }

    const log = await prisma.dietAdherenceLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return NextResponse.json({ success: false, error: "Meal log record nahi mila." }, { status: 404 });
    }

    if (current.user.role === Role.TRAINER && !await prisma.trainerAssignment.findFirst({ where: { gymMemberId: log.gymMemberId, trainerId: current.user.id, ...effectiveTrainerAssignment() } })) {
      return NextResponse.json({ success: false, error: "Aap is member ke assigned trainer nahi hain." }, { status: 403 });
    }

    const updated = await prisma.dietAdherenceLog.update({
      where: { id: logId },
      data: {
        trainerFeedback: feedback.trim(),
        reviewedById: current.user.id,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Coaching feedback save ho gaya.",
      data: updated,
    });
  } catch (error: any) {
    console.error("DIET_FEEDBACK_ERROR:", error);
    return NextResponse.json({ success: false, error: "Feedback save karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
