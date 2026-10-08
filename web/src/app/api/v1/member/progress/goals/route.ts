import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.MEMBER) return NextResponse.json({ success: false, error: "Member access required." }, { status: 403 });
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

    const goal = await prisma.progressGoal.findFirst({
      where: { gymMemberId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: goal || null });
  } catch (error: any) {
    console.error("GET_PROGRESS_GOAL_ERROR:", error);
    return NextResponse.json({ success: false, error: "Goal load karne mein masla aya." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.MEMBER || current.user.mustChangePassword) return NextResponse.json({ success: false, error: "Member access required." }, { status: 403 });
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
    const { targetWeightKg, targetWaistCm, targetDate, notes } = body;

    const numWeight = targetWeightKg ? parseFloat(targetWeightKg) : null;
    const numWaist = targetWaistCm ? parseFloat(targetWaistCm) : null;
    const parsedDate = targetDate ? new Date(targetDate) : null;
    if ((numWeight !== null && (!Number.isFinite(numWeight) || numWeight <= 0)) || (numWaist !== null && (!Number.isFinite(numWaist) || numWaist <= 0)) || (parsedDate && !Number.isFinite(parsedDate.getTime()))) return NextResponse.json({ success: false, error: "Enter valid targets and date." }, { status: 400 });

    // Archive previous active goals
    await prisma.progressGoal.updateMany({
      where: { gymMemberId, isActive: true },
      data: { isActive: false },
    });

    const newGoal = await prisma.progressGoal.create({
      data: {
        gymMemberId,
        targetWeightKg: numWeight,
        targetWaistCm: numWaist,
        targetDate: parsedDate,
        notes: notes?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Target goal set ho gaya.",
      data: newGoal,
    });
  } catch (error: any) {
    console.error("SET_PROGRESS_GOAL_ERROR:", error);
    return NextResponse.json({ success: false, error: "Goal set karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
