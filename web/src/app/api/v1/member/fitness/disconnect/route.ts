import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, FitnessConnectionStatus } from "@prisma/client";

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

    const connection = await prisma.fitnessConnection.updateMany({
      where: { gymMemberId },
      data: {
        status: FitnessConnectionStatus.DISCONNECTED,
        reportedPermissions: [],
        trainerSharingEnabled: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Fitness connection disconnect ho gayi. Future sync stop ho gaya; existing history mehfooz hai.",
      data: { count: connection.count },
    });
  } catch (error: any) {
    console.error("POST disconnect error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to disconnect." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
