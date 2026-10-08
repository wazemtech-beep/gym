import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { Role } from "@prisma/client";

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

    const preferences = await prisma.memberDietPreference.findUnique({
      where: { gymMemberId },
    });

    return NextResponse.json({
      success: true,
      data: preferences || null,
    });
  } catch (error: any) {
    console.error("GET_DIET_PREFERENCES_ERROR:", error);
    return NextResponse.json({ success: false, error: "Diet preferences load nahi huin." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
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
      const bodyPreview = await req.clone().json().catch(() => ({}));
      gymMemberId = bodyPreview.memberId || null;
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
    }

    const body = await req.json();
    const {
      goal,
      foodPreference,
      allergies,
      budget,
      routine,
      cookingAccess,
      dislikedFoods,
      restrictions,
      notes,
    } = body;

    const upserted = await prisma.memberDietPreference.upsert({
      where: { gymMemberId },
      update: {
        goal: goal?.trim() || null,
        foodPreference: foodPreference?.trim() || null,
        allergies: allergies?.trim() || null,
        budget: budget?.trim() || null,
        routine: routine?.trim() || null,
        cookingAccess: cookingAccess?.trim() || null,
        dislikedFoods: dislikedFoods?.trim() || null,
        restrictions: restrictions?.trim() || null,
        notes: notes?.trim() || null,
      },
      create: {
        gymMemberId,
        goal: goal?.trim() || null,
        foodPreference: foodPreference?.trim() || null,
        allergies: allergies?.trim() || null,
        budget: budget?.trim() || null,
        routine: routine?.trim() || null,
        cookingAccess: cookingAccess?.trim() || null,
        dislikedFoods: dislikedFoods?.trim() || null,
        restrictions: restrictions?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "DIET_PREFERENCES_UPDATED",
        entityType: "MEMBER_DIET_PREFERENCE",
        entityId: upserted.id,
        details: JSON.stringify({
          memberId: gymMemberId,
          allergies: upserted.allergies,
          foodPreference: upserted.foodPreference,
        }),
      },
    });

    const assignment = await prisma.trainerAssignment.findFirst({ where: { gymMemberId, ...effectiveTrainerAssignment() } });
    if (assignment) await dispatchNotification({ recipientUserId: assignment.trainerId, eventType: "DIET_PREFERENCES_UPDATED", title: "Diet preferences changed", message: "Review the member’s updated preferences and allergies before publishing a plan.", category: "TRAINING", entityType: "GYM_MEMBER", entityId: gymMemberId, actionUrl: "/admin/trainer/dashboard", dedupKey: `diet-preferences:${upserted.id}:${upserted.updatedAt.toISOString()}` });
    return NextResponse.json({
      success: true,
      message: "Diet preferences saved. A review notice has been queued for your assigned trainer.",
      data: upserted,
    });
  } catch (error: any) {
    console.error("UPSERT_DIET_PREFERENCES_ERROR:", error);
    return NextResponse.json({ success: false, error: "Preferences save karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
