import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Role, AccountStatus } from "@prisma/client";
import { revokeAllUserSessions } from "@/lib/auth";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json(
        { success: false, error: "Pehle login karein." },
        { status: 401 }
      );
    }

    // Only OWNER can change staff role or suspend accounts
    if (!hasUserPermission(current.user, "STAFF_CREATE_ROLE_CHANGE")) {
      return NextResponse.json(
        { success: false, error: "Yeh amal sirf Owner ke liye makhsoos hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { targetUserId, newRole, newStatus, reason } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: "Target user ID lazmi hai." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User nahi mila." },
        { status: 404 }
      );
    }

    // Cannot suspend or demote yourself (the owner) leaving gym ownerless
    if (targetUser.id === current.user.id) {
      if (newStatus === AccountStatus.SUSPENDED || (newRole && newRole !== Role.OWNER)) {
        return NextResponse.json(
          {
            success: false,
            error: "Owner apne aap ko suspend ya role demote nahi kar sakta.",
          },
          { status: 400 }
        );
      }
    }

    const updateData: { role?: Role; status?: AccountStatus } = {};
    if (newRole) updateData.role = newRole as Role;
    if (newStatus) updateData.status = newStatus as AccountStatus;

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
    });

    // Requirement: Immediate session revocation on role change or suspension!
    await revokeAllUserSessions(targetUserId);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: newStatus === AccountStatus.SUSPENDED ? "ACCOUNT_SUSPENDED" : "ROLE_CHANGED",
        entityType: "USER",
        entityId: targetUserId,
        details: JSON.stringify({
          previousRole: targetUser.role,
          newRole: updatedUser.role,
          previousStatus: targetUser.status,
          newStatus: updatedUser.status,
          reason: reason || "Owner action",
          allSessionsRevoked: true,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `User record update ho gaya aur tamam active sessions revoke kar diye gaye.`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error("Staff Status API Error:", error);
    return NextResponse.json(
      { success: false, error: "User status tabdeel karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
