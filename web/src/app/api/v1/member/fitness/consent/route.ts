import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

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

    const body = await req.json();
    const { consent, version = "v1.0" } = body;

    if (typeof consent !== "boolean") {
      return NextResponse.json({ success: false, error: "Consent boolean value honi chahiye." }, { status: 400 });
    }

    const connection = await prisma.fitnessConnection.upsert({
      where: { gymMemberId },
      create: {
        gymMemberId,
        backendUploadConsent: consent,
        backendUploadConsentVersion: consent ? version : null,
        backendUploadConsentAt: consent ? new Date() : null,
      },
      update: {
        backendUploadConsent: consent,
        backendUploadConsentVersion: consent ? version : null,
        backendUploadConsentAt: consent ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: consent
        ? "Backend upload consent save ho gayi."
        : "Backend upload consent revoke kar di gayi. Cloud par naya data upload nahi hoga.",
      data: { connection },
    });
  } catch (error: any) {
    console.error("POST fitness consent error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update consent." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
