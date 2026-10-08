import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, FitnessConnectionStatus, FitnessDataCategory } from "@prisma/client";

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
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member record nahi mila." }, { status: 404 });
    }

    // Determine currently assigned coach
    const activeTrainer = member.trainerAssignments[0]?.trainer ?? null;

    let connection = member.fitnessConnection;
    if (!connection) {
      // Return default initial state
      connection = {
        id: "",
        gymMemberId: member.id,
        status: FitnessConnectionStatus.DISCONNECTED,
        platform: "HEALTH_CONNECT",
        appVersion: null,
        deviceModel: null,
        reportedPermissions: [],
        backendUploadConsent: false,
        backendUploadConsentVersion: null,
        backendUploadConsentAt: null,
        trainerSharingEnabled: false,
        trainerSharingCategories: [],
        trainerConfirmedCoachId: null,
        historyRangeType: "ALL",
        historyRangeStart: null,
        trainerSharingConsentVersion: null,
        trainerSharingConfirmedAt: null,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const isCoachReassigned = Boolean(connection?.trainerSharingEnabled) &&
      Boolean(connection?.trainerConfirmedCoachId) &&
      (!activeTrainer || activeTrainer.id !== connection?.trainerConfirmedCoachId);

    return NextResponse.json({
      success: true,
      data: {
        connection,
        assignedTrainer: activeTrainer,
        isCoachReassigned,
      },
    });
  } catch (error: any) {
    console.error("GET fitness connection error:", error);
    return NextResponse.json({ success: false, error: error.message || "Connection fetch error." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
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

    const body = await req.json();
    const {
      status,
      platform = "HEALTH_CONNECT",
      appVersion,
      deviceModel,
      reportedPermissions = [],
    } = body;

    // Validate reported permissions
    const validCategories = Object.values(FitnessDataCategory);
    const sanitizedPermissions = (reportedPermissions as string[]).filter((c) =>
      validCategories.includes(c as FitnessDataCategory)
    ) as FitnessDataCategory[];

    // Calculate effective connection status based on granted permissions
    let finalStatus = status as FitnessConnectionStatus;
    if (!finalStatus) {
      if (sanitizedPermissions.length === 0) {
        finalStatus = FitnessConnectionStatus.DISCONNECTED;
      } else if (sanitizedPermissions.length < validCategories.length) {
        finalStatus = FitnessConnectionStatus.LIMITED_PERMISSIONS;
      } else {
        finalStatus = FitnessConnectionStatus.CONNECTED;
      }
    }

    const connection = await prisma.fitnessConnection.upsert({
      where: { gymMemberId },
      create: {
        gymMemberId,
        status: finalStatus,
        platform,
        appVersion,
        deviceModel,
        reportedPermissions: sanitizedPermissions,
      },
      update: {
        status: finalStatus,
        platform,
        appVersion: appVersion !== undefined ? appVersion : undefined,
        deviceModel: deviceModel !== undefined ? deviceModel : undefined,
        reportedPermissions: sanitizedPermissions,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Connection status update ho gaya.",
      data: { connection },
    });
  } catch (error: any) {
    console.error("POST fitness connection error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update connection." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
