import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, DietPlanStatus, MealSlotType } from "@prisma/client";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }

    const { id } = await params;

    // Verify trainer assignment if role is TRAINER
    if (current.user.role === Role.TRAINER) {
      const assignment = await prisma.trainerAssignment.findFirst({
        where: {
          gymMemberId: id,
          trainerId: current.user.id,
          ...effectiveTrainerAssignment(),
        },
      });
      if (!assignment) {
        return NextResponse.json({ success: false, error: "Aap is member ke assigned trainer nahi hain." }, { status: 403 });
      }
    }

    const preferences = await prisma.memberDietPreference.findUnique({
      where: { gymMemberId: id },
    });

    const plans = await prisma.dietPlan.findMany({
      where: { gymMemberId: id },
      include: {
        trainer: { select: { id: true, name: true } },
        mealSlots: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        preferences: preferences || null,
        plans,
        logs: await prisma.dietAdherenceLog.findMany({ where: { gymMemberId: id }, orderBy: { date: "desc" }, take: 30 }),
        changeRequests: await prisma.auditLog.findMany({ where: { entityId: id, entityType: "GYM_MEMBER", action: "DIET_CHANGE_REQUESTED" }, select: { id: true, reason: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }),
      },
    });
  } catch (error: any) {
    console.error("GET_TRAINER_MEMBER_DIET_ERROR:", error);
    return NextResponse.json({ success: false, error: "Diet plans load nahi huay." }, { status: 500 });
  }
}

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.TRAINER && current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Sirf trainer diet plan bana sakta hai." }, { status: 403 });
    }

    const { id } = await params;
    const member = await prisma.gymMember.findUnique({
      where: { id },
      include: { dietPreference: true },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    if (current.user.role === Role.TRAINER) {
      const assignment = await prisma.trainerAssignment.findFirst({
        where: {
          gymMemberId: id,
          trainerId: current.user.id,
          ...effectiveTrainerAssignment(),
        },
      });
      if (!assignment) {
        return NextResponse.json({ success: false, error: "Aap is member ke assigned trainer nahi hain." }, { status: 403 });
      }
    }

    const body = await req.json();
    const {
      title,
      goal,
      startDate,
      reviewDate,
      notes,
      specialistReference,
      status = "DRAFT",
      mealSlots = [],
      ignoreAllergyWarning = false,
    } = body;

    if (!title || !goal) {
      return NextResponse.json({ success: false, error: "Plan title aur dietary goal lazmi hain." }, { status: 400 });
    }

    // ALLERGY CONFLICT CHECK (Spec: Declared allergy se matching ingredient ho toh warning aur review block hoga)
    if (!ignoreAllergyWarning && member.dietPreference?.allergies) {
      const rawAllergies = member.dietPreference.allergies
        .toLowerCase()
        .split(/[,;\s]+/)
        .map((a: string) => a.trim())
        .filter((a: string) => a.length > 2);

      const allergensToMatch = new Set<string>();
      for (const a of rawAllergies) {
        allergensToMatch.add(a);
        const stem = a.replace(/(s|es)$/i, "").trim();
        if (stem.length >= 3) {
          allergensToMatch.add(stem);
        }
      }

      const conflicts: string[] = [];
      for (const slot of mealSlots) {
        const slotText = `${slot.title || ""} ${slot.foodItems || ""} ${slot.alternatives || ""}`.toLowerCase();
        for (const allergen of allergensToMatch) {
          if (slotText.includes(allergen)) {
            conflicts.push(`Slot "${slot.title}": declared allergen "${allergen}" found in items.`);
            break;
          }
        }
      }

      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            success: false,
            allergyWarning: true,
            error: `Allergy Warning: Member ne "${member.dietPreference.allergies}" declare kiya hai. ${conflicts.join(" ")} Kripya ingredient check karein ya explicit override confirm karein.`,
            conflicts,
          },
          { status: 400 }
        );
      }
    }

    const planStatus = status === "PUBLISHED" ? DietPlanStatus.PUBLISHED : DietPlanStatus.DRAFT;
    const effectiveStart = startDate ? new Date(startDate) : new Date();
    const effectiveReview = reviewDate ? new Date(reviewDate) : null;

    const result = await prisma.$transaction(
      async (tx) => {
        // If publishing directly, archive prior active plans
        if (planStatus === DietPlanStatus.PUBLISHED) {
          await tx.dietPlan.updateMany({
            where: {
              gymMemberId: id,
              status: DietPlanStatus.PUBLISHED,
            },
            data: {
              status: DietPlanStatus.ARCHIVED,
            },
          });
        }

        const prevCount = await tx.dietPlan.count({
          where: { gymMemberId: id },
        });

        const createdPlan = await tx.dietPlan.create({
          data: {
            gymMemberId: id,
            trainerId: current.user.id,
            title: title.trim(),
            goal: goal.trim(),
            startDate: effectiveStart,
            reviewDate: effectiveReview,
            notes: notes?.trim() || null,
            specialistReference: specialistReference?.trim() || null,
            status: planStatus,
            version: prevCount + 1,
          },
        });

        for (let i = 0; i < mealSlots.length; i++) {
          const s = mealSlots[i];
          await tx.dietMealSlot.create({
            data: {
              dietPlanId: createdPlan.id,
              slotType: (s.slotType as MealSlotType) || MealSlotType.BREAKFAST,
              title: s.title?.trim() || `Meal ${i + 1}`,
              suggestedTiming: s.suggestedTiming?.trim() || null,
              foodItems: s.foodItems?.trim() || "",
              alternatives: s.alternatives?.trim() || null,
              notes: s.notes?.trim() || null,
              estimatedCalories: s.estimatedCalories ? parseFloat(s.estimatedCalories) : null,
              estimatedProtein: s.estimatedProtein ? parseFloat(s.estimatedProtein) : null,
              estimatedCarbs: s.estimatedCarbs ? parseFloat(s.estimatedCarbs) : null,
              estimatedFats: s.estimatedFats ? parseFloat(s.estimatedFats) : null,
              order: s.order ?? i,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: planStatus === DietPlanStatus.PUBLISHED ? "DIET_PLAN_PUBLISHED" : "DIET_PLAN_DRAFTED",
            entityType: "DIET_PLAN",
            entityId: createdPlan.id,
            details: JSON.stringify({
              memberId: id,
              planTitle: createdPlan.title,
              version: createdPlan.version,
              mealsCount: mealSlots.length,
            }),
          },
        });

        return createdPlan;
      },
      { maxWait: 10000, timeout: 25000 }
    );

    const fullPlan = await prisma.dietPlan.findUnique({
      where: { id: result.id },
      include: {
        mealSlots: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({
      success: true,
      message:
        planStatus === DietPlanStatus.PUBLISHED
          ? "Diet plan kamyabi se publish ho gaya!"
          : "Diet plan draft mehfooz ho gaya.",
      data: fullPlan,
    });
  } catch (error: any) {
    console.error("CREATE_DIET_PLAN_ERROR:", error);
    return NextResponse.json({ success: false, error: "Diet plan banane mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
