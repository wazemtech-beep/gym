import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }

    const trainerId = current.user.id;

    // Find assigned members
    const members = await prisma.gymMember.findMany({
      where: {
        OR: [
          { trainerId: trainerId },
          { trainerAssignments: { some: { trainerId: trainerId, ...effectiveTrainerAssignment() } } },
        ],
      },
      include: {
        fitnessConnection: true,
        fitnessSharingRequests: {
          where: { trainerId, status: "PENDING" },
          take: 1,
        },
        trainerActivityReviews: {
          where: { trainerId },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { fullName: "asc" },
    });

    const now = new Date();

    const membersList = members.map((m) => {
      const conn = m.fitnessConnection;
      let sharingStatus = "SHARING_OFF";
      let sharedCategories: string[] = [];

      if (conn && conn.trainerSharingEnabled) {
        if (conn.trainerConfirmedCoachId && conn.trainerConfirmedCoachId !== trainerId) {
          sharingStatus = "REASSIGNED_PENDING_CONFIRMATION";
        } else {
          sharingStatus = "ACTIVE";
          sharedCategories = conn.trainerSharingCategories;
        }
      }

      // Check if sync is stale (> 3 days)
      let isSyncStale = false;
      if (conn?.lastSyncedAt) {
        const diffMs = now.getTime() - new Date(conn.lastSyncedAt).getTime();
        if (diffMs > 3 * 24 * 60 * 60 * 1000) {
          isSyncStale = true;
        }
      }

      const isPermissionsReduced = Boolean(conn && conn.reportedPermissions.length < 4);
      const hasPendingRequest = m.fitnessSharingRequests.length > 0;
      const lastReview = m.trainerActivityReviews[0] || null;

      return {
        memberId: m.id,
        memberCode: m.memberId,
        fullName: m.fullName,
        phone: m.phone,
        photoUrl: m.photoUrl,
        sharingStatus,
        sharedCategories,
        lastSyncedAt: conn?.lastSyncedAt || null,
        isSyncStale,
        isPermissionsReduced,
        hasPendingRequest,
        lastReviewedAt: lastReview?.createdAt || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        members: membersList,
        totalAssigned: membersList.length,
      },
    });
  } catch (error: any) {
    console.error("GET trainer insights members list error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load members." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
