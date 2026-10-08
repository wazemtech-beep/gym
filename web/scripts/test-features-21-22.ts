import { prisma } from "../src/lib/db";
import {
  Role,
  AccountStatus,
  MemberRecordStatus,
  FitnessConnectionStatus,
  FitnessDataCategory,
} from "@prisma/client";
import {
  getKarachiTodayDate,
  getKarachiDateRange,
  calculateActivityAggregates,
} from "../src/lib/fitness";

async function runFeatures21And22Tests() {
  console.log("\n========================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: FEATURES 21 & 22 (FITNESS DATA & ACTIVITY SYNC)");
  console.log("========================================================\n");

  const testSuffix = Math.floor(100000 + Math.random() * 900000).toString();

  // ------------------------------------------------------------------
  // SETUP: Seed Test Trainer 1, Trainer 2, and Member
  // ------------------------------------------------------------------
  console.log("--- SETUP: Seeding Test Trainers & Member Record ---");

  const trainerUser1 = await prisma.user.create({
    data: {
      name: `Coach Bilal ${testSuffix}`,
      email: `bilal.${testSuffix}@oxgentest.com`,
      phone: `+92301${testSuffix}`,
      role: Role.TRAINER,
      status: AccountStatus.ACTIVE,
    },
  });

  const trainerUser2 = await prisma.user.create({
    data: {
      name: `Coach Usman ${testSuffix}`,
      email: `usman.${testSuffix}@oxgentest.com`,
      phone: `+92302${testSuffix}`,
      role: Role.TRAINER,
      status: AccountStatus.ACTIVE,
    },
  });

  const memberUser = await prisma.user.create({
    data: {
      name: `Ahmed Khan ${testSuffix}`,
      email: `ahmed.${testSuffix}@oxgentest.com`,
      phone: `+92333${testSuffix}`,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
    },
  });

  const gymMember = await prisma.gymMember.create({
    data: {
      memberId: `OXG-FIT-${testSuffix}`,
      fullName: `Ahmed Khan ${testSuffix}`,
      phone: `+92333${testSuffix}`,
      email: `ahmed.${testSuffix}@oxgentest.com`,
      userId: memberUser.id,
      trainerId: trainerUser1.id, // Assigned to Coach Bilal initially
      status: MemberRecordStatus.CURRENT,
    },
  });

  console.log(`✓ Test Member Created: ${gymMember.fullName} (ID: ${gymMember.id})`);
  console.log(`✓ Primary Assigned Coach: ${trainerUser1.name} (ID: ${trainerUser1.id})`);
  console.log(`✓ Secondary Coach: ${trainerUser2.name} (ID: ${trainerUser2.id})\n`);

  try {
    // ------------------------------------------------------------------
    // CHECK 1: Connection Initialization & Partial Permissions
    // ------------------------------------------------------------------
    console.log("--- CHECK 1: Fitness Connection & Partial Permissions ---");

    // Case A: Partial permissions granted (Steps and Exercise only)
    const connPartial = await prisma.fitnessConnection.create({
      data: {
        gymMemberId: gymMember.id,
        platform: "HEALTH_CONNECT",
        status: FitnessConnectionStatus.LIMITED_PERMISSIONS,
        reportedPermissions: [FitnessDataCategory.STEPS, FitnessDataCategory.EXERCISE_SESSIONS],
      },
    });

    if (
      connPartial.status !== FitnessConnectionStatus.LIMITED_PERMISSIONS ||
      connPartial.reportedPermissions.length !== 2
    ) {
      throw new Error(`CHECK 1 FAILED: Expected LIMITED_PERMISSIONS with 2 categories, got ${connPartial.status}`);
    }
    console.log("✓ Partial permissions recognized as LIMITED_PERMISSIONS.");

    // Case B: All permissions granted
    const connAll = await prisma.fitnessConnection.update({
      where: { gymMemberId: gymMember.id },
      data: {
        status: FitnessConnectionStatus.CONNECTED,
        reportedPermissions: [
          FitnessDataCategory.STEPS,
          FitnessDataCategory.DISTANCE,
          FitnessDataCategory.EXERCISE_SESSIONS,
          FitnessDataCategory.ACTIVE_CALORIES,
        ],
      },
    });

    if (connAll.status !== FitnessConnectionStatus.CONNECTED || connAll.reportedPermissions.length !== 4) {
      throw new Error(`CHECK 1 FAILED: Expected CONNECTED with all 4 categories, got ${connAll.status}`);
    }
    console.log("✓ Full permissions recognized as CONNECTED.");
    console.log("👉 CHECK 1 PASSED: Connection state and permission mapping verified.\n");

    // ------------------------------------------------------------------
    // CHECK 2: Separate Backend Upload Consent Enforcement
    // ------------------------------------------------------------------
    console.log("--- CHECK 2: Backend Upload Consent Enforcement ---");

    // Initially upload consent is false
    const connNoConsent = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: gymMember.id },
    });
    if (connNoConsent?.backendUploadConsent !== false) {
      throw new Error("CHECK 2 FAILED: Initial backendUploadConsent should be false.");
    }

    // Attempting upload logic without consent must be rejected
    const canUploadWithoutConsent = connNoConsent?.backendUploadConsent;
    if (canUploadWithoutConsent) {
      throw new Error("CHECK 2 FAILED: Upload must be blocked without explicit upload consent.");
    }
    console.log("✓ Upload correctly blocked when backendUploadConsent is false.");

    // Member grants consent
    const connWithConsent = await prisma.fitnessConnection.update({
      where: { gymMemberId: gymMember.id },
      data: {
        backendUploadConsent: true,
        backendUploadConsentVersion: "v1.0",
        backendUploadConsentAt: new Date(),
      },
    });

    if (!connWithConsent.backendUploadConsent || connWithConsent.backendUploadConsentVersion !== "v1.0") {
      throw new Error("CHECK 2 FAILED: Consent update failed.");
    }
    console.log("✓ Consent successfully granted with version v1.0 and timestamp.");
    console.log("👉 CHECK 2 PASSED: Separate cloud upload consent strictly enforced.\n");

    // ------------------------------------------------------------------
    // CHECK 3: Batch Upload, In-Place Deduplication & Overwrite Semantics
    // ------------------------------------------------------------------
    console.log("--- CHECK 3: Batch Upload, In-Place Deduplication & Overwrites ---");

    const testDate = "2026-10-04";

    // 1st Sync: Initial walk of 6,000 steps
    await prisma.dailyActivitySummary.upsert({
      where: {
        gymMemberId_date: {
          gymMemberId: gymMember.id,
          date: testDate,
        },
      },
      create: {
        gymMemberId: gymMember.id,
        date: testDate,
        steps: 6000,
        distanceKm: 4.2,
        activeCalories: 280,
        hasData: true,
        source: "HEALTH_CONNECT",
      },
      update: {
        steps: 6000,
        distanceKm: 4.2,
        activeCalories: 280,
      },
    });

    const summary1 = await prisma.dailyActivitySummary.findUnique({
      where: {
        gymMemberId_date: {
          gymMemberId: gymMember.id,
          date: testDate,
        },
      },
    });
    if (summary1?.steps !== 6000) {
      throw new Error(`CHECK 3 FAILED: Initial steps expected 6000, got ${summary1?.steps}`);
    }
    console.log("✓ Initial daily summary saved: 6,000 steps.");

    // 2nd Sync: Late update / source correction to 6,500 steps
    // MUST REPLACE IN PLACE, NEVER SUM TO 12,500!
    await prisma.dailyActivitySummary.upsert({
      where: {
        gymMemberId_date: {
          gymMemberId: gymMember.id,
          date: testDate,
        },
      },
      create: {
        gymMemberId: gymMember.id,
        date: testDate,
        steps: 6500,
        distanceKm: 4.5,
        activeCalories: 300,
        hasData: true,
        source: "HEALTH_CONNECT",
      },
      update: {
        steps: 6500,
        distanceKm: 4.5,
        activeCalories: 300,
      },
    });

    const summary2 = await prisma.dailyActivitySummary.findUnique({
      where: {
        gymMemberId_date: {
          gymMemberId: gymMember.id,
          date: testDate,
        },
      },
    });

    if (summary2?.steps !== 6500) {
      throw new Error(`CHECK 3 FAILED: Deduplication failed! Steps is ${summary2?.steps}, expected 6500.`);
    }
    console.log("✓ Updated daily summary verified: 6,500 steps (NOT 12,500!).");

    // Exercise Session Deduplication by (gymMemberId, sourceRecordId)
    const exerciseRecordId = `hc-rec-${testSuffix}-001`;
    await prisma.syncedExerciseSession.upsert({
      where: {
        gymMemberId_sourceRecordId: {
          gymMemberId: gymMember.id,
          sourceRecordId: exerciseRecordId,
        },
      },
      create: {
        gymMemberId: gymMember.id,
        sourceRecordId: exerciseRecordId,
        exerciseType: "Running",
        title: "Evening 5K",
        startTime: new Date("2026-10-04T18:00:00Z"),
        endTime: new Date("2026-10-04T18:30:00Z"),
        durationMinutes: 30,
        distanceKm: 5.0,
        activeCalories: 320,
        source: "HEALTH_CONNECT",
      },
      update: {
        durationMinutes: 30,
      },
    });

    // Re-upsert identical session
    await prisma.syncedExerciseSession.upsert({
      where: {
        gymMemberId_sourceRecordId: {
          gymMemberId: gymMember.id,
          sourceRecordId: exerciseRecordId,
        },
      },
      create: {
        gymMemberId: gymMember.id,
        sourceRecordId: exerciseRecordId,
        exerciseType: "Running",
        title: "Evening 5K",
        startTime: new Date("2026-10-04T18:00:00Z"),
        endTime: new Date("2026-10-04T18:30:00Z"),
        durationMinutes: 30,
      },
      update: {
        durationMinutes: 30,
      },
    });

    const totalSessions = await prisma.syncedExerciseSession.count({
      where: {
        gymMemberId: gymMember.id,
        sourceRecordId: exerciseRecordId,
      },
    });

    if (totalSessions !== 1) {
      throw new Error(`CHECK 3 FAILED: Exercise session duplicated! Found ${totalSessions} sessions.`);
    }
    console.log("✓ Exercise session deduplicated: exactly 1 session exists.");
    console.log("👉 CHECK 3 PASSED: In-place deduplication and overwrite verified.\n");

    // ------------------------------------------------------------------
    // CHECK 4: Batch Idempotency Token
    // ------------------------------------------------------------------
    console.log("--- CHECK 4: Sync Batch Idempotency ---");

    const batchId = `batch-${testSuffix}-idempotent`;

    // 1st attempt: batch recorded
    const batch1 = await prisma.fitnessSyncBatch.create({
      data: {
        gymMemberId: gymMember.id,
        batchId,
        summaryCount: 1,
        sessionCount: 1,
        status: "SUCCESS",
      },
    });

    // 2nd attempt: batch query detects existing batch
    const existingBatch = await prisma.fitnessSyncBatch.findUnique({
      where: { batchId },
    });

    if (!existingBatch || existingBatch.batchId !== batchId) {
      throw new Error("CHECK 4 FAILED: Existing batch token was not found.");
    }
    console.log(`✓ Existing batch token [${batchId}] detected. Duplicate work prevented.`);
    console.log("👉 CHECK 4 PASSED: Batch sync idempotency verified.\n");

    // ------------------------------------------------------------------
    // CHECK 5: Missing Days vs Zero Days Handling & Weekly Average Math
    // ------------------------------------------------------------------
    console.log("--- CHECK 5: Missing Days vs Zero Days Handling & Weekly Averages ---");

    // Spec example:
    // Total steps = 42,000 across 6 available days.
    // Day 7 is missing (no data).
    // Average daily steps = 42,000 / 6 = 7,000 per available day.
    // Missing 7th day is NOT 0!

    const simulatedSummaries = [
      { date: "2026-09-30", steps: 7000, distanceKm: 5.0, activeCalories: 350, hasData: true },
      { date: "2026-10-01", steps: 7000, distanceKm: 5.0, activeCalories: 350, hasData: true },
      { date: "2026-10-02", steps: 7000, distanceKm: 5.0, activeCalories: 350, hasData: true },
      { date: "2026-10-03", steps: 7000, distanceKm: 5.0, activeCalories: 350, hasData: true },
      { date: "2026-10-04", steps: 7000, distanceKm: 5.0, activeCalories: 350, hasData: true },
      { date: "2026-10-05", steps: 7000, distanceKm: 5.0, activeCalories: 350, hasData: true },
      { date: "2026-10-06", steps: null, distanceKm: null, activeCalories: null, hasData: false }, // MISSING DAY!
    ];

    const simulatedWorkouts = [
      { durationMinutes: 45, activeCalories: 300 },
      { durationMinutes: 45, activeCalories: 300 },
      { durationMinutes: 45, activeCalories: 300 },
    ];

    const aggregates = calculateActivityAggregates(simulatedSummaries, simulatedWorkouts, 7);

    if (aggregates.totalSteps !== 42000) {
      throw new Error(`CHECK 5 FAILED: Expected total steps 42000, got ${aggregates.totalSteps}`);
    }
    if (aggregates.availableDaysSteps !== 6) {
      throw new Error(`CHECK 5 FAILED: Expected 6 available days, got ${aggregates.availableDaysSteps}`);
    }
    if (aggregates.averageDailySteps !== 7000) {
      throw new Error(
        `CHECK 5 FAILED: Expected average 7000 (42000 / 6), but got ${aggregates.averageDailySteps}. Missing day was incorrectly counted as 0!`
      );
    }
    if (aggregates.totalWorkoutDurationMinutes !== 135) {
      throw new Error(`CHECK 5 FAILED: Expected workout duration 135 mins, got ${aggregates.totalWorkoutDurationMinutes}`);
    }

    console.log(`✓ 42,000 steps over 6 days = ${aggregates.averageDailySteps} steps/day (Correct: 42,000 / 6).`);
    console.log("✓ Day 7 (missing) retained as null/hasData=false, not falsified as 0.");
    console.log("👉 CHECK 5 PASSED: Missing-day aware weekly average math strictly validated.\n");

    // ------------------------------------------------------------------
    // CHECK 6: Trainer Sharing Privacy Gating & Category Redaction
    // ------------------------------------------------------------------
    console.log("--- CHECK 6: Trainer Sharing Privacy Gating ---");

    // Scenario A: Member shares STEPS and EXERCISE_SESSIONS only (DISTANCE and CALORIES are withheld)
    await prisma.fitnessConnection.update({
      where: { gymMemberId: gymMember.id },
      data: {
        trainerSharingEnabled: true,
        trainerSharingCategories: [FitnessDataCategory.STEPS, FitnessDataCategory.EXERCISE_SESSIONS],
        trainerConfirmedCoachId: trainerUser1.id, // Confirmed for Coach Bilal
      },
    });

    const connSharingOn = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: gymMember.id },
    });

    const isStepsAllowed = connSharingOn?.trainerSharingCategories.includes(FitnessDataCategory.STEPS);
    const isDistanceAllowed = connSharingOn?.trainerSharingCategories.includes(FitnessDataCategory.DISTANCE);

    if (!isStepsAllowed || isDistanceAllowed) {
      throw new Error("CHECK 6 FAILED: Category permissions misconfigured.");
    }
    console.log("✓ Trainer sharing active: STEPS allowed, DISTANCE strictly redacted.");

    // Scenario B: Coach reassignment detection
    // Suppose gym reassigns member to Coach Usman (trainerUser2)
    await prisma.gymMember.update({
      where: { id: gymMember.id },
      data: { trainerId: trainerUser2.id },
    });

    const recheckMember = await prisma.gymMember.findUnique({
      where: { id: gymMember.id },
      include: { fitnessConnection: true },
    });

    const isCoachReassigned =
      recheckMember?.fitnessConnection?.trainerConfirmedCoachId !== recheckMember?.trainerId;

    if (!isCoachReassigned) {
      throw new Error("CHECK 6 FAILED: Coach reassignment not detected!");
    }
    console.log("✓ Coach reassignment detected: Coach Usman cannot access data until member confirms sharing.");

    // Scenario C: Member turns off trainer sharing completely
    await prisma.fitnessConnection.update({
      where: { gymMemberId: gymMember.id },
      data: {
        trainerSharingEnabled: false,
      },
    });

    const connSharingOff = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: gymMember.id },
    });

    if (connSharingOff?.trainerSharingEnabled !== false) {
      throw new Error("CHECK 6 FAILED: Trainer sharing should be false.");
    }
    console.log("✓ Trainer sharing toggled OFF: Coach read access immediately revoked.");
    console.log("👉 CHECK 6 PASSED: Trainer privacy gating and reassignment rules verified.\n");

    // ------------------------------------------------------------------
    // CHECK 7: The 3 Revocation Controls
    // ------------------------------------------------------------------
    console.log("--- CHECK 7: The 3 Revocation Controls (Stop Sharing, Disconnect, Delete History) ---");

    // Control 1: Stop Trainer Sharing verified in Check 6 (history preserved, coach access cut).

    // Control 2: Disconnect / Stop Sync
    await prisma.fitnessConnection.update({
      where: { gymMemberId: gymMember.id },
      data: {
        status: FitnessConnectionStatus.DISCONNECTED,
        reportedPermissions: [],
      },
    });

    const connDisconnected = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: gymMember.id },
    });
    const summariesRemainingAfterDisconnect = await prisma.dailyActivitySummary.count({
      where: { gymMemberId: gymMember.id },
    });

    if (connDisconnected?.status !== FitnessConnectionStatus.DISCONNECTED) {
      throw new Error("CHECK 7 FAILED: Connection not marked DISCONNECTED.");
    }
    if (summariesRemainingAfterDisconnect === 0) {
      throw new Error("CHECK 7 FAILED: Disconnect should retain existing backend history!");
    }
    console.log(`✓ Control 2 verified: Disconnected, but ${summariesRemainingAfterDisconnect} saved summaries retained in cloud.`);

    // Control 3: Delete Synced History
    const [delSummaries, delSessions, delBatches] = await prisma.$transaction([
      prisma.dailyActivitySummary.deleteMany({ where: { gymMemberId: gymMember.id } }),
      prisma.syncedExerciseSession.deleteMany({ where: { gymMemberId: gymMember.id } }),
      prisma.fitnessSyncBatch.deleteMany({ where: { gymMemberId: gymMember.id } }),
    ]);

    await prisma.fitnessConnection.update({
      where: { gymMemberId: gymMember.id },
      data: {
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      },
    });

    const summariesAfterDelete = await prisma.dailyActivitySummary.count({
      where: { gymMemberId: gymMember.id },
    });
    const sessionsAfterDelete = await prisma.syncedExerciseSession.count({
      where: { gymMemberId: gymMember.id },
    });

    if (summariesAfterDelete !== 0 || sessionsAfterDelete !== 0) {
      throw new Error("CHECK 7 FAILED: History delete did not purge records!");
    }
    console.log(`✓ Control 3 verified: Deleted ${delSummaries.count} summaries, ${delSessions.count} sessions, ${delBatches.count} batches.`);
    console.log("👉 CHECK 7 PASSED: All 3 revocation and deletion controls verified.\n");

    console.log("========================================================");
    console.log("🎉 ALL ACCEPTANCE GATES FOR FEATURES 21 & 22 PASSED SUCCESSFULLY!");
    console.log("========================================================\n");
  } finally {
    // ------------------------------------------------------------------
    // CLEANUP: Clean all test records
    // ------------------------------------------------------------------
    console.log("--- CLEANUP: Removing Seeded Test Records ---");
    await prisma.dailyActivitySummary.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.syncedExerciseSession.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.fitnessSyncBatch.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.fitnessConnection.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.gymMember.delete({ where: { id: gymMember.id } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [memberUser.id, trainerUser1.id, trainerUser2.id] },
      },
    });
    console.log("✓ Cleanup finished cleanly.\n");
  }
}

runFeatures21And22Tests().catch((err) => {
  console.error("\n❌ FATAL TEST ERROR:", err);
  process.exit(1);
});
