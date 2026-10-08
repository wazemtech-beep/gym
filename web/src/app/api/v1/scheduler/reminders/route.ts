import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { Role } from "@prisma/client";
import { applyMembershipLifecycle } from "@/lib/membershipLifecycle";
import {
  runReminderScheduler,
  runScheduledAnnouncementWorker,
  processNotificationOutbox,
} from "@/lib/notifications";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    // Allow cron with secret or authenticated owner
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
    const isOwner = current?.user?.role === Role.OWNER;

    if (!isCron && !isOwner) {
      return NextResponse.json({ success: false, error: "Unauthorized access to scheduler." }, { status: 403 });
    }

    await applyMembershipLifecycle();
    const remindersResult = await runReminderScheduler();
    const announcementsResult = await runScheduledAnnouncementWorker();
    const outboxResult = await processNotificationOutbox();

    return NextResponse.json({
      success: remindersResult.success && announcementsResult.success && outboxResult.success,
      message: "System background processing scan mukammal ho gaya.",
      data: {
        reminders: remindersResult.results,
        announcements: announcementsResult.results,
        outbox: outboxResult.results,
      },
    });
  } catch (error: any) {
    console.error("SCHEDULER_ROUTE_ERROR:", error);
    return NextResponse.json({ success: false, error: "Scheduler chalane mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
