import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { RenewalRequestStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "MEMBERSHIP_ASSIGN_RENEW")) {
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as RenewalRequestStatus | null;

    const where: any = {};
    if (statusParam && Object.values(RenewalRequestStatus).includes(statusParam)) {
      where.status = statusParam;
    }

    const requests = await prisma.renewalRequest.findMany({
      where,
      include: {
        gymMember: {
          select: {
            id: true,
            memberId: true,
            fullName: true,
            phone: true,
            email: true,
            photoUrl: true,
          },
        },
        feePlan: true,
        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: requests });
  } catch (error: any) {
    console.error("STAFF_RENEWALS_GET_ERROR:", error);
    return NextResponse.json({ success: false, error: "Renewal requests load nahi huin." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
