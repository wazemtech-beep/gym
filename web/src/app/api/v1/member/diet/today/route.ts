import { withReadCache } from "@/lib/serverReadCache";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, DietPlanStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.MEMBER && current.user.role !== Role.OWNER) return NextResponse.json({ success: false, error: "Use the assigned trainer diet view." }, { status: 403 });
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

    const now = new Date();
    const { start: startOfDay, end: endOfDay } = getDateRangeForPeriod("today");

    // Fetch active published plan
    const activePlan = await prisma.dietPlan.findFirst({
      orderBy: { startDate: "desc" },
      where: {
        gymMemberId,
        status: DietPlanStatus.PUBLISHED,
        startDate: { lte: now },
      },
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        mealSlots: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!activePlan) {
      return NextResponse.json({
        success: true,
        data: {
          hasPlan: false,
          message: "Diet plan abhi available nahi",
        },
      });
    }

    // Fetch today's adherence logs for this plan
    const todayLogs = await prisma.dietAdherenceLog.findMany({
      where: {
        gymMemberId,
        dietPlanId: activePlan.id,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        hasPlan: true,
        plan: {
          id: activePlan.id,
          title: activePlan.title,
          goal: activePlan.goal,
          version: activePlan.version,
          startDate: activePlan.startDate,
          reviewDate: activePlan.reviewDate,
          notes: activePlan.notes,
          specialistReference: activePlan.specialistReference,
          trainer: activePlan.trainer,
          mealSlots: activePlan.mealSlots,
        },
        todayLogs,
      },
    });
  } catch (error: any) {
    console.error("GET_TODAY_DIET_ERROR:", error);
    return NextResponse.json({ success: false, error: "Diet plan load karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
