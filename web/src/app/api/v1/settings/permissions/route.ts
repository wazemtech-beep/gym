import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { revokeAllUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role, AccountStatus } from "@prisma/client";

async function getHandler() {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Staff permissions dekhne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const staffMembers = await prisma.user.findMany({
      where: { role: { in: [Role.RECEPTIONIST, Role.TRAINER] } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        permissionGrants: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      staff: staffMembers,
    });
  } catch (error) {
    console.error("Get Staff Permissions Error:", error);
    return NextResponse.json(
      { success: false, error: "Staff permissions load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Staff permissions update karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { targetUserId, staffUserId, permissionGrants, newRole, newStatus, reason } = body;
    const effectiveUserId = targetUserId || staffUserId;

    if (!effectiveUserId) {
      return NextResponse.json(
        { success: false, error: "Target User ID lazmi hai." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: effectiveUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User nahi mila." }, { status: 404 });
    }

    // Protection: cannot leave gym without an active owner
    if (targetUser.id === current.user.id) {
      if (newStatus === AccountStatus.SUSPENDED || (newRole && newRole !== Role.OWNER)) {
        return NextResponse.json(
          {
            success: false,
            error: "Owner apne aap ko suspend ya role demote nahi kar sakta. Gym owner ke baghair nahi chhora ja sakta.",
          },
          { status: 400 }
        );
      }
    }

    const dataToUpdate: Record<string, any> = {};
    if (permissionGrants !== undefined) {
      dataToUpdate.permissionGrants = permissionGrants;
    }
    if (newRole && (newRole === Role.RECEPTIONIST || newRole === Role.TRAINER || newRole === Role.OWNER)) {
      dataToUpdate.role = newRole;
    }
    if (newStatus && Object.values(AccountStatus).includes(newStatus)) {
      dataToUpdate.status = newStatus;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: effectiveUserId },
        data: dataToUpdate,
      });

      // Audit Log (Requirement 14.6 & 14.8)
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "STAFF_PERMISSIONS_UPDATED",
          entityType: "USER",
          entityId: effectiveUserId,
          reason: reason ? reason.trim() : null,
          details: JSON.stringify({
            staffName: targetUser.name,
            previousRole: targetUser.role,
            newRole: u.role,
            previousStatus: targetUser.status,
            newStatus: u.status,
            previousGrants: targetUser.permissionGrants,
            newGrants: u.permissionGrants,
            reason: reason || "Owner configuration",
          }),
        },
      });

      return u;
    }, { maxWait: 10000, timeout: 25000 });

    // Requirement 14.6: "Existing sessions revoke honge; next login par updated access milega."
    await revokeAllUserSessions(effectiveUserId);

    return NextResponse.json({
      success: true,
      message: `${updatedUser.name} ki permissions update ho gayi hain aur active sessions revoke kar diye gaye.`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        permissionGrants: updatedUser.permissionGrants,
      },
    });
  } catch (error) {
    console.error("Update Permissions Error:", error);
    return NextResponse.json(
      { success: false, error: "Staff permissions update karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
export const PATCH = POST;
