import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { InvoiceStatus, MemberRecordStatus } from "@prisma/client";
import { normalizePhoneNumber } from "@/lib/members";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) {
      return NextResponse.json(
        { success: false, error: "Member profile access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Support lookup by DB ID or Member ID (OXG-XXXXXX)
    const member = await prisma.gymMember.findFirst({
      where: {
        OR: [{ id }, { memberId: id }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            role: true,
            mustChangePassword: true,
            createdAt: true,
          },
        },
        trainer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        memberships: {
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          orderBy: { issueDate: "desc" },
          include: {
            allocations: {
              include: {
                payment: {
                  select: {
                    id: true,
                    receiptNumber: true,
                    paymentDate: true,
                    method: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          include: {
            receivingAccount: {
              select: { displayName: true, type: true },
            },
            recordedBy: {
              select: { name: true },
            },
          },
        },
        attendance: {
          orderBy: { checkIn: "desc" },
          take: 50,
        },
        trainerAssignments: {
          orderBy: { createdAt: "desc" },
          include: {
            trainer: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member nahi mila." },
        { status: 404 }
      );
    }

    // Fetch audit trail for this member
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityId: member.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Compute financial summaries
    const totalDues = member.invoices
      .filter((inv) => inv.status === InvoiceStatus.UNPAID || inv.status === InvoiceStatus.PARTIALLY_PAID)
      .reduce((sum, inv) => sum + inv.balanceAmount, 0);

    const totalPaid = member.payments.reduce((sum, pay) => sum + pay.amount, 0);

    // Latest active or upcoming membership
    const currentMembership = member.memberships[0] || null;

    let appAccessStatus = "NOT_ACTIVATED";
    if (member.user) {
      appAccessStatus = member.user.status;
    }

    return NextResponse.json({
      success: true,
      member: {
        ...member,
        totalDues,
        totalPaid,
        currentMembership,
        appAccessStatus,
      },
      auditLogs,
    });
  } catch (error) {
    console.error("Get Member Detail Error:", error);
    return NextResponse.json(
      { success: false, error: "Member profile load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function putHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) {
      return NextResponse.json(
        { success: false, error: "Member update karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.gymMember.findFirst({
      where: {
        OR: [{ id }, { memberId: id }],
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    const {
      fullName,
      phone,
      email,
      dateOfBirth,
      address,
      emergencyContactName,
      emergencyContactPhone,
      fitnessGoal,
      limitations,
      staffNote,
    } = body;

    const updates: any = {};
    const changes: Record<string, { from: any; to: any }> = {};

    if (fullName && fullName.trim() !== existing.fullName) {
      changes.fullName = { from: existing.fullName, to: fullName.trim() };
      updates.fullName = fullName.trim();
    }

    if (phone) {
      const normPhone = normalizePhoneNumber(phone);
      if (normPhone !== existing.phone) {
        // Check duplicate phone on other members
        const duplicate = await prisma.gymMember.findFirst({
          where: {
            phone: normPhone,
            id: { not: existing.id },
          },
        });
        if (duplicate) {
          return NextResponse.json(
            {
              success: false,
              error: `Yeh phone number pehle se member ${duplicate.fullName} (${duplicate.memberId}) ke paas hai.`,
            },
            { status: 400 }
          );
        }
        changes.phone = { from: existing.phone, to: normPhone };
        updates.phone = normPhone;
      }
    }

    if (email !== undefined) {
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      if (cleanEmail !== existing.email) {
        changes.email = { from: existing.email, to: cleanEmail };
        updates.email = cleanEmail;
      }
    }

    if (dateOfBirth !== undefined) {
      const dobDate = dateOfBirth ? new Date(dateOfBirth) : null;
      changes.dateOfBirth = { from: existing.dateOfBirth, to: dobDate };
      updates.dateOfBirth = dobDate;
    }

    if (address !== undefined && address !== existing.address) {
      changes.address = { from: existing.address, to: address };
      updates.address = address;
    }

    if (emergencyContactName !== undefined && emergencyContactName !== existing.emergencyContactName) {
      changes.emergencyContactName = { from: existing.emergencyContactName, to: emergencyContactName };
      updates.emergencyContactName = emergencyContactName;
    }

    if (emergencyContactPhone !== undefined) {
      const normEmergPhone = emergencyContactPhone ? normalizePhoneNumber(emergencyContactPhone) : null;
      if (normEmergPhone !== existing.emergencyContactPhone) {
        changes.emergencyContactPhone = { from: existing.emergencyContactPhone, to: normEmergPhone };
        updates.emergencyContactPhone = normEmergPhone;
      }
    }

    if (fitnessGoal !== undefined && fitnessGoal !== existing.fitnessGoal) {
      changes.fitnessGoal = { from: existing.fitnessGoal, to: fitnessGoal };
      updates.fitnessGoal = fitnessGoal;
    }

    if (limitations !== undefined && limitations !== existing.limitations) {
      changes.limitations = { from: existing.limitations, to: limitations };
      updates.limitations = limitations;
    }

    if (staffNote !== undefined && staffNote !== existing.staffNote) {
      changes.staffNote = { from: existing.staffNote, to: staffNote };
      updates.staffNote = staffNote;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        message: "Koi tabdeeli nahi hui.",
        member: existing,
      });
    }

    const updatedMember = await prisma.$transaction(async (tx) => {
      const updated = await tx.gymMember.update({
        where: { id: existing.id },
        data: updates,
      });

      // Record Audit Log with exact change details
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "MEMBER_DETAILS_UPDATED",
          entityType: "GYM_MEMBER",
          entityId: existing.id,
          details: JSON.stringify({
            memberId: existing.memberId,
            changes,
          }),
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Member ki details kamiyabi se update ho gayin!",
      member: updatedMember,
    });
  } catch (error) {
    console.error("Update Member Error:", error);
    return NextResponse.json(
      { success: false, error: "Member update karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const PUT = withReadCache(putHandler);
