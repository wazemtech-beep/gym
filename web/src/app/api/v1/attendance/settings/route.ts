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

    const settings = await prisma.gymSettings.findFirst();

    return NextResponse.json({
      success: true,
      attendanceEnabled: settings?.attendanceEnabled || false,
    });
  } catch (error) {
    console.error("Get Attendance Settings Error:", error);
    return NextResponse.json(
      { success: false, error: "Settings load karne mein masla aaya." },
      { status: 500 }
    );
  }
}

async function patchHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Attendance setting badalne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Enabled value boolean honi chahiye." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      let settings = await tx.gymSettings.findFirst();
      if (!settings) {
        settings = await tx.gymSettings.create({
          data: {
            id: "default",
            gymName: "OXGEN GYM",
            attendanceEnabled: enabled,
          },
        });
      } else {
        settings = await tx.gymSettings.update({
          where: { id: settings.id },
          data: { attendanceEnabled: enabled },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "ATTENDANCE_SETTING_TOGGLED",
          entityType: "SETTINGS",
          details: JSON.stringify({ attendanceEnabled: enabled }),
        },
      });

      return settings;
    });

    return NextResponse.json({
      success: true,
      message: `Attendance feature is now ${updated.attendanceEnabled ? "ENABLED" : "DISABLED"}!`,
      attendanceEnabled: updated.attendanceEnabled,
    });
  } catch (error) {
    console.error("Toggle Attendance Setting Error:", error);
    return NextResponse.json(
      { success: false, error: "Setting update karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const PATCH = withReadCache(patchHandler);
