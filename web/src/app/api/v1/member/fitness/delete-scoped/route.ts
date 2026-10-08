import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

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
      scope, // "ALL" | "DATE_RANGE" | "CATEGORY"
      targetCategory,
      startDate,
      endDate,
    } = body;

    let deletedSummariesCount = 0;
    let deletedSessionsCount = 0;

    if (scope === "ALL") {
      const [delSumm, delSess] = await prisma.$transaction([
        prisma.dailyActivitySummary.deleteMany({
          where: { gymMemberId },
        }),
        prisma.syncedExerciseSession.deleteMany({
          where: { gymMemberId },
        }),
        prisma.fitnessSyncBatch.deleteMany({
          where: { gymMemberId },
        }),
      ]);
      deletedSummariesCount = delSumm.count;
      deletedSessionsCount = delSess.count;

      await prisma.fitnessConnection.updateMany({
        where: { gymMemberId },
        data: {
          lastSyncedAt: null,
          lastSyncStatus: null,
          lastSyncError: null,
        },
      });
    } else if (scope === "DATE_RANGE") {
      if (!startDate || !endDate) {
        return NextResponse.json({ success: false, error: "StartDate aur EndDate lazmi hain." }, { status: 400 });
      }

      const [delSumm, delSess] = await prisma.$transaction([
        prisma.dailyActivitySummary.deleteMany({
          where: {
            gymMemberId,
            date: { gte: startDate, lte: endDate },
          },
        }),
        prisma.syncedExerciseSession.deleteMany({
          where: {
            gymMemberId,
            startTime: {
              gte: new Date(startDate + "T00:00:00Z"),
              lte: new Date(endDate + "T23:59:59.999Z"),
            },
          },
        }),
      ]);
      deletedSummariesCount = delSumm.count;
      deletedSessionsCount = delSess.count;
    } else if (scope === "CATEGORY") {
      if (!targetCategory) {
        return NextResponse.json({ success: false, error: "TargetCategory lazmi hai." }, { status: 400 });
      }

      if (targetCategory === "STEPS") {
        const res = await prisma.dailyActivitySummary.updateMany({
          where: { gymMemberId },
          data: { steps: null },
        });
        deletedSummariesCount = res.count;
      } else if (targetCategory === "DISTANCE") {
        const [r1, r2] = await prisma.$transaction([
          prisma.dailyActivitySummary.updateMany({
            where: { gymMemberId },
            data: { distanceKm: null },
          }),
          prisma.syncedExerciseSession.updateMany({
            where: { gymMemberId },
            data: { distanceKm: null },
          }),
        ]);
        deletedSummariesCount = r1.count;
        deletedSessionsCount = r2.count;
      } else if (targetCategory === "ACTIVE_CALORIES") {
        const [r1, r2] = await prisma.$transaction([
          prisma.dailyActivitySummary.updateMany({
            where: { gymMemberId },
            data: { activeCalories: null },
          }),
          prisma.syncedExerciseSession.updateMany({
            where: { gymMemberId },
            data: { activeCalories: null },
          }),
        ]);
        deletedSummariesCount = r1.count;
        deletedSessionsCount = r2.count;
      } else if (targetCategory === "EXERCISE_SESSIONS") {
        const res = await prisma.syncedExerciseSession.deleteMany({
          where: { gymMemberId },
        });
        deletedSessionsCount = res.count;
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid deletion scope." }, { status: 400 });
    }

    // Record Deletion Audit
    await prisma.fitnessDeletionAudit.create({
      data: {
        gymMemberId,
        scope: scope || "ALL",
        targetCategory: targetCategory || null,
        startDate: startDate || null,
        endDate: endDate || null,
        deletedSummariesCount,
        deletedSessionsCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Scoped deletion kamyabi se mukammal ho gayi (${scope}). Source-app data aur gym records mehfooz hain.`,
      data: {
        scope,
        deletedSummariesCount,
        deletedSessionsCount,
      },
    });
  } catch (error: any) {
    console.error("POST scoped deletion error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to process deletion." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
