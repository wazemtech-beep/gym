import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotificationCategory, Role } from "@prisma/client";
import { dispatchNotification } from "@/lib/notifications";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { id } = await params;

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { name: true, role: true } },
        notifications: {
          select: {
            id: true,
            userId: true,
            isRead: true,
            deliveryStatus: true,
            emailStatus: true,
            pushStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!announcement) {
      return NextResponse.json({ success: false, error: "Announcement nahi mili." }, { status: 404 });
    }

    // Calculate delivery metrics for owner
    const totalDispatched = announcement.notifications.length;
    const readCount = announcement.notifications.filter((n) => n.isRead).length;
    const emailAccepted = announcement.notifications.filter((n) => n.emailStatus === "ACCEPTED").length;
    const emailFailed = announcement.notifications.filter((n) => n.emailStatus === "FAILED").length;
    const pushAccepted = announcement.notifications.filter((n) => n.pushStatus === "ACCEPTED").length;

    return NextResponse.json({
      success: true,
      data: {
        announcement,
        analytics: {
          totalDispatched,
          readCount,
          emailAccepted,
          emailFailed,
          pushAccepted,
        },
      },
    });
  } catch (error: any) {
    console.error("GET_OWNER_ANNOUNCEMENT_ERROR:", error);
    return NextResponse.json({ success: false, error: "Announcement load nahi hui." }, { status: 500 });
  }
}

async function patchHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json({ success: false, error: "Ijazat nahi hai." }, { status: 403 });
    }

    const { id } = await params;
    const announcement = await prisma.announcement.findUnique({ where: { id } });

    if (!announcement) {
      return NextResponse.json({ success: false, error: "Announcement nahi mili." }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      content,
      category,
      pinned,
      audience,
      priority,
      publishAt,
      expiresAt,
      cancelSchedule,
      notifyUpdate = false,
    } = body;

    // Handle cancel schedule
    if (cancelSchedule) {
      const cancelled = await prisma.announcement.update({
        where: { id },
        data: { isPublished: false },
      });
      return NextResponse.json({
        success: true,
        message: "Scheduled announcement cancel ho gayi hai.",
        data: cancelled,
      });
    }

    const newVersion = announcement.isPublished ? announcement.version + 1 : announcement.version;

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        ...(category && { category: category.trim().toUpperCase() }),
        ...(pinned !== undefined && { pinned: !!pinned }),
        ...(audience && { audience }),
        ...(priority && { priority }),
        ...(publishAt && { publishAt: new Date(publishAt) }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        version: newVersion,
      },
    });

    // Requirement 9: "Published announcement edit karne se automatic new email/push nahi jayegi, jab tak owner Notify about update choose na kare."
    if (notifyUpdate && updated.isPublished) {
      // Re-broadcast to existing notification recipients
      const existingNotifs = await prisma.notification.findMany({
        where: { announcementId: id },
        select: { userId: true },
      });

      for (const n of existingNotifs) {
        await dispatchNotification({
          recipientUserId: n.userId,
          eventType: "ANNOUNCEMENT_UPDATED",
          title: `Updated: ${updated.title}`,
          message: updated.content,
          category: NotificationCategory.ANNOUNCEMENT,
          entityType: "ANNOUNCEMENT",
          entityId: updated.id,
          actionUrl: "/dashboard",
          announcementId: updated.id,
          dedupKey: `announcement-upd-v${newVersion}-${updated.id}-${n.userId}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Announcement update ho gayi.",
      data: updated,
    });
  } catch (error: any) {
    console.error("PATCH_OWNER_ANNOUNCEMENT_ERROR:", error);
    return NextResponse.json({ success: false, error: "Announcement update karne mein masla aya." }, { status: 500 });
  }
}

async function deleteHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Sirf Owner delete kar sakta hai." }, { status: 403 });
    }

    const { id } = await params;

    await prisma.announcement.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Announcement delete ho gayi." });
  } catch (error: any) {
    console.error("DELETE_ANNOUNCEMENT_ERROR:", error);
    return NextResponse.json({ success: false, error: "Announcement delete karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const PATCH = withReadCache(patchHandler);
export const DELETE = withReadCache(deleteHandler);
