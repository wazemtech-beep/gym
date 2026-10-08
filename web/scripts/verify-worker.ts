import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { applyMembershipLifecycle } from "../src/lib/membershipLifecycle";
import { runReminderScheduler, runScheduledAnnouncementWorker } from "../src/lib/notifications";

async function main() {
  const tag = "verify-worker-" + randomBytes(8).toString("hex");
  let userId: string | undefined, memberId: string | undefined, announcementId: string | undefined;
  const memberships: string[] = [];
  let passed = 0;
  function check(label: string, good: unknown) { if (!good) throw new Error(label); passed++; console.log("PASS " + label); }
  try {
    const user = await prisma.user.create({ data: { name: tag, role: "MEMBER" } }); userId = user.id;
    const member = await prisma.gymMember.create({ data: { fullName: tag, memberId: tag, phone: "03000000000", userId: user.id } }); memberId = member.id;
    const now = Date.now(), day = 86400000;
    const add = async (data: object) => { const m = await prisma.membership.create({ data: { gymMemberId: member.id, planName: tag, startDate: new Date(now - day), endDate: new Date(now + 10 * day), ...data } }); memberships.push(m.id); return m; };
    const upcoming = await add({ status: "UPCOMING" });
    const expired = await add({ status: "ACTIVE", endDate: new Date(now - day) });
    const freezing = await add({ status: "ACTIVE", frozenAt: new Date(now - 2 * day), freezeResumeDate: new Date(now + day) });
    await applyMembershipLifecycle(member.id);
    check("upcoming membership activates", (await prisma.membership.findUniqueOrThrow({ where: { id: upcoming.id } })).status === "ACTIVE");
    check("past membership expires", (await prisma.membership.findUniqueOrThrow({ where: { id: expired.id } })).status === "EXPIRED");
    check("scheduled freeze begins", (await prisma.membership.findUniqueOrThrow({ where: { id: freezing.id } })).status === "FROZEN");
    await prisma.membership.update({ where: { id: freezing.id }, data: { freezeResumeDate: new Date(now - day) } });
    await applyMembershipLifecycle(member.id);
    const resumed = await prisma.membership.findUniqueOrThrow({ where: { id: freezing.id } });
    check("freeze resumes and extends expiry", resumed.status === "ACTIVE" && !resumed.frozenAt && resumed.endDate.getTime() === freezing.endDate.getTime() + day);
    const settings = await prisma.gymSettings.findFirst();
    const reminderDays = settings?.expiryReminderDays ?? [7, 1];
    if (reminderDays.length) {
      const reminder = await add({ endDate: new Date(now + reminderDays[0] * day) });
      const run = await runReminderScheduler(member.id);
      check("scoped expiry reminders run", run.success);
      const before = await prisma.notification.count({ where: { userId: user.id, entityType: "MEMBERSHIP" } });
      check("expiry reminder reaches fixture", before > 0);
      await runReminderScheduler(member.id);
      check("reminder rerun is idempotent", await prisma.notification.count({ where: { userId: user.id, entityType: "MEMBERSHIP" } }) === before);
    } else console.log("SKIP expiry reminders disabled by gym settings");
    const announcement = await prisma.announcement.create({ data: { title: tag, content: "Temporary in-app verification", authorId: user.id, audience: "SELECTED_MEMBERS", targetMemberIds: [user.id], channels: ["IN_APP"], publishAt: new Date(now + day) } }); announcementId = announcement.id;
    check("future announcement stays pending", (await runScheduledAnnouncementWorker([announcement.id])).results.broadcastedAnnouncements === 0);
    await prisma.announcement.update({ where: { id: announcement.id }, data: { publishAt: new Date(now - day) } });
    check("due announcement dispatched", (await runScheduledAnnouncementWorker([announcement.id])).results.totalRecipientsNotified === 1);
    check("announcement rerun avoids duplicates", (await runScheduledAnnouncementWorker([announcement.id])).results.broadcastedAnnouncements === 0 && await prisma.notification.count({ where: { announcementId: announcement.id } }) === 1);
    check("no external messages sent", await prisma.notification.count({ where: { userId: user.id, OR: [{ emailStatus: "ACCEPTED" }, { pushStatus: "ACCEPTED" }] } }) === 0);
    console.log(JSON.stringify({ check: "worker-runtime", passed, failed: 0, externalMessagesSent: 0 }));
  } catch (error) { console.log("FAIL " + (error instanceof Error ? error.message : "worker check")); process.exitCode = 1; }
  finally {
    if (announcementId) await prisma.announcement.delete({ where: { id: announcementId } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...memberships, ...(memberId ? [memberId] : [])] } } });
    if (memberId) await prisma.gymMember.delete({ where: { id: memberId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}
void main();
