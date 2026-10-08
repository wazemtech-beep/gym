import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json(
        { success: false, error: "Check-in void karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: "Void karne ki waja (reason) likhna lazmi hai." },
        { status: 400 }
      );
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        gymMember: { select: { fullName: true, memberId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Attendance record nahi mila." }, { status: 404 });
    }

    if (existing.isVoid) {
      return NextResponse.json(
        { success: false, error: "Yeh record pehle hi void mark kiya ja chuka hai." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          isVoid: true,
          voidReason: reason.trim(),
          voidedAt: new Date(),
          voidedById: current.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "ATTENDANCE_VOIDED",
          entityType: "ATTENDANCE",
          entityId: record.id,
          details: JSON.stringify({
            memberId: existing.gymMember.memberId,
            memberName: existing.gymMember.fullName,
            reason: reason.trim(),
          }),
        },
      });

      return record;
    });

    return NextResponse.json({
      success: true,
      message: `Check-in for ${existing.gymMember.fullName} has been VOIDED.`,
      record: updated,
    });
  } catch (error) {
    console.error("Void Attendance Error:", error);
    return NextResponse.json(
      { success: false, error: "Check-in void karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
