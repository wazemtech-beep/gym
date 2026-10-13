import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { formatKarachiDate, formatKarachiPaymentDate } from "../src/lib/displayDates";

async function main() {
  // Exercise the exact pg adapter/pool branch used by Vercel, not the local engine.
  process.env.VERCEL = "1";
  const { prisma } = await import("../src/lib/db");
  const { validateSession } = await import("../src/lib/auth");
  const { sessionContext } = await import("../src/lib/sessionContext");
  const { withReadCache } = await import("../src/lib/serverReadCache");
  const { PATCH } = await import("../src/app/api/v1/membership/freeze-requests/[id]/route");
  const tag = "verify-deploy-errors-" + randomUUID();
  const users: string[] = [];
  let memberId: string | undefined;
  let passed = 0;
  const check = (label: string, value: unknown) => { assert.ok(value, label); passed++; console.log("PASS " + label); };
  try {
    const previousTimezone = process.env.TZ;
    try {
      for (const timezone of ["UTC", "America/New_York", "Asia/Karachi"]) {
        process.env.TZ = timezone;
        assert.equal(formatKarachiDate("2026-10-12T19:00:00Z"), "Tuesday, 13 Oct 2026");
        assert.equal(formatKarachiDate("2026-10-12T18:59:59Z"), "Monday, 12 Oct 2026");
        assert.equal(formatKarachiPaymentDate("2026-10-13T06:05:00Z"), "11:05 AM, 13 Oct");
      }
    } finally { if (previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone; }
    check("PKT header/payment text agrees across server and browser timezones", true);
    const pool = (globalThis as unknown as { databasePool: import("pg").Pool }).databasePool;
    check("Vercel pool has one connection and releases idle connections", pool.options.max === 1 && pool.options.idleTimeoutMillis === 5000);
    await Promise.all(Array.from({ length: 6 }, () => prisma.$queryRaw`SELECT 1`));
    check("parallel adapter queries reuse one pool connection", pool.totalCount === 1);
    const owner = await prisma.user.create({ data: { name: tag, role: "OWNER", status: "ACTIVE", mustChangePassword: false } }); users.push(owner.id);
    const memberUser = await prisma.user.create({ data: { name: tag, role: "MEMBER", status: "ACTIVE" } }); users.push(memberUser.id);
    const member = await prisma.gymMember.create({ data: { fullName: tag, memberId: tag, phone: "03000000000", userId: memberUser.id } }); memberId = member.id;
    const session = await prisma.session.create({ data: { userId: owner.id, token: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""), expiresAt: new Date(Date.now() + 120000) } });
    const current = await validateSession(session.token);
    check("session is read through adapter with current owner permissions", current?.user.id === owner.id);
    await prisma.user.update({ where: { id: owner.id }, data: { status: "SUSPENDED" } });
    check("suspending account invalidates existing session immediately", await validateSession(session.token) === null);
    await prisma.user.update({ where: { id: owner.id }, data: { status: "ACTIVE" } });
    const membership = await prisma.membership.create({ data: { gymMemberId: member.id, planName: tag, status: "ACTIVE", startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 30 * 86400000) } });
    const request = await prisma.membershipFreezeRequest.create({ data: { gymMemberId: member.id, membershipId: membership.id, requestedDays: 1, reason: tag } });
    const review = (id: string, body: object) => sessionContext.run({ current }, () => PATCH(new NextRequest("http://localhost/api/v1/membership/freeze-requests/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) }));
    const first = await review(request.id, { action: "APPROVE" });
    check("freeze approval transaction succeeds using pg adapter", first.status === 200 && (await first.json()).success === true);
    const frozen = await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } });
    check("approval freezes membership and sets resume date", frozen.status === "FROZEN" && frozen.freezeResumeDate && frozen.frozenAt);
    const repeat = await review(request.id, { action: "APPROVE" });
    const repeated = await repeat.json();
    check("repeated approval acknowledges already-saved decision", repeat.status === 200 && repeated.data?.alreadyReviewed === true);
    check("approval retry does not duplicate audit or notification", await prisma.auditLog.count({ where: { entityId: member.id, action: "MEMBERSHIP_FREEZE_APPROVED" } }) === 1 && await prisma.notificationEvent.count({ where: { dedupKey: "freeze-reviewed:" + request.id } }) === 1);
    const opposite = await review(request.id, { action: "REJECT", reviewNotes: "Verification only" });
    check("opposite decision remains a genuine 409 conflict", opposite.status === 409 && (await opposite.json()).error.includes("already been reviewed"));
    const expired = await prisma.membership.create({ data: { gymMemberId: member.id, planName: tag, status: "EXPIRED", startDate: new Date(Date.now() - 10 * 86400000), endDate: new Date(Date.now() - 86400000) } });
    const expiredRequest = await prisma.membershipFreezeRequest.create({ data: { gymMemberId: member.id, membershipId: expired.id, requestedDays: 1, reason: tag } });
    const rejected = await review(expiredRequest.id, { action: "APPROVE" });
    check("expired membership returns a clear business conflict", rejected.status === 409 && (await rejected.json()).error.includes("expired"));
    const databaseFailure = withReadCache(async () => { throw Object.assign(new Error("remaining connection slots are reserved"), { code: "53300" }); });
    const unavailable = await databaseFailure(new Request("http://localhost/api/v1/test", { method: "PATCH" }));
    check("pool exhaustion returns retryable 503 without leaking database internals", unavailable.status === 503 && unavailable.headers.get("retry-after") === "10" && !(await unavailable.json()).error.includes("reserved"));
    await prisma.session.delete({ where: { id: session.id } });
    check("revoked session fails immediately", await validateSession(session.token) === null);
    await new Promise(resolve => setTimeout(resolve, 5500));
    check("idle pg connection is actually removed from the pool", pool.totalCount === 0);
    await prisma.$queryRaw`SELECT 1`;
    check("pool reconnects after idle cleanup", pool.totalCount === 1);
    console.log(JSON.stringify({ check: "deployment-errors", passed, failed: 0, externalMessagesSent: 0 }));
  } finally {
    if (memberId) {
      await prisma.auditLog.deleteMany({ where: { entityId: memberId } });
      await prisma.gymMember.delete({ where: { id: memberId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
    console.log("Deployment-error verification fixtures cleaned up");
  }
}
main().catch(error => { console.error("FAIL " + (error instanceof Error ? error.message : "verification failed")); process.exitCode = 1; });
