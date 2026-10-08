import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, FitnessDataCategory } from "@prisma/client";

interface IncomingSummary {
  date: string; // YYYY-MM-DD
  steps?: number | null;
  distanceKm?: number | null;
  activeCalories?: number | null;
  hasData?: boolean;
  source?: string;
  coverageNote?: string | null;
}

interface IncomingSession {
  sourceRecordId: string;
  exerciseType: string;
  title?: string | null;
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMinutes: number;
  activeCalories?: number | null;
  distanceKm?: number | null;
  source?: string;
  notes?: string | null;
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

    // Check connection status and backend upload consent
    const connection = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId },
    });

    if (!connection || connection.status === "DISCONNECTED") {
      return NextResponse.json(
        {
          success: false,
          error: "Fitness connection disconnected hai. Sync karne ke liye pehle dobara connect karein.",
        },
        { status: 400 }
      );
    }

    if (!connection.backendUploadConsent) {
      return NextResponse.json(
        {
          success: false,
          error: "Backend upload consent granted nahi hai. Selected summaries cloud par save karne ki ijazat darkaar hai.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      batchId,
      summaries = [] as IncomingSummary[],
      sessions = [] as IncomingSession[],
      deviceTimezone = "Asia/Karachi",
      explicitReimportConsent = false,
      allowReimportDeletedRange = false,
    } = body;

    if (!batchId || typeof batchId !== "string") {
      return NextResponse.json({ success: false, error: "Unique batchId darkaar hai." }, { status: 400 });
    }

    // Deletion boundary / replay protection fence (Requirement 24.2 / TXT line 3023)
    const deletionAudits = await prisma.fitnessDeletionAudit.findMany({
      where: { gymMemberId },
      orderBy: { createdAt: "desc" },
    });

    const lastAllDeletion = deletionAudits.find((d) => d.scope === "ALL");
    if (lastAllDeletion && !explicitReimportConsent) {
      return NextResponse.json(
        {
          success: false,
          error: "Pehle se delete kiya gaya fitness data baghair explicit re-import consent ke dubara sync nahi ho sakta.",
          requiresReimportConsent: true,
          deletedAt: lastAllDeletion.createdAt,
        },
        { status: 400 }
      );
    }

    const rangeDeletions = deletionAudits.filter((d) => d.scope === "DATE_RANGE" && d.startDate && d.endDate);
    if (!explicitReimportConsent && !allowReimportDeletedRange && rangeDeletions.length > 0) {
      const isDateInDeletedRange = (dateStr: string) =>
        rangeDeletions.some((rd) => rd.startDate! <= dateStr && dateStr <= rd.endDate!);

      const hasBlockedSummaries = summaries.some((s: IncomingSummary) => isDateInDeletedRange(s.date));
      if (hasBlockedSummaries) {
        return NextResponse.json(
          {
            success: false,
            error: "Muntakhib tareekhon ka data pehle delete kiya ja chuka hai. Re-import karne ke liye explicit confirmation lazmi hai.",
            requiresReimportConsent: true,
          },
          { status: 400 }
        );
      }
    }

    // Check idempotency: If batch was already processed, return idempotent response
    const existingBatch = await prisma.fitnessSyncBatch.findUnique({
      where: { batchId },
    });
    if (existingBatch) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: "Batch already processed previously.",
        data: {
          batchId: existingBatch.batchId,
          summaryCount: existingBatch.summaryCount,
          sessionCount: existingBatch.sessionCount,
        },
      });
    }

    const reportedPerms = new Set(connection.reportedPermissions);
    const allowSteps = reportedPerms.has(FitnessDataCategory.STEPS);
    const allowDistance = reportedPerms.has(FitnessDataCategory.DISTANCE);
    const allowCalories = reportedPerms.has(FitnessDataCategory.ACTIVE_CALORIES);
    const allowSessions = reportedPerms.has(FitnessDataCategory.EXERCISE_SESSIONS);

    // Process daily summaries with deduplication and in-place replacement
    let processedSummariesCount = 0;
    for (const item of summaries) {
      if (!item.date || typeof item.date !== "string") continue;

      const stepsVal = allowSteps && typeof item.steps === "number" ? Math.max(0, Math.round(item.steps)) : null;
      const distanceVal = allowDistance && typeof item.distanceKm === "number" ? Math.max(0, parseFloat(item.distanceKm.toFixed(2))) : null;
      const caloriesVal = allowCalories && typeof item.activeCalories === "number" ? Math.max(0, Math.round(item.activeCalories)) : null;
      const hasDataVal = item.hasData ?? (stepsVal !== null || distanceVal !== null || caloriesVal !== null);

      await prisma.dailyActivitySummary.upsert({
        where: {
          gymMemberId_date: {
            gymMemberId,
            date: item.date,
          },
        },
        create: {
          gymMemberId,
          date: item.date,
          steps: stepsVal,
          distanceKm: distanceVal,
          activeCalories: caloriesVal,
          hasData: hasDataVal,
          source: item.source || "HEALTH_CONNECT",
          coverageNote: item.coverageNote || null,
          lastSyncedAt: new Date(),
        },
        update: {
          // Strictly replace / update in place — NEVER accumulate or double-add
          steps: stepsVal !== null ? stepsVal : undefined,
          distanceKm: distanceVal !== null ? distanceVal : undefined,
          activeCalories: caloriesVal !== null ? caloriesVal : undefined,
          hasData: hasDataVal,
          source: item.source || undefined,
          coverageNote: item.coverageNote !== undefined ? item.coverageNote : undefined,
          lastSyncedAt: new Date(),
        },
      });
      processedSummariesCount++;
    }

    // Process exercise sessions if permitted
    let processedSessionsCount = 0;
    if (allowSessions) {
      for (const sess of sessions) {
        if (!sess.sourceRecordId || !sess.exerciseType || !sess.startTime || !sess.endTime) continue;

        const start = new Date(sess.startTime);
        const end = new Date(sess.endTime);
        const duration = sess.durationMinutes || Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

        await prisma.syncedExerciseSession.upsert({
          where: {
            gymMemberId_sourceRecordId: {
              gymMemberId,
              sourceRecordId: sess.sourceRecordId,
            },
          },
          create: {
            gymMemberId,
            sourceRecordId: sess.sourceRecordId,
            exerciseType: sess.exerciseType,
            title: sess.title || null,
            startTime: start,
            endTime: end,
            durationMinutes: duration,
            activeCalories: allowCalories && typeof sess.activeCalories === "number" ? Math.round(sess.activeCalories) : null,
            distanceKm: allowDistance && typeof sess.distanceKm === "number" ? parseFloat(sess.distanceKm.toFixed(2)) : null,
            source: sess.source || "HEALTH_CONNECT",
            notes: sess.notes || null,
            lastSyncedAt: new Date(),
          },
          update: {
            exerciseType: sess.exerciseType,
            title: sess.title !== undefined ? sess.title : undefined,
            startTime: start,
            endTime: end,
            durationMinutes: duration,
            activeCalories: allowCalories && typeof sess.activeCalories === "number" ? Math.round(sess.activeCalories) : undefined,
            distanceKm: allowDistance && typeof sess.distanceKm === "number" ? parseFloat(sess.distanceKm.toFixed(2)) : undefined,
            source: sess.source || undefined,
            notes: sess.notes !== undefined ? sess.notes : undefined,
            lastSyncedAt: new Date(),
          },
        });
        processedSessionsCount++;
      }
    }

    // Record sync batch for idempotency and audit
    await prisma.fitnessSyncBatch.create({
      data: {
        gymMemberId,
        batchId,
        deviceTimezone,
        summaryCount: processedSummariesCount,
        sessionCount: processedSessionsCount,
        status: "SUCCESS",
      },
    });

    // Update connection status and lastSyncedAt
    const now = new Date();
    await prisma.fitnessConnection.update({
      where: { gymMemberId },
      data: {
        lastSyncedAt: now,
        lastSyncStatus: "SUCCESS",
        lastSyncError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Fitness batch kamyabi se sync ho gaya.",
      data: {
        batchId,
        processedSummaries: processedSummariesCount,
        processedSessions: processedSessionsCount,
        lastSyncedAt: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("POST fitness sync error:", error);
    return NextResponse.json({ success: false, error: error.message || "Sync processing error." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
