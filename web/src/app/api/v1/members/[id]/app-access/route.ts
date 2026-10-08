import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { AccountStatus, Role } from "@prisma/client";
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

    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) {
      return NextResponse.json(
        { success: false, error: "App access manage karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // "ACTIVATE_INVITE" | "TOGGLE_SUSPEND" | "RESET_PASSWORD"

    const member = await prisma.gymMember.findFirst({
      where: { OR: [{ id }, { memberId: id }] },
      include: { user: true },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    if (action === "TOGGLE_SUSPEND") {
      if (!member.user) {
        return NextResponse.json(
          { success: false, error: "Is member ka app account abhi activate nahi hua." },
          { status: 400 }
        );
      }

      const nextStatus = member.user.status === AccountStatus.ACTIVE
        ? AccountStatus.SUSPENDED
        : AccountStatus.ACTIVE;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: member.user!.id },
          data: { status: nextStatus },
        });

        // If suspended, invalidate any active sessions
        if (nextStatus === AccountStatus.SUSPENDED) {
          await tx.session.deleteMany({
            where: { userId: member.user!.id },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: nextStatus === AccountStatus.SUSPENDED ? "MEMBER_APP_SUSPENDED" : "MEMBER_APP_REACTIVATED",
            entityType: "GYM_MEMBER",
            entityId: member.id,
            details: JSON.stringify({
              memberId: member.memberId,
              status: nextStatus,
            }),
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: nextStatus === AccountStatus.SUSPENDED
          ? `Member ${member.fullName} ka app access suspend kar diya gaya.`
          : `Member ${member.fullName} ka app access wapas active ho gaya.`,
        appAccessStatus: nextStatus,
      });
    }

    if (action === "ACTIVATE_INVITE") {
      // Check if user account already exists
      if (member.user && member.user.status === AccountStatus.ACTIVE) {
        return NextResponse.json({
          success: false,
          error: "Is member ka app login pehle se active hai.",
        });
      }

      // Generate 6-digit numeric activation code and unique token
      const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days validity

      // Create or update invitation
      const invitation = await prisma.invitation.create({
        data: {
          token,
          activationCode,
          phone: member.phone,
          email: member.email,
          role: Role.MEMBER,
          memberRecordId: member.id,
          createdById: current.user.id,
          expiresAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "MEMBER_APP_INVITATION_CREATED",
          entityType: "GYM_MEMBER",
          entityId: member.id,
          details: JSON.stringify({
            memberId: member.memberId,
            activationCode,
            token,
          }),
        },
      });

      const activationUrl = `/activate?token=${token}`;

      return NextResponse.json({
        success: true,
        message: `App access activation tayar hai! Member ko yeh code ya activation link share karein.`,
        activationCode,
        activationToken: token,
        activationUrl,
        expiresAt,
      });
    }

    return NextResponse.json({ success: false, error: "Ghalat action specify kiya gaya." }, { status: 400 });
  } catch (error) {
    console.error("Member App Access Error:", error);
    return NextResponse.json({ success: false, error: "App access manage karne mein khata aayi." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
