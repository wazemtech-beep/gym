import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import crypto from "crypto";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Receptionist or Owner only
    if (
      current.user.role !== Role.OWNER &&
      !hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")
    ) {
      return NextResponse.json(
        { success: false, error: "Member reset code issue karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const member = await prisma.gymMember.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    if (!member.userId || !member.user) {
      return NextResponse.json(
        { success: false, error: "Is member ka user account create nahi hua." },
        { status: 400 }
      );
    }

    // Invalidate previous active reset codes for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: member.userId, usedAt: null },
      data: { expiresAt: new Date(0) },
    });

    // Generate 6-digit numeric code valid for 15 minutes
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.passwordResetToken.create({
      data: {
        userId: member.userId,
        token,
        resetCode: randomCode,
        expiresAt,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "RECEPTION_RESET_CODE_ISSUED",
        entityType: "USER",
        entityId: member.userId,
        details: JSON.stringify({
          memberId: member.memberId,
          memberName: member.fullName,
          issuedBy: current.user.name,
          expiresInMinutes: 15,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Reset Code kamyabi se generate ho gaya. Member ko 15 minutes ke andar yeh code faraham karein.`,
      resetCode: randomCode,
      expiresInMinutes: 15,
      member: {
        id: member.id,
        fullName: member.fullName,
        memberId: member.memberId,
        phone: member.phone,
      },
    });
  } catch (error: any) {
    console.error("ISSUE_RESET_CODE_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Reset code generate karne mein masla aya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
