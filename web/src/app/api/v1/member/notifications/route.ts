import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotificationCategory } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get("category");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "40", 10);

    const whereClause: any = {
      userId: current.user.id,
    };

    if (unreadOnly) {
      whereClause.isRead = false;
    }

    if (categoryParam && Object.values(NotificationCategory).includes(categoryParam as NotificationCategory)) {
      whereClause.category = categoryParam as NotificationCategory;
    }

    // Count unread
    const unreadCount = await prisma.notification.count({
      where: {
        userId: current.user.id,
        isRead: false,
      },
    });

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        announcement: {
          select: {
            title: true,
            priority: true,
            attachmentUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: any) {
    console.error("GET_NOTIFICATIONS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Notifications load nahi huin." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
