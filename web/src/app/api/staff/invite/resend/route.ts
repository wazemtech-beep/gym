import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Role, AccountStatus } from "@prisma/client";
import crypto from "crypto";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "STAFF_CREATE_ROLE_CHANGE") && current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Staff invitation resend karne ki ijazat sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, email } = body;

    if (!userId && !email) {
      return NextResponse.json({ success: false, error: "UserId ya Email darkaar hai." }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          ...(email ? [{ email: String(email).trim().toLowerCase() }] : []),
        ],
      },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User nahi mila." }, { status: 404 });
    }

    if (targetUser.status === AccountStatus.ACTIVE) {
      return NextResponse.json(
        {
          success: false,
          error: "Yeh user account pehle se active hai. Invitation resend karne ki zaroorat nahi.",
        },
        { status: 400 }
      );
    }

    // 1. Invalidate all previous pending invitations for this email/phone (TXT Line 121)
    if (targetUser.email) {
      await prisma.invitation.updateMany({
        where: {
          email: targetUser.email,
          usedAt: null,
        },
        data: {
          expiresAt: new Date(0), // Instantly expire previous link
        },
      });
    }

    // 2. Generate fresh 48-hour activation token
    const newToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const newInvitation = await prisma.invitation.create({
      data: {
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        token: newToken,
        expiresAt,
        createdById: current.user.id,
      },
    });

    // 3. Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "STAFF_INVITATION_RESENT",
        entityType: "USER",
        entityId: targetUser.id,
        details: JSON.stringify({
          staffName: targetUser.name,
          email: targetUser.email,
          previousLinksInvalidated: true,
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });

    const inviteUrl = `/activate?token=${newToken}`;

    return NextResponse.json({
      success: true,
      message: `${targetUser.name} ke liye naya activation link generate ho gaya hai. Purane links invalidate kar diye gaye hain.`,
      inviteUrl,
      token: newToken,
      expiresAt,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
    });
  } catch (error: any) {
    console.error("RESEND_STAFF_INVITE_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Invitation resend karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
