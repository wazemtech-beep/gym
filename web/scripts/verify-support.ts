import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { getGymAuth } from "../src/lib/gymAuth";
import { enqueueNotification, processNotificationOutbox, sanitizeLockScreenMessage } from "../src/lib/notifications";
import { cachedServerRead } from "../src/lib/serverReadCache";
import { invalidateServerReads } from "../src/lib/readCacheRevision";
import { passwordResetEmail } from "../src/lib/accountEmail";

async function main() {
  const tag = "verify-support-" + randomBytes(8).toString("hex");
  let userId: string | undefined, passed = 0;
  function check(label: string, valid: unknown) { if (!valid) throw new Error(label); passed++; console.log("PASS " + label); }
  try {
    const context = await getGymAuth().$context;
    check("auth context initialized", context.internalAdapter && context.password);
    const user = await prisma.user.create({ data: { name: tag, email: tag + "@example.invalid", role: "MEMBER" } });
    userId = user.id;
    const event = await prisma.$transaction(tx => enqueueNotification(tx, { recipientUserId: user.id, eventType: "VERIFICATION_ONLY", title: "Verification", message: "Temporary verification record", category: "OPERATIONAL", dedupKey: tag, channels: ["IN_APP"] }));
    const result = await processNotificationOutbox(1, [event.id]);
    check("scoped outbox processing", result.success && result.results.processedCount === 1 && result.results.errors.length === 0);
    const delivery = await prisma.notification.findFirst({ where: { eventId: event.id } });
    check("in-app notification delivered", delivery?.deliveryStatus === "ACCEPTED" && delivery.userId === user.id);
    check("external channels skipped", delivery?.emailStatus === "SKIPPED" && delivery.pushStatus === "SKIPPED");
    check("event marked processed", (await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } })).processed);
    const duplicate = await processNotificationOutbox(1, [event.id]);
    check("outbox rerun avoids duplicate", duplicate.results.processedCount === 0 && await prisma.notification.count({ where: { eventId: event.id } }) === 1);
    check("lockscreen hides sensitive amounts", !sanitizeLockScreenMessage("Payment", "Rs. 500 dues").message.includes("500"));
    await invalidateServerReads();
    let reads = 0;
    const read = async () => ++reads;
    check("server read initial value", await cachedServerRead(tag, read, tag, {}) === 1);
    check("server read reused", await cachedServerRead(tag, read, tag, {}) === 1 && reads === 1);
    check("cache isolates scopes", await cachedServerRead(tag, read, tag + "other", {}) === 2);
    await invalidateServerReads();
    check("cache refreshes after revision", await cachedServerRead(tag, read, tag, {}) === 3);
    const template = passwordResetEmail("<script>alert(1)</script>", "https://example.invalid/reset?token=verification");
    check("reset template escapes input and has text fallback", !template.html.includes("<script>") && template.text.includes("token=verification") && template.html.includes("Reset password"));
    console.log(JSON.stringify({ check: "support-runtime", passed, failed: 0, emailsSent: 0 }));
  } catch (error) { console.log("FAIL " + (error instanceof Error ? error.message : "support check")); process.exitCode = 1; }
  finally { if (userId) await prisma.user.delete({ where: { id: userId } }); await prisma.$disconnect(); }
}
void main();
