import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import crypto from "crypto";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json(
        { success: false, error: "Pehle login karein." },
        { status: 401 }
      );
    }

    // Owner and Receptionist can activate member app access
    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) {
      return NextResponse.json(
        { success: false, error: "Member app access activate karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { memberRecordId } = body;

    if (!memberRecordId) {
      return NextResponse.json(
        { success: false, error: "Member record ID lazmi hai." },
        { status: 400 }
      );
    }

    const member = await prisma.gymMember.findUnique({
      where: { id: memberRecordId },
      include: { user: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Gym member record nahi mila." },
        { status: 404 }
      );
    }

    if (member.userId && member.user) {
      return NextResponse.json(
        {
          success: false,
          error: `Is member ka login account pehle se active hai (Member ID: ${member.memberId}).`,
        },
        { status: 400 }
      );
    }

    // Generate single-use token and 6-digit numeric reception code
    const token = crypto.randomBytes(32).toString("hex");
    const numericCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const invitation = await prisma.invitation.create({
      data: {
        email: member.email || null,
        phone: member.phone,
        role: Role.MEMBER,
        token,
        activationCode: numericCode,
        memberRecordId: member.id,
        expiresAt,
        createdById: current.user.id,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "MEMBER_ACTIVATION_ISSUED",
        entityType: "GYM_MEMBER",
        entityId: member.id,
        details: JSON.stringify({
          memberId: member.memberId,
          memberName: member.fullName,
          hasEmail: !!member.email,
        }),
      },
    });

    const origin = req.nextUrl.origin;
    const activationLink = `${origin}/activate?token=${token}`;

    return NextResponse.json({
      success: true,
      message: member.email
        ? "Member activation link generate ho gaya hai."
        : "Reception single-use activation code issue ho gaya hai.",
      method: member.email ? "LINK" : "CODE",
      member: {
        id: member.id,
        memberId: member.memberId,
        fullName: member.fullName,
        email: member.email,
      },
      activationLink: member.email ? activationLink : null,
      activationCode: numericCode,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error("Member Activation API Error:", error);
    return NextResponse.json(
      { success: false, error: "Member access issue karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
