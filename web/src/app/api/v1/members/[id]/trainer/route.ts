import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission } from "@/lib/permissions";
import { lockMember } from "@/lib/recordLocks";
import { prisma } from "@/lib/db";
import { Role, AccountStatus } from "@prisma/client";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;
    const assignments = await prisma.trainerAssignment.findMany({
      where: { gymMemberId: id },
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        assignedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: assignments });
  } catch (error: any) {
    console.error("GET_MEMBER_TRAINERS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Trainer assignments load nahi huin." }, { status: 500 });
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

    // Requirement 16 / TXT line 1144: Trainer assignment is strictly an OWNER-ONLY action
    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Trainer assign ya tabdeel karna sirf Gym Owner ka ikhtiyar hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      trainerId,
      startDate,
      endDate,
      coachingFocus,
      notes,
      consentMeasurements,
      consentHealthActivity,
    } = body;

    if (!trainerId) {
      return NextResponse.json({ success: false, error: "Trainer muntakhib karein." }, { status: 400 });
    }

    // Verify member exists
    const member = await prisma.gymMember.findUnique({
      where: { id },
    });
    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    // Verify trainer exists and is ACTIVE TRAINER
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
    });

    if (!trainer || trainer.role !== Role.TRAINER) {
      return NextResponse.json({ success: false, error: "Muntakhib fard Trainer role mein nahi hai." }, { status: 400 });
    }

    if (trainer.status !== AccountStatus.ACTIVE) {
      return NextResponse.json({ success: false, error: "Yeh trainer filhal active nahi hai." }, { status: 400 });
    }

    const effectiveStart = startDate ? new Date(startDate) : new Date();
    const effectiveEnd = endDate ? new Date(endDate) : null;
    if (!Number.isFinite(effectiveStart.getTime()) || (effectiveEnd && (!Number.isFinite(effectiveEnd.getTime()) || effectiveEnd < effectiveStart))) return NextResponse.json({ success: false, error: "Valid assignment dates are required." }, { status: 400 });
    const scheduled = effectiveStart > new Date();

    // Transaction to close existing active assignment and create new one
    const result = await prisma.$transaction(
      async (tx) => {
        await lockMember(tx, id);
        // Find existing active assignments
        const activeAssignments = await tx.trainerAssignment.findMany({
          where: {
            gymMemberId: id,
            isActive: true,
          },
        });

        // Close them
        for (const existing of activeAssignments) {
          await tx.trainerAssignment.update({
            where: { id: existing.id },
            data: {
              isActive: scheduled && existing.startDate < effectiveStart,
              endDate: new Date(effectiveStart.getTime() - 1),
            },
          });
        }

        // Create new assignment
        const newAssignment = await tx.trainerAssignment.create({
          data: {
            gymMemberId: id,
            trainerId,
            assignedById: current.user.id,
            startDate: effectiveStart,
            endDate: effectiveEnd,
            coachingFocus: coachingFocus?.trim() || null,
            notes: notes?.trim() || null,
            isActive: true,
            consentMeasurements: !!consentMeasurements,
            consentHealthActivity: !!consentHealthActivity,
          },
          include: {
            trainer: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        });

        // Update primary trainer link on GymMember
        if (!scheduled) await tx.gymMember.update({
          where: { id },
          data: {
            trainerId,
          },
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: activeAssignments.length > 0 ? "TRAINER_CHANGED" : "TRAINER_ASSIGNED",
            entityType: "TRAINER_ASSIGNMENT",
            entityId: newAssignment.id,
            details: JSON.stringify({
              memberId: id,
              memberName: member.fullName,
              trainerId,
              trainerName: trainer.name,
              coachingFocus,
              previousTrainersClosed: activeAssignments.length,
            }),
          },
        });

        return newAssignment;
      },
      { maxWait: 10000, timeout: 25000 }
    );

    return NextResponse.json({
      success: true,
      message: `${trainer.name} ko ${member.fullName} ka trainer assign kar diya gaya hai.`,
      data: result,
    });
  } catch (error: any) {
    console.error("ASSIGN_TRAINER_ERROR:", error);
    return NextResponse.json({ success: false, error: "Trainer assign karne mein masla aya." }, { status: 500 });
  }
}

async function deleteHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Trainer unassign karna sirf Gym Owner ka ikhtiyar hai." },
        { status: 403 }
      );
    }

    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      await lockMember(tx, id);
      await tx.trainerAssignment.updateMany({
        where: { gymMemberId: id, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });

      await tx.gymMember.update({
        where: { id },
        data: { trainerId: null },
      });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "TRAINER_UNASSIGNED",
          entityType: "TRAINER_ASSIGNMENT",
          entityId: id,
          details: JSON.stringify({ memberId: id }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Trainer kamiyabi se unassign kar diya gaya hai.",
    });
  } catch (error: any) {
    console.error("UNASSIGN_TRAINER_ERROR:", error);
    return NextResponse.json({ success: false, error: "Trainer unassign karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
export const DELETE = withReadCache(deleteHandler);
