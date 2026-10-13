import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  AnnouncementAudience,
  AnnouncementPriority,
  Role,
} from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const now = new Date();
    const isStaff =
      current.user.role === Role.OWNER ||
      current.user.role === Role.RECEPTIONIST ||
      current.user.role === Role.TRAINER;

    // Build audience filter based on current user role
    const audienceFilter: AnnouncementAudience[] = [AnnouncementAudience.ALL_MEMBERS];

    if (isStaff) {
      audienceFilter.push(AnnouncementAudience.STAFF);
    } else {
      // Member checks
      const hasActive = await prisma.membership.findFirst({
        where: { gymMember: { userId: current.user.id }, status: "ACTIVE" },
      });
      if (hasActive) {
        audienceFilter.push(AnnouncementAudience.ACTIVE_MEMBERS);
      }
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        isPublished: true,
        publishAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
        AND: [
          {
            OR: [
              { audience: { in: audienceFilter } },
              { targetMemberIds: { has: current.user.id } },
            ],
          },
        ],
      },
      orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
      take: 20,
      include: {
        author: {
          select: { name: true, role: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: announcements });
  } catch (error: any) {
    console.error("GET_ANNOUNCEMENTS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Announcements load nahi huin." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Only OWNER (or authorized staff) can publish announcements
    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json({ success: false, error: "Announcement create karne ki ijazat nahi hai." }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      content,
      category = "GENERAL",
      pinned = false,
      audience = "ALL_MEMBERS",
      priority = "NORMAL",
      publishAt,
      expiresAt,
      channels = ["IN_APP"],
      attachmentUrl,
      targetMemberIds = [],
      isDraft = false,
    } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, error: "Title aur content lazmi hain." }, { status: 400 });
    }

    const effectivePublishAt = publishAt ? new Date(publishAt) : new Date();
    const effectiveExpiresAt = expiresAt ? new Date(expiresAt) : null;
    const isPublished = !isDraft;

    // 1. Create Announcement record
    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category: category.trim().toUpperCase(),
        pinned: !!pinned,
        audience: audience as AnnouncementAudience,
        priority: priority as AnnouncementPriority,
        publishAt: effectivePublishAt,
        expiresAt: effectiveExpiresAt,
        channels: Array.isArray(channels) ? channels : ["IN_APP"],
        attachmentUrl: attachmentUrl || null,
        targetMemberIds: Array.isArray(targetMemberIds) ? targetMemberIds : [],
        isPublished,
        authorId: current.user.id,
      },
    });

    // Publishing is immediate; audience delivery is durably picked up by cron.
    // Never send an unbounded broadcast inside a serverless HTTP request.

    return NextResponse.json({
      success: true,
      message: isPublished ? "Announcement publish ho gayi. Notifications delivery pending hai." : "Announcement draft save ho gayi.",
      data: announcement,
    });
  } catch (error: any) {
    console.error("CREATE_ANNOUNCEMENT_ERROR:", error);
    return NextResponse.json({ success: false, error: "Announcement banane mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
