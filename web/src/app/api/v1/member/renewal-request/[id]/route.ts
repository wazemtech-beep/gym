import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, RenewalRequestStatus } from "@prisma/client";

async function deleteHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;
    if (current.user.role !== Role.MEMBER || current.user.mustChangePassword) return NextResponse.json({ success: false, error: "Member access required." }, { status: 403 });
    const renewalRequest = await prisma.renewalRequest.findUnique({
      where: { id, status: RenewalRequestStatus.PENDING, gymMember: { userId: current.user.id } },
      include: {
        gymMember: true,
      },
    });

    if (!renewalRequest) {
      return NextResponse.json({ success: false, error: "Renewal request nahi mili." }, { status: 404 });
    }

    // Security check: Member can only withdraw their own pending request
    if (current.user.role === Role.MEMBER) {
      if (renewalRequest.gymMember.userId !== current.user.id) {
        return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 403 });
      }
    }

    if (renewalRequest.status !== RenewalRequestStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: "Sirf PENDING renewal request withdraw ki ja sakti hai." },
        { status: 400 }
      );
    }

    const updated = await prisma.renewalRequest.update({
      where: { id, status: RenewalRequestStatus.PENDING, gymMember: { userId: current.user.id } },
      data: {
        status: RenewalRequestStatus.WITHDRAWN,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "RENEWAL_REQUEST_WITHDRAWN",
        entityType: "RENEWAL_REQUEST",
        entityId: id,
        details: JSON.stringify({ requestId: id }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Renewal request kamyabi se withdraw kar li gayi.",
      data: updated,
    });
  } catch (error: any) {
    console.error("WITHDRAW_RENEWAL_ERROR:", error);
    return NextResponse.json({ success: false, error: "Request withdraw karne mein masla aya." }, { status: 500 });
  }
}

// Allow PATCH as well for convenient clients
async function patchHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return DELETE(req, { params });
}

export const DELETE = withReadCache(deleteHandler);
export const PATCH = withReadCache(patchHandler);
