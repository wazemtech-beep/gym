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

    // Check if the trainer has an active assignment for this member (unless OWNER)
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

    const member = await prisma.gymMember.findUnique({
      where: { id },
      include: {
        trainerAssignments: {
          where: { ...effectiveTrainerAssignment() },
          take: 1,
        },
        workoutPlans: {
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
          orderBy: { createdAt: "desc" },
        },
        workoutSessions: {
          include: {
            exerciseLogs: true,
          },
          orderBy: { sessionDate: "desc" },
          take: 15,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    const activeAssignment = member.trainerAssignments[0] || null;

    // SANITIZATION: Strict exclusion of financial/payment/invoice fields
    const coachingProfile = {
      id: member.id,
      memberId: member.memberId,
      fullName: member.fullName,
      phone: member.phone,
      email: member.email,
      photoUrl: member.photoUrl,
      fitnessGoal: member.fitnessGoal,
      limitations: member.limitations,
      joiningDate: member.joiningDate,
      assignment: activeAssignment
        ? {
            id: activeAssignment.id,
            startDate: activeAssignment.startDate,
            coachingFocus: activeAssignment.coachingFocus,
            consentMeasurements: activeAssignment.consentMeasurements,
            consentHealthActivity: activeAssignment.consentHealthActivity,
          }
        : null,
      plans: member.workoutPlans,
      sessions: member.workoutSessions,
    };

    return NextResponse.json({ success: true, data: coachingProfile });
  } catch (error: any) {
    console.error("TRAINER_MEMBER_DETAIL_ERROR:", error);
    return NextResponse.json({ success: false, error: "Member details load nahi huin." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
