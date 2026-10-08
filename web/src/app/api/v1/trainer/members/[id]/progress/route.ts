import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

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

    let assignment = null;
    if (current.user.role === Role.TRAINER) {
      assignment = await prisma.trainerAssignment.findFirst({
        where: {
          gymMemberId: id,
          trainerId: current.user.id,
          ...effectiveTrainerAssignment(),
        },
      });

      if (!assignment) {
        return NextResponse.json(
          { success: false, error: "Aap is member ke assigned trainer nahi hain." },
          { status: 403 }
        );
      }

      // Check Consent for Measurements
      if (!assignment.consentMeasurements) {
        return NextResponse.json({
          success: true,
          data: {
            consentGranted: false,
            message: "Member ne trainer ke sath measurements/photos sharing ka consent nahi diya hai.",
            measurements: [],
            photos: [],
          },
        });
      }
    }

    // Fetch measurements
    const measurements = await prisma.progressMeasurement.findMany({
      where: { gymMemberId: id },
      orderBy: { date: "asc" },
      include: {
        recordedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    // Fetch ONLY shared photos (Spec: Photos default member-only; sharing separately opt-in)
    const photos = await prisma.progressPhoto.findMany({
      where: {
        gymMemberId: id,
        shareWithTrainer: true,
      },
      orderBy: { date: "desc" },
    });

    const goal = await prisma.progressGoal.findFirst({
      where: { gymMemberId: id },
      orderBy: { createdAt: "desc" },
    });

    const baseline = measurements.find((m) => m.isBaseline) || measurements[0] || null;
    const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;

    let comparison = null;
    if (baseline && latest && measurements.length > 1) {
      comparison = {
        weightChangeKg:
          latest.weightKg !== null && baseline.weightKg !== null
            ? Number((latest.weightKg - baseline.weightKg).toFixed(2))
            : null,
        waistChangeCm:
          latest.waistCm !== null && baseline.waistCm !== null
            ? Number((latest.waistCm - baseline.waistCm).toFixed(2))
            : null,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        consentGranted: true,
        baseline,
        latest,
        comparison,
        goal: goal || null,
        measurements,
        photos,
      },
    });
  } catch (error: any) {
    console.error("GET_TRAINER_PROGRESS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Progress readings load nahi huin." }, { status: 500 });
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
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { measurementId, feedback } = body;

    if (!measurementId || !feedback || !feedback.trim()) {
      return NextResponse.json(
        { success: false, error: "Measurement ID aur feedback comments lazmi hain." },
        { status: 400 }
      );
    }

    const measurement = await prisma.progressMeasurement.findUnique({
      where: { id: measurementId },
    });

    if (!measurement || measurement.gymMemberId !== id) {
      return NextResponse.json({ success: false, error: "Measurement entry nahi mili." }, { status: 404 });
    }

    if (current.user.role === Role.TRAINER && !await prisma.trainerAssignment.findFirst({
      where: { gymMemberId: id, trainerId: current.user.id, ...effectiveTrainerAssignment(), consentMeasurements: true },
    })) return NextResponse.json({ success: false, error: "Active trainer assignment and member sharing consent are required." }, { status: 403 });

    // Stamped feedback without overwriting member readings
    const updated = await prisma.progressMeasurement.update({
      where: { id: measurementId },
      data: {
        trainerFeedback: feedback.trim(),
        reviewedById: current.user.id,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Coaching feedback kamyabi se mehfooz ho gaya.",
      data: updated,
    });
  } catch (error: any) {
    console.error("POST_TRAINER_PROGRESS_FEEDBACK_ERROR:", error);
    return NextResponse.json({ success: false, error: "Feedback save karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
