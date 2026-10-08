import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, FitnessDataCategory } from "@prisma/client";

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

    const member = await prisma.gymMember.findUnique({
      where: { id: gymMemberId },
      include: {
        trainer: { select: { id: true, name: true } },
        trainerAssignments: {
          where: { ...effectiveTrainerAssignment() },
          orderBy: { startDate: "desc" },
          include: { trainer: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member record nahi mila." }, { status: 404 });
    }

    const activeTrainer = member.trainerAssignments[0]?.trainer ?? null;

    const body = await req.json();
    const { enabled, categories = [] } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ success: false, error: "Enabled boolean flag hona chahiye." }, { status: 400 });
    }

    // If enabling sharing, trainer must be currently assigned
    if (enabled && !activeTrainer) {
      return NextResponse.json(
        {
          success: false,
          error: "Aapka koi assigned trainer nahi hai. Pehle trainer assign hona zaroori hai.",
        },
        { status: 400 }
      );
    }

    const validCategories = Object.values(FitnessDataCategory);
    const sanitizedCategories = (categories as string[]).filter((c) =>
      validCategories.includes(c as FitnessDataCategory)
    ) as FitnessDataCategory[];

    const connection = await prisma.fitnessConnection.upsert({
      where: { gymMemberId },
      create: {
        gymMemberId,
        trainerSharingEnabled: enabled,
        trainerSharingCategories: enabled ? sanitizedCategories : [],
        trainerConfirmedCoachId: enabled ? activeTrainer?.id ?? null : null,
      },
      update: {
        trainerSharingEnabled: enabled,
        trainerSharingCategories: enabled ? sanitizedCategories : [],
        trainerConfirmedCoachId: enabled ? activeTrainer?.id ?? null : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: enabled
        ? `Trainer sharing active ho gayi (${activeTrainer?.name} ke sath).`
        : "Trainer sharing band kar di gayi. Trainer aapka synced data nahi dekh sakta.",
      data: {
        connection,
        assignedTrainer: activeTrainer,
      },
    });
  } catch (error: any) {
    console.error("POST trainer sharing error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update trainer sharing." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
