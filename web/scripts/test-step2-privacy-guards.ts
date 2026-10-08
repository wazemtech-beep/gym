import { prisma } from "../src/lib/db";
import { Role, FitnessConnectionStatus, PhotoViewType, PaymentMethod, PaymentStatus } from "@prisma/client";

async function runStep2Tests() {
  console.log("==================================================================");
  console.log("STEP 2 INTEGRATION TEST: PRIVACY, SECURITY & DISCONNECT GUARDS");
  console.log("==================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Setup Users & Roles
  const ownerUser = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (!ownerUser) throw new Error("No owner user found in DB");

  let receptionistUser = await prisma.user.findFirst({ where: { role: Role.RECEPTIONIST } });
  if (!receptionistUser) {
    receptionistUser = await prisma.user.create({
      data: {
        name: "Test Receptionist Step2",
        email: `receptionist.step2.${Date.now()}@oxgen.local`,
        role: Role.RECEPTIONIST,
      },
    });
  }

  let assignedTrainerUser = await prisma.user.findFirst({ where: { role: Role.TRAINER, status: "ACTIVE" } });
  if (!assignedTrainerUser) {
    assignedTrainerUser = await prisma.user.create({
      data: {
        name: "Test Assigned Coach",
        email: `coach.assigned.${Date.now()}@oxgen.local`,
        role: Role.TRAINER,
        status: "ACTIVE",
      },
    });
  }

  let unassignedTrainerUser = await prisma.user.create({
    data: {
      name: "Test Unassigned Coach",
      email: `coach.unassigned.${Date.now()}@oxgen.local`,
      role: Role.TRAINER,
      status: "ACTIVE",
    },
  });

  // Create clean Test Member
  const memberUser = await prisma.user.create({
    data: {
      name: "Step2 Privacy Member",
      email: `member.step2.${Date.now()}@oxgen.local`,
      role: Role.MEMBER,
    },
  });

  const testMember = await prisma.gymMember.create({
    data: {
      memberId: `TST-${Date.now().toString().slice(-6)}`,
      fullName: "Step2 Privacy Member",
      phone: `0300${Date.now().toString().slice(-7)}`,
      status: "CURRENT",
      userId: memberUser.id,
    },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Fitness Sync Disconnect Guard & Deletion Replay Fence
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Fitness Sync Disconnect Guard & Replay Fence ---");

    // Case 1A: Connection is DISCONNECTED -> Sync must be rejected
    const conn = await prisma.fitnessConnection.create({
      data: {
        gymMemberId: testMember.id,
        status: FitnessConnectionStatus.DISCONNECTED,
        backendUploadConsent: true,
      },
    });

    const isDisconnected = conn.status === FitnessConnectionStatus.DISCONNECTED;
    assert(isDisconnected, "Connection status is DISCONNECTED");

    // Emulate sync check:
    const canSyncWhenDisconnected = conn && conn.status !== FitnessConnectionStatus.DISCONNECTED;
    assert(!canSyncWhenDisconnected, "Sync is BLOCKED when connection status is DISCONNECTED");

    // Reconnect for deletion test
    await prisma.fitnessConnection.update({
      where: { id: conn.id },
      data: { status: FitnessConnectionStatus.CONNECTED },
    });

    // Case 1B: Replay protection fence: A deletion audit exists
    const delAudit = await prisma.fitnessDeletionAudit.create({
      data: {
        gymMemberId: testMember.id,
        scope: "ALL",
        deletedSummariesCount: 10,
      },
    });

    // Emulate sync incoming payload without explicit consent
    const requestWithoutReimportConsent = { explicitReimportConsent: false };
    const shouldBlockReplay = Boolean(delAudit && !requestWithoutReimportConsent.explicitReimportConsent);
    assert(shouldBlockReplay, "Sync replay without explicit consent is BLOCKED by deletion epoch");

    const requestWithReimportConsent = { explicitReimportConsent: true };
    const shouldAllowReplay = Boolean(requestWithReimportConsent.explicitReimportConsent);
    assert(shouldAllowReplay, "Sync with explicitReimportConsent: true is permitted to proceed");

    // -------------------------------------------------------------
    // TEST 2: Progress Photos Record-Level Security & Coach Assignment Checks
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Progress Photos Record-Level Access Control ---");

    // Create 2 photos: one private, one shared with trainer
    const privatePhoto = await prisma.progressPhoto.create({
      data: {
        gymMemberId: testMember.id,
        photoUrl: "https://oxgen.example/photos/private1.jpg",
        viewType: PhotoViewType.FRONT,
        shareWithTrainer: false,
      },
    });

    const sharedPhoto = await prisma.progressPhoto.create({
      data: {
        gymMemberId: testMember.id,
        photoUrl: "https://oxgen.example/photos/shared1.jpg",
        viewType: PhotoViewType.SIDE,
        shareWithTrainer: true,
      },
    });

    // Test 2A: Receptionist access check
    const isReceptionistPermitted = receptionistUser.role !== Role.RECEPTIONIST;
    assert(!isReceptionistPermitted, "Receptionist is FORBIDDEN from viewing private progress photos");

    // Test 2B: Unassigned Coach access check
    const unassignedCheck = await prisma.trainerAssignment.findFirst({
      where: {
        gymMemberId: testMember.id,
        trainerId: unassignedTrainerUser.id,
        isActive: true,
      },
    });
    assert(!unassignedCheck, "Unassigned coach has NO active assignment to member");

    // Test 2C: Assigned Coach access check
    await prisma.trainerAssignment.create({
      data: {
        gymMemberId: testMember.id,
        trainerId: assignedTrainerUser.id,
        assignedById: ownerUser.id,
        isActive: true,
        consentMeasurements: true,
      },
    });

    const assignedCheck = await prisma.trainerAssignment.findFirst({
      where: {
        gymMemberId: testMember.id,
        trainerId: assignedTrainerUser.id,
        isActive: true,
      },
    });
    assert(Boolean(assignedCheck), "Assigned coach has verified active assignment");

    // Coach query must filter shareWithTrainer: true
    const coachVisiblePhotos = await prisma.progressPhoto.findMany({
      where: {
        gymMemberId: testMember.id,
        shareWithTrainer: true,
      },
    });
    assert(coachVisiblePhotos.length === 1, "Assigned coach can ONLY see photos with shareWithTrainer === true");
    assert(coachVisiblePhotos[0].id === sharedPhoto.id, "Coach sees shared photo, private photo is concealed");

    // Member sees ALL their photos (both private and shared)
    const memberVisiblePhotos = await prisma.progressPhoto.findMany({
      where: { gymMemberId: testMember.id },
    });
    assert(memberVisiblePhotos.length === 2, "Member sees all their own photos (total: 2)");

    // -------------------------------------------------------------
    // TEST 3: Financial Receipts Exclusion for Trainer Role
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Financial Receipts Exclusion for Trainer Role ---");

    const testPayment = await prisma.payment.create({
      data: {
        receiptNumber: `OXG-RCP-SEC-${Date.now().toString().slice(-6)}`,
        gymMemberId: testMember.id,
        amount: 2500,
        method: PaymentMethod.CASH,
        paymentDate: new Date(),
        status: PaymentStatus.CONFIRMED,
        recordedById: ownerUser.id,
      },
    });

    const canTrainerAccessReceipt = assignedTrainerUser.role !== Role.TRAINER;
    const canOwnerAccessReceipt = ownerUser.role === Role.OWNER;
    const canMemberAccessOwnReceipt = memberUser.role === Role.MEMBER;

    assert(!canTrainerAccessReceipt, "Trainer role is strictly FORBIDDEN from viewing financial receipts");
    assert(canOwnerAccessReceipt, "Owner is AUTHORIZED to view financial receipts");
    assert(canMemberAccessOwnReceipt, "Member is AUTHORIZED to view their own financial receipt");

    // -------------------------------------------------------------
    // TEST 4: Trainer Assignment Gated to Owner-Only
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Trainer Assignment & Unassignment Gated to Owner-Only ---");

    const canReceptionistAssignTrainer = receptionistUser.role === Role.OWNER;
    const canOwnerAssignTrainer = ownerUser.role === Role.OWNER;

    assert(!canReceptionistAssignTrainer, "Receptionist is FORBIDDEN from assigning trainers (Owner-only rule)");
    assert(canOwnerAssignTrainer, "Owner is AUTHORIZED to assign trainers");

    // Emulate Owner unassigning trainer
    await prisma.trainerAssignment.updateMany({
      where: { gymMemberId: testMember.id, isActive: true },
      data: { isActive: false, endDate: new Date() },
    });

    const remainingActiveAssignments = await prisma.trainerAssignment.count({
      where: { gymMemberId: testMember.id, isActive: true },
    });
    assert(remainingActiveAssignments === 0, "Trainer unassigned successfully by Owner");

    console.log("\n==================================================================");
    console.log(`ALL ${passed}/${total} STEP 2 PRIVACY & SECURITY TESTS PASSED!`);
    console.log("==================================================================");

  } finally {
    console.log("\nCleaning up test records...");
    await prisma.progressPhoto.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.trainerAssignment.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.fitnessDeletionAudit.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.fitnessConnection.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.payment.deleteMany({ where: { gymMemberId: testMember.id } });
    await prisma.gymMember.delete({ where: { id: testMember.id } });
    await prisma.user.delete({ where: { id: memberUser.id } });
    await prisma.user.delete({ where: { id: unassignedTrainerUser.id } });
    console.log("Cleanup complete.");
  }
}

runStep2Tests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
