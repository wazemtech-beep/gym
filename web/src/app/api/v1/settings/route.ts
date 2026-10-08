import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import { getGymSettings, updateGymSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";

async function getHandler() {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const settings = await getGymSettings();

    // If Owner, return full operational config and system health
    if (current.user.role === Role.OWNER) {
      const paymentAccounts = await prisma.receivingAccount.findMany({
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });

      const staffList = await prisma.user.findMany({
        where: { role: { in: [Role.RECEPTIONIST, Role.TRAINER] } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          permissionGrants: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        success: true,
        settings,
        paymentAccounts,
        staffList,
        systemStatus: {
          database: "CONNECTED",
          timezone: settings.timezone,
          currency: settings.currency,
          activeAccountsCount: paymentAccounts.filter((a) => a.isActive).length,
          totalStaffCount: staffList.length,
        },
      });
    }

    // Non-owner gets public branding & preferences
    return NextResponse.json({
      success: true,
      settings: {
        gymName: settings.gymName,
        tagline: settings.tagline,
        contactPhone: settings.contactPhone,
        contactEmail: settings.contactEmail,
        address: settings.address,
        logoUrl: settings.logoUrl,
        receiptPrefix: settings.receiptPrefix,
        currency: settings.currency,
        timezone: settings.timezone,
        attendanceEnabled: settings.attendanceEnabled,
        receiptFooter: settings.receiptFooter,
        receiptPrintFormat: settings.receiptPrintFormat,
      },
    });
  } catch (error) {
    console.error("Get Settings Error:", error);
    return NextResponse.json(
      { success: false, error: "Settings load karne mein khata aayi." },
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
        { success: false, error: "Settings badalne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = await updateGymSettings(body, current.user, req.headers.get("x-forwarded-for") || undefined);

    if (!result.success && result.conflict) {
      return NextResponse.json(
        {
          success: false,
          conflict: true,
          error: result.error,
          currentSettings: result.currentSettings,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Gym settings kamiyabi se update ho gayi hain!",
      settings: result.settings,
      changes: result.changes || [],
    });
  } catch (error) {
    console.error("Update Settings Error:", error);
    return NextResponse.json(
      { success: false, error: "Settings save karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const PATCH = withReadCache(patchHandler);
