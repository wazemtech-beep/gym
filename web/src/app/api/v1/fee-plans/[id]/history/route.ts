import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;
    const plan = await prisma.feePlan.findUnique({
      where: { id },
      include: {
        history: {
          include: {
            changedBy: { select: { name: true, role: true } },
          },
          orderBy: { version: "desc" },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Fee plan nahi mila." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      currentPlan: {
        id: plan.id,
        name: plan.name,
        version: plan.version,
        membershipFee: plan.membershipFee,
        durationValue: plan.durationValue,
        durationUnit: plan.durationUnit,
        updatedAt: plan.updatedAt,
      },
      history: plan.history,
    });
  } catch (error: any) {
    console.error("GET_FEE_PLAN_HISTORY_ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
