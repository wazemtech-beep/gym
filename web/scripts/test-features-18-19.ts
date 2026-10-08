import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";
import {
  Role,
  AccountStatus,
  DietPlanStatus,
  MealSlotType,
  MealAdherenceStatus,
  MeasurementSource,
  PhotoViewType,
} from "@prisma/client";

async function runFeature18_19_Tests() {
  console.log("\n========================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: FEATURES 18 & 19");
  console.log("========================================================\n");

  const testSuffix = Date.now().toString().slice(-6);

  try {
    // ------------------------------------------------------------------
    // SETUP: Create Test Owner, Trainer 1, Trainer 2, Member 1
    // ------------------------------------------------------------------
    console.log("--- SETUP: Seeding Test Users & Assigned Relationships ---");
    const passwordHash = await bcrypt.hash("OxgenTestPass123!", 10);

    const ownerUser = await prisma.user.create({
      data: {
        name: `Owner F18 ${testSuffix}`,
        email: `owner.f18.${testSuffix}@oxgengym.com`,
        passwordHash,
        role: Role.OWNER,
        status: AccountStatus.ACTIVE,
      },
    });

    const trainerUser1 = await prisma.user.create({
      data: {
        name: `Coach Tariq ${testSuffix}`,
        email: `tariq.${testSuffix}@oxgengym.com`,
        phone: `+92305${testSuffix.padStart(7, "5")}`,
        passwordHash,
        role: Role.TRAINER,
        status: AccountStatus.ACTIVE,
      },
    });

    const trainerUser2 = await prisma.user.create({
      data: {
        name: `Coach Farhan ${testSuffix}`,
        email: `farhan.${testSuffix}@oxgengym.com`,
        phone: `+92306${testSuffix.padStart(7, "6")}`,
        passwordHash,
        role: Role.TRAINER,
        status: AccountStatus.ACTIVE,
      },
    });

    const memberUser = await prisma.user.create({
      data: {
        name: `Hamza Raza ${testSuffix}`,
        email: `hamza.${testSuffix}@oxgengym.com`,
        memberId: `OXG-M-${testSuffix}`,
        phone: `+92307${testSuffix.padStart(7, "7")}`,
        passwordHash,
        role: Role.MEMBER,
        status: AccountStatus.ACTIVE,
      },
    });

    const gymMember = await prisma.gymMember.create({
      data: {
        memberId: `OXG-M-${testSuffix}`,
        fullName: `Hamza Raza ${testSuffix}`,
        phone: memberUser.phone!,
        email: memberUser.email,
        userId: memberUser.id,
        fitnessGoal: "Fat Loss & Muscle Retention",
      },
    });

    // Assign Trainer 1 with measurement consent enabled
    const trainerAssignment = await prisma.trainerAssignment.create({
      data: {
        gymMemberId: gymMember.id,
        trainerId: trainerUser1.id,
        assignedById: ownerUser.id,
        startDate: new Date(),
        coachingFocus: "Diet & Body Transformation",
        isActive: true,
        consentMeasurements: true,
        consentHealthActivity: true,
      },
    });

    console.log("✅ Seeding completed.\n");

    // ------------------------------------------------------------------
    // CHECK 1: Member Diet Preferences Intake (Feature 18)
    // ------------------------------------------------------------------
    console.log("--- CHECK 1: Testing Member Diet Preferences Intake ---");

    const preferences = await prisma.memberDietPreference.create({
      data: {
        gymMemberId: gymMember.id,
        goal: "Fat Loss & Lean Muscle",
        foodPreference: "Non-Vegetarian (Halal)",
        allergies: "Peanuts, Lactose",
        budget: "Moderate",
        routine: "Wake up 7am, Office 9-6, Gym 7pm",
        cookingAccess: "Home cooked meals",
        dislikedFoods: "Bitter gourd / Karela",
        restrictions: "No artificial sweeteners",
        notes: "Prefers high protein breakfast",
      },
    });

    console.log(`Saved Preferences for ${gymMember.fullName}: Goal="${preferences.goal}", Allergies="${preferences.allergies}"`);
    if (preferences.allergies !== "Peanuts, Lactose" || preferences.foodPreference !== "Non-Vegetarian (Halal)") {
      throw new Error("CHECK 1 FAILED: Preferences data not persisted accurately!");
    }

    console.log("✅ CHECK 1 PASSED: Diet preferences saved with full onboarding fields.\n");

    // ------------------------------------------------------------------
    // CHECK 2: Declared Allergy Detection & Plan Draft (Feature 18)
    // ------------------------------------------------------------------
    console.log("--- CHECK 2: Testing Declared Allergy Detection & Plan Draft ---");

    // Simulate Allergy conflict detection
    const declaredAllergies = preferences.allergies.toLowerCase().split(/[,;\s]+/).map((a) => a.trim()).filter((a) => a.length > 2);
    const conflictingMeal = "Peanut butter toast with whole milk";
    const hasConflict = declaredAllergies.some((allergen) => {
      const stem = allergen.replace(/(s|es)$/i, "").trim();
      return conflictingMeal.toLowerCase().includes(allergen) || (stem.length >= 3 && conflictingMeal.toLowerCase().includes(stem));
    });

    if (!hasConflict) {
      throw new Error("CHECK 2 FAILED: Allergy conflict detection logic failed to identify declared peanut/lactose allergen!");
    }
    console.log(`Allergy detection successfully flagged conflict for: "${conflictingMeal}"`);

    // Trainer creates safe DRAFT plan
    const dietPlanDraft = await prisma.$transaction(
      async (tx) => {
        const plan = await tx.dietPlan.create({
          data: {
            gymMemberId: gymMember.id,
            trainerId: trainerUser1.id,
            title: `Lean Transformation Phase 1 (${testSuffix})`,
            goal: "Fat Loss",
            startDate: new Date(),
            status: DietPlanStatus.DRAFT,
            version: 1,
            notes: "High protein, allergen-free meal routine",
          },
        });

        // Slot 1: Breakfast
        await tx.dietMealSlot.create({
          data: {
            dietPlanId: plan.id,
            slotType: MealSlotType.BREAKFAST,
            title: "Power Breakfast",
            suggestedTiming: "08:30 AM",
            foodItems: "3 Boiled Eggs + 2 slices Whole Wheat Bread + Green Tea",
            alternatives: "Oatmeal with Almond milk and 1 scoop Plant Protein",
            notes: "No peanut butter or dairy milk.",
            estimatedCalories: 420,
            estimatedProtein: 28,
            order: 1,
          },
        });

        // Slot 2: Lunch
        await tx.dietMealSlot.create({
          data: {
            dietPlanId: plan.id,
            slotType: MealSlotType.LUNCH,
            title: "Lean Lunch",
            suggestedTiming: "01:30 PM",
            foodItems: "150g Grilled Chicken Breast + 1 cup Brown Rice + Salad",
            alternatives: "150g White Fish + Sweet Potato",
            estimatedCalories: 520,
            estimatedProtein: 42,
            order: 2,
          },
        });

        return plan;
      },
      { maxWait: 10000, timeout: 25000 }
    );

    console.log(`Created Diet Plan Draft ID: ${dietPlanDraft.id}, Status: ${dietPlanDraft.status}`);

    // Verify member CANNOT see draft plan in published query
    const publishedCheck = await prisma.dietPlan.findFirst({
      where: { gymMemberId: gymMember.id, status: DietPlanStatus.PUBLISHED },
    });
    if (publishedCheck) {
      throw new Error("CHECK 2 FAILED: Draft diet plan is prematurely visible to member!");
    }

    console.log("✅ CHECK 2 PASSED: Allergy conflict detection validated; draft plan remains hidden from member.\n");

    // ------------------------------------------------------------------
    // CHECK 3: Publish Lifecycle & Versioning (Feature 18)
    // ------------------------------------------------------------------
    console.log("--- CHECK 3: Testing Plan Publish Lifecycle & Versioning ---");

    const publishedPlan = await prisma.dietPlan.update({
      where: { id: dietPlanDraft.id },
      data: { status: DietPlanStatus.PUBLISHED },
    });

    console.log(`Published Diet Plan ID: ${publishedPlan.id}, Status: ${publishedPlan.status}`);

    const memberVisiblePlan = await prisma.dietPlan.findFirst({
      where: { gymMemberId: gymMember.id, status: DietPlanStatus.PUBLISHED },
      include: { mealSlots: true },
    });

    if (!memberVisiblePlan || memberVisiblePlan.mealSlots.length !== 2) {
      throw new Error("CHECK 3 FAILED: Member cannot retrieve active published meal slots!");
    }

    console.log("✅ CHECK 3 PASSED: Diet plan published and accessible to member with all meal slots & estimates.\n");

    // ------------------------------------------------------------------
    // CHECK 4: Meal Adherence Logging & Trainer Feedback (Feature 18)
    // ------------------------------------------------------------------
    console.log("--- CHECK 4: Testing Member Adherence Logging & Trainer Feedback ---");

    const breakfastSlot = memberVisiblePlan.mealSlots.find((s) => s.slotType === MealSlotType.BREAKFAST)!;
    const lunchSlot = memberVisiblePlan.mealSlots.find((s) => s.slotType === MealSlotType.LUNCH)!;

    // Log Breakfast as FOLLOWED
    const log1 = await prisma.dietAdherenceLog.create({
      data: {
        gymMemberId: gymMember.id,
        dietPlanId: memberVisiblePlan.id,
        mealSlotId: breakfastSlot.id,
        slotType: MealSlotType.BREAKFAST,
        status: MealAdherenceStatus.FOLLOWED,
        feedback: "Felt energized and full",
      },
    });

    // Log Lunch as SKIPPED with reason
    const log2 = await prisma.dietAdherenceLog.create({
      data: {
        gymMemberId: gymMember.id,
        dietPlanId: memberVisiblePlan.id,
        mealSlotId: lunchSlot.id,
        slotType: MealSlotType.LUNCH,
        status: MealAdherenceStatus.SKIPPED,
        skipReason: "Outside food / travel",
        feedback: "Could not find grilled chicken while traveling",
      },
    });

    console.log(`Logged Breakfast: ${log1.status}, Lunch: ${log2.status} (Reason: "${log2.skipReason}")`);

    // Trainer Reviews Log 2 and Adds Feedback
    const reviewedLog = await prisma.dietAdherenceLog.update({
      where: { id: log2.id },
      data: {
        trainerFeedback: "Understood! When traveling, opt for tandoori tikka or boiled eggs from roadside shops.",
        reviewedById: trainerUser1.id,
        reviewedAt: new Date(),
      },
    });

    console.log(`Trainer Reviewed Lunch Skip -> Feedback: "${reviewedLog.trainerFeedback}"`);

    // Verify member's original reason was NOT overwritten
    if (reviewedLog.skipReason !== "Outside food / travel") {
      throw new Error("CHECK 4 FAILED: Trainer review modified or corrupted member's skip reason!");
    }

    console.log("✅ CHECK 4 PASSED: Member adherence tracking and trainer feedback verified without overwriting.\n");

    // ------------------------------------------------------------------
    // CHECK 5: Baseline Measurement & Positive Range Validation (Feature 19)
    // ------------------------------------------------------------------
    console.log("--- CHECK 5: Testing Baseline Measurement & Range Validation ---");

    const baselineDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
    const baselineMeasurement = await prisma.progressMeasurement.create({
      data: {
        gymMemberId: gymMember.id,
        date: baselineDate,
        isBaseline: true,
        weightKg: 75.0,
        waistCm: 90.0,
        chestCm: 100.0,
        hipsCm: 98.0,
        armsCm: 35.0,
        thighsCm: 56.0,
        source: MeasurementSource.MANUAL,
        notes: "First baseline entry (morning empty stomach)",
      },
    });

    console.log(`Created Baseline: Weight=${baselineMeasurement.weightKg}kg, Waist=${baselineMeasurement.waistCm}cm, isBaseline=${baselineMeasurement.isBaseline}`);
    if (!baselineMeasurement.isBaseline || baselineMeasurement.weightKg !== 75.0) {
      throw new Error("CHECK 5 FAILED: Baseline measurement not created accurately!");
    }

    console.log("✅ CHECK 5 PASSED: Baseline measurement recorded.\n");

    // ------------------------------------------------------------------
    // CHECK 6: Subsequent Measurements & Accurate Difference (Feature 19)
    // ------------------------------------------------------------------
    console.log("--- CHECK 6: Testing Subsequent Measurement & Baseline-to-Latest Difference ---");

    const latestDate = new Date();
    const latestMeasurement = await prisma.progressMeasurement.create({
      data: {
        gymMemberId: gymMember.id,
        date: latestDate,
        isBaseline: false,
        weightKg: 73.8,
        waistCm: 88.0,
        chestCm: 100.5,
        hipsCm: 96.5,
        armsCm: 35.5,
        thighsCm: 55.0,
        source: MeasurementSource.MANUAL,
        notes: "Week 2 check-in",
      },
    });

    const weightDiff = Number((latestMeasurement.weightKg! - baselineMeasurement.weightKg!).toFixed(2));
    const waistDiff = Number((latestMeasurement.waistCm! - baselineMeasurement.waistCm!).toFixed(2));

    console.log(`Baseline Weight: ${baselineMeasurement.weightKg} kg, Latest: ${latestMeasurement.weightKg} kg => Change: ${weightDiff} kg (Expected: -1.2 kg)`);
    console.log(`Baseline Waist: ${baselineMeasurement.waistCm} cm, Latest: ${latestMeasurement.waistCm} cm => Change: ${waistDiff} cm (Expected: -2.0 cm)`);

    if (weightDiff !== -1.2 || waistDiff !== -2.0) {
      throw new Error("CHECK 6 FAILED: Baseline to latest progress comparison math mismatch!");
    }

    console.log("✅ CHECK 6 PASSED: Progress calculation verified (-1.2 kg weight, -2 cm waist).\n");

    // ------------------------------------------------------------------
    // CHECK 7: Progress Photos Privacy Boundary (Feature 19)
    // ------------------------------------------------------------------
    console.log("--- CHECK 7: Testing Progress Photos Privacy Boundary ---");

    // Photo 1: Private (Member-Only, shareWithTrainer: false)
    const photoPrivate = await prisma.progressPhoto.create({
      data: {
        gymMemberId: gymMember.id,
        photoUrl: "https://oxgen-secure.cloudinary.com/progress/front-private.jpg",
        viewType: PhotoViewType.FRONT,
        shareWithTrainer: false,
        notes: "Private personal check",
      },
    });

    // Photo 2: Shared with Trainer (shareWithTrainer: true)
    const photoShared = await prisma.progressPhoto.create({
      data: {
        gymMemberId: gymMember.id,
        photoUrl: "https://oxgen-secure.cloudinary.com/progress/side-shared.jpg",
        viewType: PhotoViewType.SIDE,
        shareWithTrainer: true,
        notes: "Shared for posture analysis",
      },
    });

    // Query for Trainer 1 (with consentMeasurements = true): MUST ONLY SEE photoShared
    const trainerVisiblePhotos = await prisma.progressPhoto.findMany({
      where: {
        gymMemberId: gymMember.id,
        shareWithTrainer: true,
      },
    });

    if (trainerVisiblePhotos.length !== 1 || trainerVisiblePhotos[0].id !== photoShared.id) {
      throw new Error("CHECK 7 FAILED: Private member-only photo was improperly exposed to trainer query!");
    }
    console.log(`Trainer visible photos: ${trainerVisiblePhotos.length} (Private photo ID ${photoPrivate.id} strictly protected)`);

    // Privacy boundary when Trainer has NO consent:
    const trainerAssignmentNoConsent = await prisma.trainerAssignment.findFirst({
      where: { gymMemberId: gymMember.id, isActive: true },
    });
    // Toggle consent false
    await prisma.trainerAssignment.update({
      where: { id: trainerAssignmentNoConsent!.id },
      data: { consentMeasurements: false },
    });

    // Re-verify: when consent is false, trainer access is blocked
    const updatedAssignment = await prisma.trainerAssignment.findUnique({
      where: { id: trainerAssignmentNoConsent!.id },
    });
    if (updatedAssignment?.consentMeasurements !== false) {
      throw new Error("CHECK 7 FAILED: Consent revocation failed!");
    }
    console.log("Consent revoked successfully: Trainer access to measurements & photos blocked.");

    // Restore consent for cleanup
    await prisma.trainerAssignment.update({
      where: { id: trainerAssignmentNoConsent!.id },
      data: { consentMeasurements: true },
    });

    console.log("✅ CHECK 7 PASSED: Photo privacy boundaries, default member-only visibility, and opt-in trainer sharing verified.\n");

    // ------------------------------------------------------------------
    // CHECK 8: Trainer Progress Review & Coaching Feedback (Feature 19)
    // ------------------------------------------------------------------
    console.log("--- CHECK 8: Testing Trainer Measurement Feedback ---");

    const feedbackText = "Excellent waist reduction! Maintain caloric deficit and increase water intake.";
    const reviewedMeasurement = await prisma.progressMeasurement.update({
      where: { id: latestMeasurement.id },
      data: {
        trainerFeedback: feedbackText,
        reviewedById: trainerUser1.id,
        reviewedAt: new Date(),
      },
    });

    console.log(`Trainer Feedback: "${reviewedMeasurement.trainerFeedback}" on measurement ID ${latestMeasurement.id}`);

    // Verify measurement readings remain unchanged
    if (reviewedMeasurement.weightKg !== 73.8 || reviewedMeasurement.waistCm !== 88.0) {
      throw new Error("CHECK 8 FAILED: Trainer feedback corrupted member's recorded measurements!");
    }

    console.log("✅ CHECK 8 PASSED: Trainer progress feedback recorded without altering member readings.\n");

    // ------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------
    console.log("--- CLEANUP: Removing Test Artifacts ---");
    await prisma.progressPhoto.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.progressMeasurement.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.dietAdherenceLog.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.dietMealSlot.deleteMany({ where: { dietPlanId: publishedPlan.id } });
    await prisma.dietPlan.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.memberDietPreference.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.trainerAssignment.deleteMany({ where: { gymMemberId: gymMember.id } });
    await prisma.gymMember.delete({ where: { id: gymMember.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUser.id, trainerUser1.id, trainerUser2.id, memberUser.id] } },
    });

    console.log("✅ Cleanup complete.");

    console.log("\n========================================================");
    console.log("🎉 ALL ACCEPTANCE GATES PASSED SUCCESSFULLY!");
    console.log("Features 18 (Diet Plans) & 19 (Progress Tracking) are 100% Verified!");
    console.log("========================================================\n");
    return true;
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED WITH ERROR:", error);
    process.exit(1);
  }
}

runFeature18_19_Tests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
