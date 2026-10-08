import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotificationDeliveryStatus } from "@prisma/client";

async function patchHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json({ success: false, error: "Notification nahi mili." }, { status: 404 });
    }

    // Security check: Must belong to current user
    if (notification.userId !== current.user.id) {
      return NextResponse.json({ success: false, error: "Aap is notification ko access nahi kar sakte." }, { status: 403 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
        deliveryStatus: NotificationDeliveryStatus.READ,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PATCH_NOTIFICATION_READ_ERROR:", error);
    return NextResponse.json({ success: false, error: "Notification read mark karne mein masla aya." }, { status: 500 });
  }
}

export const PATCH = withReadCache(patchHandler);
