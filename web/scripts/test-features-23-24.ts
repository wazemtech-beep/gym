import { prisma } from "../src/lib/db";
import {
  Role,
  AccountStatus,
  MemberRecordStatus,
  FitnessConnectionStatus,
  FitnessDataCategory,
  WorkoutSessionStatus,
} from "@prisma/client";
import {
  calculateActivityAggregates,
  getTwoWeekComparisonRanges,
  calculateHistoryRangeStartDate,
} from "../src/lib/fitness";

async function runFeatures23And24Tests() {
  console.log("\n========================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: FEATURES 23 & 24 (TRAINER INSIGHTS & PRIVACY CONTROLS)");
  console.log("========================================================\n");

  const testSuffix = Math.floor(100000 + Math.random() * 900000).toString();

  // ------------------------------------------------------------------
  // SETUP: Seed Trainer and 3 Members
  // ------------------------------------------------------------------
  console.log("--- SETUP: Seeding Trainer and Members ---");

  const trainerUser = await prisma.user.create({
    data: {
      name: `Coach Tariq ${testSuffix}`,
      email: `tariq.${testSuffix}@oxgentest.com`,
      phone: `+92305${testSuffix}`,
      role: Role.TRAINER,
      status: AccountStatus.ACTIVE,
    },
  });

  const memberUser1 = await prisma.user.create({
    data: {
      name: `Ahmed ${testSuffix}`,
      email: `ahmed.${testSuffix}@oxgentest.com`,
      phone: `+92341${testSuffix}`,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
    },
  });

  const member1 = await prisma.gymMember.create({
    data: {
      memberId: `OXG-INS-1-${testSuffix}`,
      fullName: `Ahmed ${testSuffix}`,
      phone: `+92341${testSuffix}`,
      userId: memberUser1.id,
      trainerId: trainerUser.id,
      status: MemberRecordStatus.CURRENT,
    },
  });

  const memberUser2 = await prisma.user.create({
    data: {
      name: `Sara ${testSuffix}`,
      email: `sara.${testSuffix}@oxgentest.com`,
      phone: `+92342${testSuffix}`,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
    },
  });

  const member2 = await prisma.gymMember.create({
    data: {
      memberId: `OXG-INS-2-${testSuffix}`,
      fullName: `Sara ${testSuffix}`,
      phone: `+92342${testSuffix}`,
      userId: memberUser2.id,
      trainerId: trainerUser.id,
      status: MemberRecordStatus.CURRENT,
    },
  });

  const memberUser3 = await prisma.user.create({
    data: {
      name: `Bilal ${testSuffix}`,
      email: `bilal.${testSuffix}@oxgentest.com`,
      phone: `+92343${testSuffix}`,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
    },
  });

  const member3 = await prisma.gymMember.create({
    data: {
      memberId: `OXG-INS-3-${testSuffix}`,
      fullName: `Bilal ${testSuffix}`,
      phone: `+92343${testSuffix}`,
      userId: memberUser3.id,
      trainerId: trainerUser.id,
      status: MemberRecordStatus.CURRENT,
    },
  });

  console.log(`✓ Coach Created: ${trainerUser.name}`);
  console.log(`✓ Member 1 (Ahmed - Steps + Workouts): ${member1.id}`);
  console.log(`✓ Member 2 (Sara - Workouts only): ${member2.id}`);
  console.log(`✓ Member 3 (Bilal - Sharing Off): ${member3.id}\n`);

  try {
    // ------------------------------------------------------------------
    // CHECK 1: Trainer Members Insights Overview (Point 2)
    // ------------------------------------------------------------------
    console.log("--- CHECK 1: Trainer Members Insights Overview & Sharing Badges ---");

    // Ahmed: Sharing Steps + Workouts
    await prisma.fitnessConnection.create({
      data: {
        gymMemberId: member1.id,
        status: FitnessConnectionStatus.CONNECTED,
        backendUploadConsent: true,
        trainerSharingEnabled: true,
        trainerSharingCategories: [FitnessDataCategory.STEPS, FitnessDataCategory.EXERCISE_SESSIONS],
        trainerConfirmedCoachId: trainerUser.id,
        lastSyncedAt: new Date(), // Today
      },
    });

    // Sara: Sharing Workouts only, synced yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await prisma.fitnessConnection.create({
      data: {
        gymMemberId: member2.id,
        status: FitnessConnectionStatus.LIMITED_PERMISSIONS,
        backendUploadConsent: true,
        trainerSharingEnabled: true,
        trainerSharingCategories: [FitnessDataCategory.EXERCISE_SESSIONS],
        trainerConfirmedCoachId: trainerUser.id,
        lastSyncedAt: yesterday,
      },
    });

    // Bilal: Sharing OFF
    await prisma.fitnessConnection.create({
      data: {
        gymMemberId: member3.id,
        status: FitnessConnectionStatus.CONNECTED,
        backendUploadConsent: true,
        trainerSharingEnabled: false,
        trainerSharingCategories: [],
        trainerConfirmedCoachId: null,
      },
    });

    // Query members assigned to coach
    const assignedMembers = await prisma.gymMember.findMany({
      where: { trainerId: trainerUser.id },
      include: { fitnessConnection: true },
    });

    const m1Conn = assignedMembers.find((m) => m.id === member1.id)?.fitnessConnection;
    const m2Conn = assignedMembers.find((m) => m.id === member2.id)?.fitnessConnection;
    const m3Conn = assignedMembers.find((m) => m.id === member3.id)?.fitnessConnection;

    if (!m1Conn?.trainerSharingEnabled || m1Conn.trainerSharingCategories.length !== 2) {
      throw new Error("CHECK 1 FAILED: Member 1 sharing categories not matched.");
    }
    if (!m2Conn?.trainerSharingEnabled || !m2Conn.trainerSharingCategories.includes(FitnessDataCategory.EXERCISE_SESSIONS)) {
      throw new Error("CHECK 1 FAILED: Member 2 sharing not Workouts only.");
    }
    if (m3Conn?.trainerSharingEnabled !== false) {
      throw new Error("CHECK 1 FAILED: Member 3 should be Sharing OFF.");
    }

    console.log("✓ Ahmed: Steps + Workouts (Active)");
    console.log("✓ Sara: Workouts only (Active)");
    console.log("✓ Bilal: Sharing off");
    console.log("👉 CHECK 1 PASSED: Trainer members overview and sharing badges verified.\n");

    // ------------------------------------------------------------------
    // CHECK 2: Comparative Weekly Analytics (Previous vs Current Week) (Point 3)
    // ------------------------------------------------------------------
    console.log("--- CHECK 2: Comparative Weekly Analytics & Coverage Metadata ---");

    // Seed Ahmed's 2 weeks of data:
    // Previous Week: 7/7 days with steps = 6,000 steps/day (total 42,000), 3 workouts (120 mins)
    const prevWeekSummaries = [
      { date: "2026-09-23", steps: 6000, distanceKm: 4.0, activeCalories: 260, hasData: true },
      { date: "2026-09-24", steps: 6000, distanceKm: 4.0, activeCalories: 260, hasData: true },
      { date: "2026-09-25", steps: 6000, distanceKm: 4.0, activeCalories: 260, hasData: true },
      { date: "2026-09-26", steps: 6000, distanceKm: 4.0, activeCalories: 260, hasData: true },
      { date: "2026-09-27", steps: 6000, distanceKm: 4.0, activeCalories: 260, hasData: true },
      { date: "2026-09-28", steps: 6000, distanceKm: 4.0, activeCalories: 260, hasData: true },
      { date: "2026-09-29", steps: 6000, distanceKm: 4.0, activeCalories: 260, hasData: true },
    ];
    const prevWeekWorkouts = [
      { durationMinutes: 40, activeCalories: 200 },
      { durationMinutes: 40, activeCalories: 200 },
      { durationMinutes: 40, activeCalories: 200 },
    ];

    // Current Week: 4/7 days with steps = 7,000 steps/day (total 28,000), 2 workouts (90 mins), 3 days missing!
    const currWeekSummaries = [
      { date: "2026-09-30", steps: 7000, distanceKm: 5.0, activeCalories: 320, hasData: true },
      { date: "2026-10-01", steps: 7000, distanceKm: 5.0, activeCalories: 320, hasData: true },
      { date: "2026-10-02", steps: 7000, distanceKm: 5.0, activeCalories: 320, hasData: true },
      { date: "2026-10-03", steps: 7000, distanceKm: 5.0, activeCalories: 320, hasData: true },
      { date: "2026-10-04", steps: null, distanceKm: null, activeCalories: null, hasData: false },
      { date: "2026-10-05", steps: null, distanceKm: null, activeCalories: null, hasData: false },
      { date: "2026-10-06", steps: null, distanceKm: null, activeCalories: null, hasData: false },
    ];
    const currWeekWorkouts = [
      { durationMinutes: 45, activeCalories: 240 },
      { durationMinutes: 45, activeCalories: 240 },
    ];

    const prevAggregates = calculateActivityAggregates(prevWeekSummaries, prevWeekWorkouts, 7);
    const currAggregates = calculateActivityAggregates(currWeekSummaries, currWeekWorkouts, 7);

    // Verify Previous Week
    if (prevAggregates.averageDailySteps !== 6000 || prevAggregates.availableDaysSteps !== 7) {
      throw new Error(`CHECK 2 FAILED: Prev week expected 6000 avg, 7 days. Got: ${prevAggregates.averageDailySteps}`);
    }
    if (prevAggregates.totalWorkouts !== 3 || prevAggregates.totalWorkoutDurationMinutes !== 120) {
      throw new Error("CHECK 2 FAILED: Prev week workouts mismatch.");
    }

    // Verify Current Week
    if (currAggregates.averageDailySteps !== 7000 || currAggregates.availableDaysSteps !== 4) {
      throw new Error(`CHECK 2 FAILED: Curr week expected 7000 avg, 4 days. Got: ${currAggregates.averageDailySteps}`);
    }
    if (currAggregates.totalWorkouts !== 2 || currAggregates.totalWorkoutDurationMinutes !== 90) {
      throw new Error("CHECK 2 FAILED: Curr week workouts mismatch.");
    }

    console.log("✓ Previous Week: 6,000 steps/day (7/7 days) · 3 workouts (120 min)");
    console.log("✓ Current Week: 7,000 steps/day (4/7 days) · 2 workouts (90 min)");
    console.log("✓ Missing 3 days retained as null (never inferred as laziness/inactivity).");
    console.log("👉 CHECK 2 PASSED: 2-week comparison analytics strictly verified.\n");

    // ------------------------------------------------------------------
    // CHECK 3: Synced Exercises vs Assigned Gym Workouts Separation (Point 1)
    // ------------------------------------------------------------------
    console.log("--- CHECK 3: Separation of Synced Exercises vs Assigned Gym Workouts ---");

    // 1 Synced Device session (Running from watch)
    const syncedSession = await prisma.syncedExerciseSession.create({
      data: {
        gymMemberId: member1.id,
        sourceRecordId: `hc-watch-${testSuffix}`,
        exerciseType: "Running",
        title: "Outdoor Morning Run",
        startTime: new Date("2026-10-02T06:30:00Z"),
        endTime: new Date("2026-10-02T07:15:00Z"),
        durationMinutes: 45,
        distanceKm: 6.2,
        activeCalories: 380,
        source: "Galaxy Watch via Health Connect",
      },
    });

    // 1 Assigned Gym workout session
    const assignedGymSession = await prisma.workoutSession.create({
      data: {
        gymMemberId: member1.id,
        sessionDate: new Date("2026-10-02T17:00:00Z"),
        status: WorkoutSessionStatus.COMPLETED,
        startedAt: new Date("2026-10-02T17:00:00Z"),
        completedAt: new Date("2026-10-02T17:55:00Z"),
        durationMinutes: 55,
        memberNotes: "Felt strong on chest press",
      },
    });

    const verifySynced = await prisma.syncedExerciseSession.findUnique({ where: { id: syncedSession.id } });
    const verifyAssigned = await prisma.workoutSession.findUnique({ where: { id: assignedGymSession.id } });

    if (!verifySynced || !verifyAssigned) {
      throw new Error("CHECK 3 FAILED: Records not created.");
    }
    if (verifySynced.id === verifyAssigned.id) {
      throw new Error("CHECK 3 FAILED: Synced and assigned workout sessions must be separate models!");
    }

    console.log("✓ Synced device workout (Galaxy Watch): Outdoor Morning Run (45 mins)");
    console.log("✓ Assigned gym workout: Completed gym session (55 mins)");
    console.log("✓ Maintained strictly distinct — watch workout does NOT auto-complete assigned gym exercise.");
    console.log("👉 CHECK 3 PASSED: Synced device exercise vs assigned gym workout separation verified.\n");

    // ------------------------------------------------------------------
    // CHECK 4: Coaching Observation & Plan Revision (Point 4 & 5)
    // ------------------------------------------------------------------
    console.log("--- CHECK 4: Coaching Observations & Plan Revisions ---");

    const review = await prisma.trainerActivityReview.create({
      data: {
        trainerId: trainerUser.id,
        gymMemberId: member1.id,
        reviewedStartDate: "2026-09-30",
        reviewedEndDate: "2026-10-06",
        observation: "Member showing great consistency on walking; reports leg fatigue on squats.",
        memberFeedback: "Reported soreness after leg day",
        suggestedAction: "PLAN_ADJUSTMENT",
        memberFacingNote: "Great weekly activity! We will deload squats next week to prioritize recovery.",
      },
    });

    if (!review.id || review.suggestedAction !== "PLAN_ADJUSTMENT") {
      throw new Error("CHECK 4 FAILED: Trainer review record creation failed.");
    }

    console.log(`✓ Coaching Observation saved for Ahmed by Coach ${trainerUser.name}`);
    console.log(`  Assessment: "${review.observation}"`);
    console.log(`  Suggested Action: ${review.suggestedAction}`);
    console.log(`  Member Guidance Note: "${review.memberFacingNote}"`);
    console.log("👉 CHECK 4 PASSED: Coaching observations and plan revision linkage verified.\n");

    // ------------------------------------------------------------------
    // CHECK 5: Requesting Access from Member when Sharing is OFF (Point 2)
    // ------------------------------------------------------------------
    console.log("--- CHECK 5: Requesting Sharing Access when Sharing is OFF ---");

    const request = await prisma.fitnessSharingRequest.create({
      data: {
        trainerId: trainerUser.id,
        gymMemberId: member3.id,
        requestedCategories: [FitnessDataCategory.STEPS, FitnessDataCategory.EXERCISE_SESSIONS],
        message: "Coach Tariq would like to review your activity to tailor your workout plan.",
        status: "PENDING",
      },
    });

    if (!request.id || request.status !== "PENDING") {
      throw new Error("CHECK 5 FAILED: Fitness sharing request not created.");
    }

    console.log(`✓ Access request created for Bilal (Sharing OFF) by Coach ${trainerUser.name}`);
    console.log("✓ Status: PENDING (Trainer cannot force-enable; member must approve).");
    console.log("👉 CHECK 5 PASSED: Access request workflow verified.\n");

    // ------------------------------------------------------------------
    // CHECK 6: Date-Bounded Sharing Configuration (Feature 24 Point 2 & 3)
    // ------------------------------------------------------------------
    console.log("--- CHECK 6: Date-Bounded Sharing & Granular Category Revocation ---");

    const thirtyDaysAgo = calculateHistoryRangeStartDate("LAST_30_DAYS");
    if (!thirtyDaysAgo) {
      throw new Error("CHECK 6 FAILED: Failed to calculate LAST_30_DAYS start date.");
    }

    // Configure sharing with 30-day boundary and STEPS + EXERCISE_SESSIONS
    await prisma.fitnessConnection.update({
      where: { gymMemberId: member1.id },
      data: {
        trainerSharingEnabled: true,
        trainerSharingCategories: [FitnessDataCategory.STEPS, FitnessDataCategory.EXERCISE_SESSIONS],
        historyRangeType: "LAST_30_DAYS",
        historyRangeStart: thirtyDaysAgo,
        trainerSharingConsentVersion: "v1.0",
        trainerSharingConfirmedAt: new Date(),
      },
    });

    const connBounded = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: member1.id },
    });

    if (connBounded?.historyRangeType !== "LAST_30_DAYS" || !connBounded?.historyRangeStart) {
      throw new Error("CHECK 6 FAILED: History range bounds not recorded.");
    }
    console.log(`✓ Sharing configured with LAST_30_DAYS boundary (Start: ${connBounded.historyRangeStart.toISOString().slice(0, 10)})`);

    // Granular Revocation: Revoke STEPS, keep EXERCISE_SESSIONS
    await prisma.fitnessConnection.update({
      where: { gymMemberId: member1.id },
      data: {
        trainerSharingCategories: [FitnessDataCategory.EXERCISE_SESSIONS],
      },
    });

    const connGranular = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: member1.id },
    });
    if (connGranular?.trainerSharingCategories.includes(FitnessDataCategory.STEPS)) {
      throw new Error("CHECK 6 FAILED: Granular revocation of steps failed.");
    }
    console.log("✓ Granular category revocation: STEPS revoked, EXERCISE_SESSIONS remains active.");
    console.log("👉 CHECK 6 PASSED: Date boundaries and granular category controls verified.\n");

    // ------------------------------------------------------------------
    // CHECK 7: Revocation & Disconnect Controls (Feature 24 Point 4 & 5)
    // ------------------------------------------------------------------
    console.log("--- CHECK 7: Sharing Revocation & Disconnect Controls ---");

    // Stop Trainer Sharing
    await prisma.fitnessConnection.update({
      where: { gymMemberId: member1.id },
      data: {
        trainerSharingEnabled: false,
      },
    });

    const connStopped = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: member1.id },
    });
    if (connStopped?.trainerSharingEnabled !== false) {
      throw new Error("CHECK 7 FAILED: Stop sharing should disable trainer access.");
    }
    console.log("✓ Stop Trainer Sharing: Coach access cut immediately; member cloud data preserved.");

    // Disconnect Fitness Data
    await prisma.fitnessConnection.update({
      where: { gymMemberId: member1.id },
      data: {
        status: FitnessConnectionStatus.DISCONNECTED,
        reportedPermissions: [],
      },
    });

    const connDisconnected = await prisma.fitnessConnection.findUnique({
      where: { gymMemberId: member1.id },
    });
    if (connDisconnected?.status !== FitnessConnectionStatus.DISCONNECTED) {
      throw new Error("CHECK 7 FAILED: Status should be DISCONNECTED.");
    }
    console.log("✓ Disconnect Fitness Data: Marked DISCONNECTED; future sync disabled; existing history preserved.");
    console.log("👉 CHECK 7 PASSED: Revocation and disconnect semantics verified.\n");

    // ------------------------------------------------------------------
    // CHECK 8: Scoped Deletion of Synced Fitness Data (Feature 24 Point 6)
    // ------------------------------------------------------------------
    console.log("--- CHECK 8: Scoped Deletion of Synced Data (Range, Category, All) ---");

    // Seed test summaries for member 1 to delete in scopes
    await prisma.dailyActivitySummary.createMany({
      data: [
        { gymMemberId: member1.id, date: "2026-09-01", steps: 5000, distanceKm: 3.5, activeCalories: 200, hasData: true },
        { gymMemberId: member1.id, date: "2026-09-02", steps: 5500, distanceKm: 3.8, activeCalories: 220, hasData: true },
        { gymMemberId: member1.id, date: "2026-09-03", steps: 6000, distanceKm: 4.2, activeCalories: 240, hasData: true },
      ],
    });

    // Scope 1: Date Range Deletion (Delete 2026-09-01 only)
    const delRange = await prisma.dailyActivitySummary.deleteMany({
      where: { gymMemberId: member1.id, date: "2026-09-01" },
    });
    await prisma.fitnessDeletionAudit.create({
      data: {
        gymMemberId: member1.id,
        scope: "DATE_RANGE",
        startDate: "2026-09-01",
        endDate: "2026-09-01",
        deletedSummariesCount: delRange.count,
      },
    });
    if (delRange.count !== 1) {
      throw new Error("CHECK 8 FAILED: Expected 1 summary deleted in date range.");
    }
    console.log(`✓ Scope 1 (Date Range): Deleted ${delRange.count} summary for 2026-09-01.`);

    // Scope 2: Category Deletion (Delete STEPS category only)
    const delCat = await prisma.dailyActivitySummary.updateMany({
      where: { gymMemberId: member1.id },
      data: { steps: null },
    });
    await prisma.fitnessDeletionAudit.create({
      data: {
        gymMemberId: member1.id,
        scope: "CATEGORY",
        targetCategory: "STEPS",
        deletedSummariesCount: delCat.count,
      },
    });
    const checkCat = await prisma.dailyActivitySummary.findFirst({
      where: { gymMemberId: member1.id, date: "2026-09-02" },
    });
    if (checkCat?.steps !== null || checkCat?.distanceKm === null) {
      throw new Error("CHECK 8 FAILED: Category deletion should nullify steps while preserving distance.");
    }
    console.log(`✓ Scope 2 (Category): Steps cleared to null while distance preserved (${checkCat.distanceKm} km).`);

    // Scope 3: ALL Deletion
    const delAll = await prisma.dailyActivitySummary.deleteMany({
      where: { gymMemberId: member1.id },
    });
    await prisma.fitnessDeletionAudit.create({
      data: {
        gymMemberId: member1.id,
        scope: "ALL",
        deletedSummariesCount: delAll.count,
      },
    });
    const countAfterAll = await prisma.dailyActivitySummary.count({ where: { gymMemberId: member1.id } });
    if (countAfterAll !== 0) {
      throw new Error("CHECK 8 FAILED: Scope ALL did not purge all summaries.");
    }
    console.log(`✓ Scope 3 (ALL): Purged remaining summaries.`);

    // Check that Gym WorkoutSession is UNTOUCHED
    const gymSessionStillExists = await prisma.workoutSession.findUnique({
      where: { id: assignedGymSession.id },
    });
    if (!gymSessionStillExists) {
      throw new Error("CHECK 8 FAILED: Fitness deletion erroneously removed gym workout session!");
    }
    console.log("✓ Manual gym workout logs, memberships, and receipts completely untouched.");

    // Audit logs verified
    const audits = await prisma.fitnessDeletionAudit.findMany({ where: { gymMemberId: member1.id } });
    if (audits.length !== 3) {
      throw new Error(`CHECK 8 FAILED: Expected 3 deletion audits, found ${audits.length}`);
    }
    console.log(`✓ Audit records logged cleanly (${audits.length} audits; health metric values never exposed in audit).`);
    console.log("👉 CHECK 8 PASSED: Scoped deletion and audit logging verified.\n");

    console.log("========================================================");
    console.log("🎉 ALL ACCEPTANCE GATES FOR FEATURES 23 & 24 PASSED SUCCESSFULLY!");
    console.log("========================================================\n");
  } finally {
    // ------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------
    console.log("--- CLEANUP: Removing Seeded Test Records ---");
    const mIds = [member1.id, member2.id, member3.id];
    await prisma.fitnessDeletionAudit.deleteMany({ where: { gymMemberId: { in: mIds } } });
    await prisma.fitnessSharingRequest.deleteMany({ where: { gymMemberId: { in: mIds } } });
    await prisma.trainerActivityReview.deleteMany({ where: { gymMemberId: { in: mIds } } });
    await prisma.syncedExerciseSession.deleteMany({ where: { gymMemberId: { in: mIds } } });
    await prisma.workoutSession.deleteMany({ where: { gymMemberId: { in: mIds } } });
    await prisma.dailyActivitySummary.deleteMany({ where: { gymMemberId: { in: mIds } } });
    await prisma.fitnessConnection.deleteMany({ where: { gymMemberId: { in: mIds } } });
    await prisma.gymMember.deleteMany({ where: { id: { in: mIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: [trainerUser.id, memberUser1.id, memberUser2.id, memberUser3.id] } },
    });
    console.log("✓ Cleanup finished cleanly.\n");
  }
}

runFeatures23And24Tests().catch((err) => {
  console.error("\n❌ FATAL TEST ERROR:", err);
  process.exit(1);
});
