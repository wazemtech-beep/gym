import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, AccountStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const trainers = await prisma.user.findMany({
      where: {
        role: Role.TRAINER,
        status: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        status: true,
        _count: {
          select: {
            assignedMembers: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: trainers });
  } catch (error: any) {
    console.error("GET_TRAINERS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Trainers load nahi huay." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
