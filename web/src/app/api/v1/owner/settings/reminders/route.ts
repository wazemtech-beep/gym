import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Sirf Owner access kar sakta hai." }, { status: 403 });
    }

    let config = await prisma.reminderScheduleConfig.findFirst();
    if (!config) {
      config = await prisma.reminderScheduleConfig.create({
        data: {
          membershipExpiryDays: [7, 1],
          installmentDueNotice: true,
          overdueGraceDays: 3,
          membershipExpiredNotice: true,
          timezone: "Asia/Karachi",
        },
      });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    console.error("GET_REMINDER_SETTINGS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Settings load nahi huin." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Sirf Owner modify kar sakta hai." }, { status: 403 });
    }

    const body = await req.json();
    const {
      membershipExpiryDays = [7, 1],
      installmentDueNotice = true,
      overdueGraceDays = 3,
      membershipExpiredNotice = true,
      timezone = "Asia/Karachi",
    } = body;

    let existing = await prisma.reminderScheduleConfig.findFirst();

    const config = existing
      ? await prisma.reminderScheduleConfig.update({
          where: { id: existing.id },
          data: {
            membershipExpiryDays,
            installmentDueNotice,
            overdueGraceDays,
            membershipExpiredNotice,
            timezone,
          },
        })
      : await prisma.reminderScheduleConfig.create({
          data: {
            membershipExpiryDays,
            installmentDueNotice,
            overdueGraceDays,
            membershipExpiredNotice,
            timezone,
          },
        });

    return NextResponse.json({
      success: true,
      message: "Reminder schedule settings update ho gayi hain.",
      data: config,
    });
  } catch (error: any) {
    console.error("POST_REMINDER_SETTINGS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Settings save karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
