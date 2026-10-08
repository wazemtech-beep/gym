import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, WorkoutPlanStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Sirf trainer apne assigned members dekh sakta hai." },
        { status: 403 }
      );
    }

    // Determine trainerId: if trainer, enforce current.user.id; if owner, allow query param or all
    let targetTrainerId = current.user.id;
    if (current.user.role === Role.OWNER) {
      const searchParams = req.nextUrl.searchParams;
      const paramTrainerId = searchParams.get("trainerId");
      if (paramTrainerId) {
        targetTrainerId = paramTrainerId;
      }
    }

    // Fetch active assignments for this trainer
    const assignments = await prisma.trainerAssignment.findMany({
      where: {
        trainerId: targetTrainerId,
        ...effectiveTrainerAssignment(),
      },
      include: {
        gymMember: {
          select: {
            id: true,
            memberId: true,
            fullName: true,
            phone: true,
            email: true,
            photoUrl: true,
            fitnessGoal: true,
            limitations: true,
            joiningDate: true,
            workoutPlans: {
              where: { status: WorkoutPlanStatus.PUBLISHED },
              select: {
                id: true,
                title: true,
                goal: true,
                version: true,
                weeklySchedule: true,
                status: true,
              },
              take: 1,
            },
            workoutSessions: {
              orderBy: { sessionDate: "desc" },
              take: 3,
              select: {
                id: true,
                sessionDate: true,
                status: true,
                durationMinutes: true,
                trainerFeedback: true,
                reviewedAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // PRIVACY SANITIZATION:
    // Strictly verify NO invoice, payment, receipt or revenue data is returned
    const membersData = assignments.map((a) => ({
      assignmentId: a.id,
      startDate: a.startDate,
      coachingFocus: a.coachingFocus,
      consentMeasurements: a.consentMeasurements,
      consentHealthActivity: a.consentHealthActivity,
      member: {
        id: a.gymMember.id,
        memberId: a.gymMember.memberId,
        fullName: a.gymMember.fullName,
        phone: a.gymMember.phone,
        email: a.gymMember.email,
        photoUrl: a.gymMember.photoUrl,
        fitnessGoal: a.gymMember.fitnessGoal,
        limitations: a.gymMember.limitations,
        joiningDate: a.gymMember.joiningDate,
        activePlan: a.gymMember.workoutPlans[0] || null,
        recentSessions: a.gymMember.workoutSessions,
      },
    }));

    return NextResponse.json({
      success: true,
      data: membersData,
    });
  } catch (error: any) {
    console.error("TRAINER_MEMBERS_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Assigned members load karne mein masla aya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
