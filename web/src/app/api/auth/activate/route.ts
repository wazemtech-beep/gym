import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AccountStatus, Role } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, activationCode, password } = body;
    if (String(token || "").startsWith("EMAIL_CHANGE:")) return NextResponse.json({ success: false, error: "Use the email verification link." }, { status: 400 });

    if ((!token && !activationCode) || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Activation token/code aur naya password dono darkaar hain.",
        },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) {
      return NextResponse.json(
        {
          success: false,
          error: "Password kam az kam 8 characters ka hona chahiye.",
        },
        { status: 400 }
      );
    }

    // Find invitation by token OR activationCode
    const invitation = await prisma.invitation.findFirst({
      where: {
        OR: [
          token ? { token } : {},
          activationCode ? { activationCode } : {},
        ],
      },
      include: {
        memberRecord: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: "Activation link ya code ghalat hai." },
        { status: 404 }
      );
    }

    if (invitation.usedAt) {
      return NextResponse.json(
        {
          success: false,
          error: "Yeh activation link/code pehle hi istemaal ho chuka hai.",
        },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: "Yeh activation link/code expire ho chuka hai. Staff se dobara issue karwayein.",
        },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Determine target user
    let userToActivate = invitation.email
      ? await prisma.user.findFirst({
          where: { email: invitation.email },
        })
      : null;

    // Execute in transaction: activate user, link member, mark invitation used, create session
    const [activeUser, sessionToken] = await prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({ where: { id: invitation.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("ACTIVATION_USED");
      // If user does not exist yet (e.g. member activated with reception code), create user account linked to member
      if (!userToActivate && invitation.memberRecord) {
        userToActivate = await tx.user.create({
          data: {
            name: invitation.memberRecord.fullName,
            email: invitation.memberRecord.email || null,
            memberId: invitation.memberRecord.memberId,
            phone: invitation.memberRecord.phone,
            passwordHash,
            role: Role.MEMBER,
            status: AccountStatus.ACTIVE,
            mustChangePassword: false,
          },
        });

        // Link gym member record to this user account
        await tx.gymMember.update({
          where: { id: invitation.memberRecord.id },
          data: { userId: userToActivate.id },
        });
      } else if (userToActivate) {
        // Existing user (e.g. staff invited)
        userToActivate = await tx.user.update({
          where: { id: userToActivate.id },
          data: {
            passwordHash,
            status: AccountStatus.ACTIVE,
            mustChangePassword: false,
          },
        });

        // If memberRecord exists, link it
        if (invitation.memberRecordId) {
          await tx.gymMember.update({
            where: { id: invitation.memberRecordId },
            data: { userId: userToActivate.id },
          });
        }
      } else {
        throw new Error("Activation target user not found");
      }

      // Create initial session token
      const tokenStr = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await tx.session.create({
        data: {
          userId: userToActivate.id,
          token: tokenStr,
          expiresAt,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: userToActivate.id,
          actorName: userToActivate.name,
          actorRole: userToActivate.role,
          action: "ACCOUNT_ACTIVATED",
          entityType: "USER",
          entityId: userToActivate.id,
          details: JSON.stringify({
            role: userToActivate.role,
            method: token ? "LINK" : "CODE",
          }),
        },
      });

      return [userToActivate, tokenStr];
    }, { maxWait: 10000, timeout: 30000 });

    let redirectUrl = "/login";
    if (activeUser.role === Role.OWNER) redirectUrl = "/admin/dashboard";
    else if (activeUser.role === Role.RECEPTIONIST) redirectUrl = "/admin/reception/dashboard";
    else if (activeUser.role === Role.TRAINER) redirectUrl = "/admin/trainer/dashboard";
    else if (activeUser.role === Role.MEMBER) redirectUrl = "/dashboard";

    const response = NextResponse.json({
      success: true,
      message: "Account kamiyabi se active ho gaya hai!",
      user: {
        id: activeUser.id,
        name: activeUser.name,
        role: activeUser.role,
        memberId: activeUser.memberId,
      },
      token: sessionToken,
      redirectUrl,
    });

    // Set cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVATION_USED") return NextResponse.json({ success: false, error: "Activation link expire ho chuka hai ya pehle use ho gaya hai." }, { status: 400 });
    console.error("Activation API Error:", error);
    return NextResponse.json(
      { success: false, error: "Account activate karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
