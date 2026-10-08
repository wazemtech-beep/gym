import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { FreezeRequestStatus, Role } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) {
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || "ALL";

    const where: any = {};
    if (statusParam !== "ALL") {
      where.status = statusParam as FreezeRequestStatus;
    }

    const requests = await prisma.membershipFreezeRequest.findMany({
      where,
      include: {
        gymMember: {
          select: {
            id: true,
            memberId: true,
            fullName: true,
            phone: true,
            userId: true,
          },
        },
        membership: {
          select: {
            id: true,
            planName: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        reviewedBy: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error("GET_STAFF_FREEZE_REQUESTS_ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
