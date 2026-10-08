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
      return NextResponse.json(
        { success: false, error: "Pehle login karein." },
        { status: 401 }
      );
    }

    // Only OWNER can invite or create staff
    if (!hasUserPermission(current.user, "STAFF_CREATE_ROLE_CHANGE")) {
      return NextResponse.json(
        { success: false, error: "Staff invite karne ki ijazat sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, phone, role } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { success: false, error: "Name, email aur role lazmi hain." },
        { status: 400 }
      );
    }

    const targetRole = role.toUpperCase() as Role;
    if (targetRole !== Role.RECEPTIONIST && targetRole !== Role.TRAINER) {
      return NextResponse.json(
        { success: false, error: "Staff ka role Receptionist ya Trainer hona chahiye." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Is email ke sath user pehle se mojood hai.",
        },
        { status: 400 }
      );
    }

    // Generate limited-time single-use activation token (valid 48 hours)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Create user in INVITATION_PENDING status & Invitation record in one transaction
    const [newUser, invitation] = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          phone: phone ? phone.trim() : null,
          role: targetRole,
          status: AccountStatus.INVITATION_PENDING,
          mustChangePassword: false,
        },
      });

      const inv = await tx.invitation.create({
        data: {
          email: cleanEmail,
          phone: phone ? phone.trim() : null,
          role: targetRole,
          token,
          expiresAt,
          createdById: current.user.id,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "STAFF_INVITED",
          entityType: "USER",
          entityId: user.id,
          details: JSON.stringify({
            invitedName: name,
            invitedEmail: cleanEmail,
            role: targetRole,
            invitationId: inv.id,
          }),
        },
      });

      return [user, inv];
    });

    const origin = req.nextUrl.origin;
    const activationLink = `${origin}/activate?token=${token}`;

    return NextResponse.json({
      success: true,
      message: `${targetRole} ki invitation generate ho gayi hai.`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
      activationLink,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error("Staff Invite API Error:", error);
    return NextResponse.json(
      { success: false, error: "Staff invite karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
