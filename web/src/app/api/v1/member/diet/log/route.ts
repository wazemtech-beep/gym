import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, MealAdherenceStatus, MealSlotType } from "@prisma/client";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

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
      const bodyPreview = await req.clone().json().catch(() => ({}));
      gymMemberId = bodyPreview.memberId || null;
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
    }

    const body = await req.json();
    const {
      dietPlanId,
      mealSlotId,
      slotType = "BREAKFAST",
      status = "FOLLOWED",
      actualFood,
      actualQuantity,
      skipReason,
      feedback,
      date,
    } = body;

    const logDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
    const endOfDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate(), 23, 59, 59, 999);

    const adherenceStatus = (status as MealAdherenceStatus) || MealAdherenceStatus.FOLLOWED;
    const mealSlotType = (slotType as MealSlotType) || MealSlotType.BREAKFAST;

    // Check if an existing log exists for this slot on this day
    const existingLog = await prisma.dietAdherenceLog.findFirst({
      where: {
        gymMemberId,
        dietPlanId: dietPlanId || undefined,
        mealSlotId: mealSlotId || undefined,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    let savedLog;
    if (existingLog) {
      savedLog = await prisma.dietAdherenceLog.update({
        where: { id: existingLog.id },
        data: {
          status: adherenceStatus,
          actualFood: actualFood?.trim() || null,
          actualQuantity: actualQuantity?.trim() || null,
          skipReason: adherenceStatus === MealAdherenceStatus.SKIPPED ? skipReason?.trim() || "Skipped" : null,
          feedback: feedback?.trim() || null,
        },
      });
    } else {
      savedLog = await prisma.dietAdherenceLog.create({
        data: {
          gymMemberId,
          dietPlanId: dietPlanId || null,
          mealSlotId: mealSlotId || null,
          slotType: mealSlotType,
          status: adherenceStatus,
          actualFood: actualFood?.trim() || null,
          actualQuantity: actualQuantity?.trim() || null,
          skipReason: adherenceStatus === MealAdherenceStatus.SKIPPED ? skipReason?.trim() || "Skipped" : null,
          feedback: feedback?.trim() || null,
          date: logDate,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Meal status kamyabi se record ho gaya.",
      data: savedLog,
    });
  } catch (error: any) {
    console.error("LOG_MEAL_ADHERENCE_ERROR:", error);
    return NextResponse.json({ success: false, error: "Meal log record karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
