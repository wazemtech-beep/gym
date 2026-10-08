import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { applyMembershipLifecycle } = await import("../src/lib/membershipLifecycle");
  const { runReminderScheduler, runScheduledAnnouncementWorker, processNotificationOutbox } = await import("../src/lib/notifications");
  let stopping = false;
  let lastHeartbeat = 0;
  process.once("SIGTERM", () => { stopping = true; });
  process.once("SIGINT", () => { stopping = true; });
  while (!stopping) {
    try {
      await applyMembershipLifecycle();
      await runReminderScheduler();
      await runScheduledAnnouncementWorker();
      await processNotificationOutbox();
      if (Date.now() - lastHeartbeat > 300000) { const { prisma } = await import("../src/lib/db"); await prisma.auditLog.create({ data: { actorName: "Background worker", action: "BACKGROUND_WORKER_HEARTBEAT", entityType: "SYSTEM" } }); lastHeartbeat = Date.now(); }
    } catch (error) { console.error("Background worker failed", error); }
    finally {
      // Scheduled changes and partially completed batches must refresh open screens.
      const { invalidateServerReads } = await import("../src/lib/readCacheRevision");
      await invalidateServerReads();
    }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 60000));
  }
  const { prisma } = await import("../src/lib/db");
  await prisma.$disconnect();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
