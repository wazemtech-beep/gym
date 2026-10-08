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

    if (current.user.role !== Role.MEMBER) return NextResponse.json({ success: false, error: "Only the member can manage personal fitness data and consent." }, { status: 403 });

    let gymMemberId: string | null = null;
    if (current.user.role === Role.MEMBER) {
      const member = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!member) {
        return NextResponse.json({ success: false, error: "Member profile nahi mili." }, { status: 404 });
      }
      gymMemberId = member.id;
    } else {
      const searchParams = req.nextUrl.searchParams;
      gymMemberId = searchParams.get("memberId");
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
    }

    const member = await prisma.gymMember.findUnique({
      where: { id: gymMemberId },
      include: {
        trainer: { select: { id: true, name: true } },
        trainerAssignments: {
          where: { ...effectiveTrainerAssignment() },
          orderBy: { startDate: "desc" },
          include: { trainer: { select: { id: true, name: true } } },
          take: 1,
        },
        fitnessConnection: true,
        fitnessSharingRequests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        },
        fitnessDeletionAudits: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member record nahi mila." }, { status: 404 });
    }

    const assignedTrainer = member.trainerAssignments[0]?.trainer ?? null;
    const conn = member.fitnessConnection;

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          memberId: member.memberId,
          fullName: member.fullName,
        },
        connection: conn || {
          status: "DISCONNECTED",
          platform: "HEALTH_CONNECT",
          reportedPermissions: [],
          backendUploadConsent: false,
          trainerSharingEnabled: false,
          trainerSharingCategories: [],
          historyRangeType: "ALL",
          historyRangeStart: null,
          lastSyncedAt: null,
        },
        assignedTrainer,
        pendingRequests: member.fitnessSharingRequests,
        recentDeletions: member.fitnessDeletionAudits,
      },
    });
  } catch (error: any) {
    console.error("GET fitness privacy error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load privacy details." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
