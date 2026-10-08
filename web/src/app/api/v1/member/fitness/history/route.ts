import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function deleteHandler(req: NextRequest) {
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

    // Delete synced summaries, exercise sessions, and sync batches
    const [deletedSummaries, deletedSessions, deletedBatches] = await prisma.$transaction([
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

    // Reset sync timestamps on connection record
    await prisma.fitnessConnection.updateMany({
      where: { gymMemberId },
      data: {
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "OXGEN se imported fitness history mukammal delete kar di gayi. Phone source records intact hain.",
      data: {
        deletedSummaries: deletedSummaries.count,
        deletedSessions: deletedSessions.count,
        deletedBatches: deletedBatches.count,
      },
    });
  } catch (error: any) {
    console.error("DELETE fitness history error:", error);
    return NextResponse.json({ success: false, error: error.message || "History delete karne mein khata aayi." }, { status: 500 });
  }
}

export const DELETE = withReadCache(deleteHandler);
