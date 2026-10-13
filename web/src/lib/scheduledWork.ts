import { prisma } from "./db";
import { acquireJobLease, releaseJobLease } from "./jobLease";
import { invalidateServerReads } from "./readCacheRevision";
import { applyMembershipLifecycle } from "./membershipLifecycle";
import { processNotificationOutbox, runReminderScheduler } from "./notifications";
import { Prisma, type Announcement } from "@prisma/client";

async function cursor(key: string) {
  return (await prisma.runtimeState.findUnique({ where: { key }, select: { value: true } }))?.value || "";
}
async function checkpoint(key: string, value: string) {
  await prisma.runtimeState.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// Queue at most one recipient page. External delivery happens in the outbox phase.
export async function queueAnnouncementBatch(ann: Announcement, limit = 25) {
  const completionKey = `announcement:${ann.id}`;
  if (ann.recipientCount > 0 || await cursor(completionKey) === "complete") return { queued: 0, complete: true };
  const audience: Prisma.UserWhereInput = ann.audience === "STAFF"
    ? { role: { in: ["OWNER", "RECEPTIONIST", "TRAINER"] } }
    : ann.audience === "SELECTED_MEMBERS" ? { id: { in: ann.targetMemberIds } }
    : { memberProfile: { is: { ...(ann.audience === "ACTIVE_MEMBERS" ? { memberships: { some: { status: "ACTIVE", startDate: { lte: new Date() }, endDate: { gte: new Date() } } } } : {}) } } };
  const prefix = `announcement-${ann.id}-`;
  const recipients = await prisma.user.findMany({
    where: { ...audience, notificationEvents: { none: { dedupKey: { startsWith: prefix } } } },
    select: { id: true }, orderBy: { id: "asc" }, take: limit,
  });
  const complete = recipients.length < limit;
  return prisma.$transaction(async tx => {
    // Recheck publishing state before enqueueing a page selected earlier.
    const live = await tx.announcement.findUnique({ where: { id: ann.id } });
    const now = new Date();
    if (!live?.isPublished || live.publishAt > now || (live.expiresAt && live.expiresAt <= now)) return { queued: 0, complete: true };
    if (live.version !== ann.version) return { queued: 0, complete: false };
    const inserted = await tx.notificationEvent.createMany({ skipDuplicates: true, data: recipients.map(user => ({
      recipientUserId: user.id, eventType: "ANNOUNCEMENT_PUBLISHED", title: live.title, message: live.content,
      category: "ANNOUNCEMENT", entityType: "ANNOUNCEMENT", entityId: live.id,
      actionUrl: "/dashboard", dedupKey: prefix + user.id,
      metadata: { channels: live.channels, attempts: 0, announcementId: live.id },
    })) });
    if (complete) {
      const recipientCount = await tx.notificationEvent.count({ where: { dedupKey: { startsWith: prefix } } });
      await tx.announcement.update({ where: { id: live.id }, data: { recipientCount } });
      await tx.runtimeState.upsert({ where: { key: completionKey }, create: { key: completionKey, value: "complete" }, update: { value: "complete" } });
    }
    return { queued: inserted.count, complete };
  }, { maxWait: 10000, timeout: 15000 });
}

type Scope = {
  // Only internal verification scripts supply a scope; HTTP callers cannot.
  namespace?: string; memberIds?: string[]; announcementIds?: string[]; eventIds?: string[];
  maxMillis?: number; batchSize?: number;
};

export async function runScheduledWork(scope: Scope = {}) {
  const prefix = scope.namespace || "scheduler";
  const key = prefix + ":lease";
  const owner = await acquireJobLease(key);
  if (!owner) return { success: true, skipped: true, message: "A scheduled run is already active." };
  const start = Date.now();
  const budget = Math.max(0, Math.min(200000, scope.maxMillis ?? 200000));
  const batch = Math.max(1, Math.min(100, scope.batchSize ?? 50));
  const memberDeadline = start + Math.min(60000, budget / 3);
  const announcementDeadline = start + Math.min(90000, budget / 2);
  const deadline = start + budget;
  const results = { membersProcessed: 0, announcementsQueued: 0, outboxProcessed: 0, morePending: false };
  try {
    const memberKey = prefix + ":member-cursor";
    const after = await cursor(memberKey);
    const members = await prisma.gymMember.findMany({ where: { status: "CURRENT", ...(scope.memberIds ? { id: { in: scope.memberIds, ...(after ? { gt: after } : {}) } } : after ? { id: { gt: after } } : {}) }, select: { id: true }, orderBy: { id: "asc" }, take: batch });
    for (const member of members) {
      if (Date.now() >= memberDeadline) { results.morePending = true; break; }
      await applyMembershipLifecycle(member.id);
      const reminders = await runReminderScheduler(member.id, { enqueueOnly: true });
      if (!reminders.success) throw new Error("Reminder scan failed");
      await checkpoint(memberKey, member.id);
      results.membersProcessed++;
    }
    if (results.membersProcessed === members.length && members.length < batch) await checkpoint(memberKey, "");

    const announcementKey = prefix + ":announcement-cursor";
    const annAfter = await cursor(announcementKey);
    const announcements = await prisma.announcement.findMany({ where: {
      isPublished: true, publishAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(scope.announcementIds ? { id: { in: scope.announcementIds, ...(annAfter ? { gt: annAfter } : {}) } } : annAfter ? { id: { gt: annAfter } } : {}),
    }, orderBy: { id: "asc" }, take: 10 });
    let completed = 0;
    for (const ann of announcements) {
      if (Date.now() >= announcementDeadline) { results.morePending = true; break; }
      const queued = await queueAnnouncementBatch(ann, batch);
      results.announcementsQueued += queued.queued;
      if (!queued.complete) { results.morePending = true; break; }
      await checkpoint(announcementKey, ann.id); completed++;
    }
    if (completed === announcements.length && announcements.length < 10) await checkpoint(announcementKey, "");

    // Limit both count and elapsed time; unprocessed rows survive for the next cron.
    const attempted: string[] = [];
    for (let i = 0; i < 25 && Date.now() < deadline; i++) {
      const pending = await prisma.notificationEvent.findFirst({ where: { processed: false, id: { notIn: attempted, ...(scope.eventIds ? { in: scope.eventIds } : {}) } }, select: { id: true }, orderBy: { createdAt: "asc" } });
      if (!pending) break;
      attempted.push(pending.id);
      const outbox = await processNotificationOutbox(1, [pending.id]);
      if (!outbox.success) throw new Error("Notification delivery batch failed");
      results.outboxProcessed += outbox.results.processedCount;
      if (!outbox.results.processedCount) break;
    }
    results.morePending ||= results.outboxProcessed === 25 || members.length === batch || announcements.length === 10;
    await checkpoint(prefix + ":heartbeat", JSON.stringify(results));
    return { success: true, skipped: false, results };
  } finally {
    await invalidateServerReads();
    await releaseJobLease(key, owner);
  }
}
