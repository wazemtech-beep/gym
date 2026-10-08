import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, DurationUnit, PaymentTerms } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const whereClause: any = {};
    if (activeOnly) {
      whereClause.isActive = true;
    }

    const plans = await prisma.feePlan.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });

    const formattedPlans = plans.map((p) => ({
      ...p,
      membershipsCount: p._count.memberships,
    }));

    return NextResponse.json({
      success: true,
      plans: formattedPlans,
    });
  } catch (error) {
    console.error("Get Fee Plans Error:", error);
    return NextResponse.json(
      { success: false, error: "Fee plans load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Strictly Owner only (Point 12: Owner ✅, Receptionist —, Trainer —, Member —)
    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Fee plan create karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      durationValue,
      durationUnit = "CALENDAR_MONTHS",
      membershipFee,
      admissionFee = 0,
      includedServices,
      eligibility = "Everyone",
      paymentTerms = "FULL_PAYMENT_ONLY",
      isActive = true,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Plan ka naam lazmi hai." },
        { status: 400 }
      );
    }

    const parsedDuration = parseInt(durationValue, 10);
    const parsedFee = parseFloat(membershipFee);
    const parsedAdmission = parseFloat(admissionFee) || 0;

    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return NextResponse.json(
        { success: false, error: "Duration value positive number honi chahiye." },
        { status: 400 }
      );
    }

    if (isNaN(parsedFee) || parsedFee < 0) {
      return NextResponse.json(
        { success: false, error: "Membership fee positive amount honi chahiye." },
        { status: 400 }
      );
    }

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.feePlan.create({
        data: {
          name: name.trim(),
          description: description ? description.trim() : null,
          durationValue: parsedDuration,
          durationUnit: durationUnit as DurationUnit,
          membershipFee: parsedFee,
          admissionFee: parsedAdmission,
          includedServices: includedServices ? includedServices.trim() : "Gym Access, Locker",
          eligibility: eligibility ? eligibility.trim() : "Everyone",
          paymentTerms: paymentTerms as PaymentTerms,
          isActive: Boolean(isActive),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "FEE_PLAN_CREATED",
          entityType: "FEE_PLAN",
          entityId: created.id,
          details: JSON.stringify({
            name: created.name,
            duration: `${created.durationValue} ${created.durationUnit}`,
            fee: created.membershipFee,
            admissionFee: created.admissionFee,
          }),
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      message: `Fee Plan '${plan.name}' kamiyabi se create ho gaya!`,
      plan,
    });
  } catch (error) {
    console.error("Create Fee Plan Error:", error);
    return NextResponse.json(
      { success: false, error: "Fee plan create karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
