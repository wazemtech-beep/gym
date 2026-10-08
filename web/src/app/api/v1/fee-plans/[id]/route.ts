import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, DurationUnit, PaymentTerms } from "@prisma/client";

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
        history: { orderBy: { createdAt: "desc" } },
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Fee plan nahi mila." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        membershipsCount: plan._count.memberships,
      },
    });
  } catch (error) {
    console.error("Get Fee Plan Error:", error);
    return NextResponse.json({ success: false, error: "Fee plan load karne mein khata aayi." }, { status: 500 });
  }
}

async function putHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Fee plan edit karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await prisma.feePlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Fee plan nahi mila." }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      description,
      durationValue,
      durationUnit,
      membershipFee,
      admissionFee,
      includedServices,
      eligibility,
      paymentTerms,
      isActive,
    } = body;

    const updates: any = {};
    let shouldIncrementVersion = false;

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description ? description.trim() : null;
    if (durationValue !== undefined) {
      const dur = parseInt(durationValue, 10);
      if (dur !== existing.durationValue) {
        updates.durationValue = dur;
        shouldIncrementVersion = true;
      }
    }
    if (durationUnit !== undefined && durationUnit !== existing.durationUnit) {
      updates.durationUnit = durationUnit as DurationUnit;
      shouldIncrementVersion = true;
    }
    if (membershipFee !== undefined) {
      const fee = parseFloat(membershipFee);
      if (fee !== existing.membershipFee) {
        updates.membershipFee = fee;
        shouldIncrementVersion = true;
      }
    }
    if (admissionFee !== undefined) {
      updates.admissionFee = parseFloat(admissionFee) || 0;
    }
    if (includedServices !== undefined) updates.includedServices = includedServices ? includedServices.trim() : null;
    if (eligibility !== undefined) updates.eligibility = eligibility ? eligibility.trim() : "Everyone";
    if (paymentTerms !== undefined) updates.paymentTerms = paymentTerms as PaymentTerms;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    shouldIncrementVersion = Object.entries(updates).some(([key, value]) =>
      key !== "isActive" && value !== (existing as any)[key]
    );
    if (shouldIncrementVersion) {
      updates.version = existing.version + 1;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Archive existing version into history
      if (shouldIncrementVersion) await tx.feePlanHistory.create({
        data: {
          feePlanId: existing.id,
          version: existing.version,
          name: existing.name,
          description: existing.description,
          durationValue: existing.durationValue,
          durationUnit: existing.durationUnit,
          membershipFee: existing.membershipFee,
          admissionFee: existing.admissionFee,
          includedServices: existing.includedServices,
          eligibility: existing.eligibility,
          paymentTerms: existing.paymentTerms,
          changedById: current.user.id,
          changeReason: body.changeReason || "Plan terms or fee updated",
        },
      });

      const p = await tx.feePlan.update({
        where: { id, version: existing.version },
        data: updates,
      });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "FEE_PLAN_UPDATED",
          entityType: "FEE_PLAN",
          entityId: p.id,
          details: JSON.stringify({
            planId: p.id,
            name: p.name,
            version: p.version,
            updates,
          }),
        },
      });

      return p;
    });

    return NextResponse.json({
      success: true,
      message: `Fee Plan '${updated.name}' kamiyabi se update ho gaya! (Version ${updated.version})`,
      plan: updated,
    });
  } catch (error) {
    console.error("Update Fee Plan Error:", error);
    return NextResponse.json({ success: false, error: "Fee plan update karne mein khata aayi." }, { status: 500 });
  }
}

async function deleteHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Fee plan delete ya deactivate karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const plan = await prisma.feePlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Fee plan nahi mila." }, { status: 404 });
    }

    // Point 11: Used plan permanently delete nahi hoga; deactivate hoga!
    if (plan._count.memberships > 0) {
      const deactivated = await prisma.$transaction(async (tx) => {
        const p = await tx.feePlan.update({
          where: { id },
          data: { isActive: false },
        });

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "FEE_PLAN_DEACTIVATED",
            entityType: "FEE_PLAN",
            entityId: id,
            details: JSON.stringify({
              name: p.name,
              reason: "Plan has existing membership agreements; deactivated to preserve historical integrity.",
            }),
          },
        });

        return p;
      });

      return NextResponse.json({
        success: true,
        action: "DEACTIVATED",
        message: `Plan '${deactivated.name}' pehle se members ke paas use ho chuka hai, is liye isko Deactivate kar diya gaya hai taake purani agreements mehfooz rahein.`,
        plan: deactivated,
      });
    }

    // Unused draft plan can be deleted permanently
    await prisma.$transaction(async (tx) => {
      await tx.feePlan.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "FEE_PLAN_DELETED",
          entityType: "FEE_PLAN",
          entityId: id,
          details: JSON.stringify({
            name: plan.name,
            reason: "Unused draft fee plan deleted permanently.",
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      action: "DELETED",
      message: `Unused fee plan '${plan.name}' permanently delete ho gaya.`,
    });
  } catch (error) {
    console.error("Delete Fee Plan Error:", error);
    return NextResponse.json({ success: false, error: "Fee plan remove karne mein khata aayi." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const PUT = withReadCache(putHandler);
export const DELETE = withReadCache(deleteHandler);
