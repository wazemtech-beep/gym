import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, MeasurementSource } from "@prisma/client";
import { summarizeProgress } from "@/lib/progressSummary";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (current?.user.role === Role.RECEPTIONIST) return NextResponse.json({ success: false, error: "Private progress is not available to reception staff." }, { status: 403 });
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

    // Role-level security: Trainers can only view measurements for currently assigned members with explicit consent
    if (current.user.role === Role.TRAINER) {
      const activeAssignment = await prisma.trainerAssignment.findFirst({
        where: {
          gymMemberId,
          trainerId: current.user.id,
          ...effectiveTrainerAssignment(),
        },
      });

      if (!activeAssignment) {
        return NextResponse.json(
          {
            success: false,
            error: "Aap is member ke assigned trainer nahi hain. Measurements dekhne ki ijazat nahi hai.",
          },
          { status: 403 }
        );
      }

      if (!activeAssignment.consentMeasurements) {
        return NextResponse.json(
          {
            success: false,
            error: "Member ne trainer ke sath measurements aur progress photos sharing ka consent nahi diya hai.",
          },
          { status: 403 }
        );
      }
    }

    // 1. Fetch all measurements in chronological order
    const measurements = await prisma.progressMeasurement.findMany({
      where: { gymMemberId },
      orderBy: { date: "asc" },
      include: {
        recordedBy: { select: { name: true, role: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    // 2. Fetch active goal
    const goal = await prisma.progressGoal.findFirst({
      where: { gymMemberId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (measurements.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasEntries: false,
          baseline: null,
          latest: null,
          comparison: null,
          goal: goal || null,
          measurements: [],
        },
      });
    }

    // Identify baseline: explicitly marked baseline, or the earliest recorded entry
    const baseline = measurements.find((m) => m.isBaseline) || measurements[0];
    const latest = measurements[measurements.length - 1];

    // Compute change metrics (Baseline vs Latest)
    const comparison = {
      weightChangeKg:
        latest.weightKg !== null && baseline.weightKg !== null
          ? Number((latest.weightKg - baseline.weightKg).toFixed(2))
          : null,
      waistChangeCm:
        latest.waistCm !== null && baseline.waistCm !== null
          ? Number((latest.waistCm - baseline.waistCm).toFixed(2))
          : null,
      chestChangeCm:
        latest.chestCm !== null && baseline.chestCm !== null
          ? Number((latest.chestCm - baseline.chestCm).toFixed(2))
          : null,
      hipsChangeCm:
        latest.hipsCm !== null && baseline.hipsCm !== null
          ? Number((latest.hipsCm - baseline.hipsCm).toFixed(2))
          : null,
      armsChangeCm:
        latest.armsCm !== null && baseline.armsCm !== null
          ? Number((latest.armsCm - baseline.armsCm).toFixed(2))
          : null,
      thighsChangeCm:
        latest.thighsCm !== null && baseline.thighsCm !== null
          ? Number((latest.thighsCm - baseline.thighsCm).toFixed(2))
          : null,
      daysElapsed: Math.max(
        0,
        Math.round((latest.date.getTime() - baseline.date.getTime()) / (1000 * 60 * 60 * 24))
      ),
    };

    return NextResponse.json({
      success: true,
      data: {
        hasEntries: true,
        baseline,
        latest,
        comparison,
        metricSummary: summarizeProgress(measurements),
        goal: goal || null,
        measurements,
      },
    });
  } catch (error: any) {
    console.error("GET_PROGRESS_MEASUREMENTS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Progress readings load nahi huin." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    let gymMemberId: string | null = null;
    let isStaffAssisted = false;

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
      isStaffAssisted = true;
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
    }

    const body = await req.json();
    if (current.user.role === Role.RECEPTIONIST) return NextResponse.json({ success: false, error: "Private progress records are not accessible to reception staff." }, { status: 403 });
    const {
      date,
      isBaseline = false,
      weightKg,
      waistCm,
      chestCm,
      hipsCm,
      armsCm,
      thighsCm,
      notes,
      source = isStaffAssisted ? "STAFF_ASSISTED" : "MANUAL",
    } = body;

    if (current.user.role === Role.TRAINER) {
      const assignment = await prisma.trainerAssignment.findFirst({ where: { gymMemberId, trainerId: current.user.id, ...effectiveTrainerAssignment(), consentMeasurements: true } });
      if (!assignment) return NextResponse.json({ success: false, error: "Active assignment and member sharing consent are required." }, { status: 403 });
    }
    // Parsing & validation
    const numWeight = weightKg !== undefined && weightKg !== "" ? parseFloat(weightKg) : null;
    const numWaist = waistCm !== undefined && waistCm !== "" ? parseFloat(waistCm) : null;
    const numChest = chestCm !== undefined && chestCm !== "" ? parseFloat(chestCm) : null;
    const numHips = hipsCm !== undefined && hipsCm !== "" ? parseFloat(hipsCm) : null;
    const numArms = armsCm !== undefined && armsCm !== "" ? parseFloat(armsCm) : null;
    const numThighs = thighsCm !== undefined && thighsCm !== "" ? parseFloat(thighsCm) : null;

    if (numWeight === null && numWaist === null && numChest === null && numHips === null && numArms === null && numThighs === null) {
      return NextResponse.json(
        { success: false, error: "Kam az kam ek measurement (e.g. Weight ya Waist) darj karein." },
        { status: 400 }
      );
    }

    // Plausible positive ranges check
    if (numWeight !== null && (numWeight <= 20 || numWeight >= 350)) {
      return NextResponse.json({ success: false, error: "Plausible weight range (20 kg - 350 kg) darj karein." }, { status: 400 });
    }
    if (numWaist !== null && (numWaist <= 25 || numWaist >= 250)) {
      return NextResponse.json({ success: false, error: "Plausible waist range (25 cm - 250 cm) darj karein." }, { status: 400 });
    }

    const entryDate = date ? new Date(`${String(date).slice(0, 10)}T00:00:00+05:00`) : new Date();
    if (!Number.isFinite(entryDate.getTime()) || [numWeight, numWaist, numChest, numHips, numArms, numThighs].some(value => value !== null && !Number.isFinite(value))) return NextResponse.json({ success: false, error: "Valid date and measurements are required." }, { status: 400 });
    const day = new Date(entryDate.getTime() + 18000000).toISOString().slice(0, 10);
    const startOfDay = new Date(`${day}T00:00:00+05:00`);
    const endOfDay = new Date(`${day}T23:59:59.999+05:00`);

    // Check count of previous entries (if 0, auto-flag isBaseline: true)
    const existingCount = await prisma.progressMeasurement.count({
      where: { gymMemberId },
    });
    const autoBaseline = existingCount === 0 ? true : !!isBaseline;

    // Duplicate date check: does an entry for this same calendar day exist?
    const sameDayEntry = await prisma.progressMeasurement.findFirst({
      where: {
        gymMemberId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (sameDayEntry && !["EDIT", "SEPARATE"].includes(body.sameDayChoice)) return NextResponse.json({ success: false, sameDayConflict: true, error: "A reading already exists on this date. Choose Edit existing or Record separate reading." }, { status: 409 });
    const previous = await prisma.progressMeasurement.findFirst({ where: { gymMemberId, date: { lt: entryDate }, weightKg: { not: null } }, orderBy: { date: "desc" } });
    if (numWeight !== null && previous?.weightKg && Math.abs(numWeight - previous.weightKg) > 5 && !body.confirmUnusual) return NextResponse.json({ success: false, unusualEntry: true, error: "Weight differs by more than 5 kg from the previous reading. Confirm this measurement before saving." }, { status: 409 });
    let savedEntry;
    if (sameDayEntry && body.sameDayChoice === "EDIT") {
      // Edit / update existing reading for same date to prevent accidental duplicate entries
      savedEntry = await prisma.progressMeasurement.update({
        where: { id: sameDayEntry.id },
        data: {
          weightKg: numWeight ?? sameDayEntry.weightKg,
          waistCm: numWaist ?? sameDayEntry.waistCm,
          chestCm: numChest ?? sameDayEntry.chestCm,
          hipsCm: numHips ?? sameDayEntry.hipsCm,
          armsCm: numArms ?? sameDayEntry.armsCm,
          thighsCm: numThighs ?? sameDayEntry.thighsCm,
          notes: notes?.trim() || sameDayEntry.notes,
          source: (source as MeasurementSource) || sameDayEntry.source,
          recordedById: isStaffAssisted ? current.user.id : sameDayEntry.recordedById,
        },
      });
    } else {
      savedEntry = await prisma.progressMeasurement.create({
        data: {
          gymMemberId,
          date: entryDate,
          isBaseline: autoBaseline,
          weightKg: numWeight,
          waistCm: numWaist,
          chestCm: numChest,
          hipsCm: numHips,
          armsCm: numArms,
          thighsCm: numThighs,
          source: (source as MeasurementSource) || MeasurementSource.MANUAL,
          recordedById: isStaffAssisted ? current.user.id : null,
          notes: notes?.trim() || null,
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: sameDayEntry && body.sameDayChoice === "EDIT" ? "PROGRESS_MEASUREMENT_UPDATED" : "PROGRESS_MEASUREMENT_RECORDED",
        entityType: "PROGRESS_MEASUREMENT",
        entityId: savedEntry.id,
        details: JSON.stringify({
          memberId: gymMemberId,
          weightKg: savedEntry.weightKg,
          waistCm: savedEntry.waistCm,
          isBaseline: savedEntry.isBaseline,
          source: savedEntry.source,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: savedEntry.isBaseline
        ? "Baseline measurement kamyabi se record ho gayi."
        : "Progress measurement kamyabi se save ho gayi.",
      data: savedEntry,
    });
  } catch (error: any) {
    console.error("RECORD_PROGRESS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Progress entry save karne mein masla aya." }, { status: 500 });
  }
}

async function deleteHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const measurementId = searchParams.get("measurementId");

    if (!measurementId) {
      return NextResponse.json({ success: false, error: "Measurement ID darkaar hai." }, { status: 400 });
    }

    const measurement = await prisma.progressMeasurement.findUnique({
      where: { id: measurementId },
    });

    if (!measurement) {
      return NextResponse.json({ success: false, error: "Measurement record nahi mila." }, { status: 404 });
    }

    if (current.user.role === Role.MEMBER) {
      const member = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!member || member.id !== measurement.gymMemberId) {
        return NextResponse.json({ success: false, error: "Aap sirf apni measurements delete kar sakte hain." }, { status: 403 });
      }
    } else if (current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Measurement delete karne ki ijazat nahi hai." }, { status: 403 });
    }

    await prisma.progressMeasurement.delete({
      where: { id: measurementId },
    });

    return NextResponse.json({
      success: true,
      message: "Measurement record delete kar diya gaya hai.",
    });
  } catch (error: any) {
    console.error("DELETE_MEASUREMENT_ERROR:", error);
    return NextResponse.json({ success: false, error: "Measurement delete karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
export const DELETE = withReadCache(deleteHandler);
