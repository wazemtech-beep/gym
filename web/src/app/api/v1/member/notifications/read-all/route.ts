import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotificationDeliveryStatus } from "@prisma/client";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: current.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
        deliveryStatus: NotificationDeliveryStatus.READ,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Tamam notifications read mark kar di gayi hain.",
      updatedCount: result.count,
    });
  } catch (error: any) {
    console.error("MARK_ALL_NOTIFICATIONS_READ_ERROR:", error);
    return NextResponse.json({ success: false, error: "Notifications read mark karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
