require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const url = new URL(process.env.DATABASE_URL); url.searchParams.set("connection_limit", "1");
const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] });
const base = process.env.GYM_VERIFY_URL || "http://localhost:3001";
const tag = "verify-" + crypto.randomBytes(6).toString("hex");
const password = "Verify-" + crypto.randomBytes(16).toString("hex");
const users = [], members = [], requests = [];
let plan, passed = 0, failed = 0;
function check(label, valid) { if (valid) { passed++; console.log("PASS " + label); } else { failed++; console.log("FAIL " + label); } }
async function api(path, cookie, method = "GET", body) {
  const response = await fetch(base + path, { method, redirect: "manual", headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  let data; try { data = await response.json(); } catch { data = null; }
  return { response, data };
}
async function login(user, nextPassword = password, portal = user.role === "MEMBER" ? "member" : "admin") {
  const result = await api("/api/auth/login", null, "POST", { identifier: user.email, password: nextPassword, portal });
  check("login " + user.role, result.response.ok && result.data?.success);
  const cookie = result.response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Login fixture failed");
  return cookie;
}
async function cleanup() {
  for (const requestId of requests) {
    const request = await db.memberRegistrationRequest.findUnique({ where: { id: requestId } });
    if (request?.memberRecordId) { const member = await db.gymMember.findUnique({ where: { id: request.memberRecordId } }); if (member) { if (member.userId && !users.includes(member.userId)) users.push(member.userId); if (!members.includes(member.id)) members.push(member.id); } }
  }
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityId: { in: [...users, ...members, ...requests] } }] } });
  await db.invitation.deleteMany({ where: { createdById: { in: users } } });
  await db.memberRegistrationRequest.deleteMany({ where: { id: { in: requests } } });
  await db.gymMember.deleteMany({ where: { id: { in: members } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  if (plan) await db.feePlan.delete({ where: { id: plan.id } });
  console.log("Fixture cleanup completed");
}
async function run() {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const owner = await db.user.create({ data: { name: tag + " Owner", email: tag + "-owner@example.invalid", role: "OWNER", status: "ACTIVE", mustChangePassword: false, passwordHash } }); users.push(owner.id);
    const memberUser = await db.user.create({ data: { name: tag + " Member", email: tag + "-member@example.invalid", role: "MEMBER", status: "ACTIVE", mustChangePassword: false, passwordHash } }); users.push(memberUser.id);
    const member = await db.gymMember.create({ data: { memberId: "OXG-9" + Date.now(), fullName: tag, phone: "030" + crypto.randomInt(10000000, 99999999), userId: memberUser.id, email: memberUser.email } }); members.push(member.id);
    const other = await db.gymMember.create({ data: { memberId: "OXG-8" + Date.now(), fullName: tag + " Invoice fixture", phone: "031" + crypto.randomInt(10000000, 99999999) } }); members.push(other.id);
    plan = await db.feePlan.create({ data: { name: tag, durationValue: 30, durationUnit: "DAYS", membershipFee: 100, admissionFee: 0 } });
    const ownerCookie = await login(owner), memberCookie = await login(memberUser);
    check("anonymous API denied", (await api("/api/v1/members")).response.status === 401);
    check("member admin API denied", (await api("/api/v1/members", memberCookie)).response.status === 403);
    const wrongPortal = await api("/api/auth/login", null, "POST", { identifier: memberUser.email, password, portal: "admin" }); check("wrong portal denied", wrongPortal.response.status === 403);
    for (const path of ["/api/v1/member-registrations?status=PENDING&page=1", "/api/v1/members/renewals?status=PENDING", "/api/v1/settings", "/api/v1/members?status=CURRENT&page=1&limit=15", "/api/v1/dashboard/collection?period=today"]) { const result = await api(path, ownerCookie); check("admin read " + path, result.response.ok && result.data?.success); }
    for (const path of ["dashboard", "profile", "diet/today", "progress/measurements", "notifications", "fitness/privacy", "fitness/activity?range=week", "history?section=workout"]) { const result = await api("/api/v1/member/" + path, memberCookie); check("member read " + path, result.response.ok && result.data?.success); }
    for (const path of ["/dashboard", "/membership", "/payments", "/workout", "/diet", "/progress", "/profile", "/settings", "/notifications", "/admin/dashboard"]) {
      const response = await fetch(base + path, { headers: { Cookie: path.startsWith("/admin") ? ownerCookie : memberCookie }, redirect: "manual", signal: AbortSignal.timeout(30000) });
      check("page " + path, response.status === 200); await response.arrayBuffer();
    }
    const assigned = await api(`/api/v1/members/${other.id}/membership`, ownerCookie, "POST", { actionType: "ASSIGN", feePlanId: plan.id, startDate: "2030-01-01", createInvoice: true });
    check("membership + invoice atomic save", assigned.response.ok && assigned.data?.membership?.id && assigned.data?.invoice?.totalAmount === 100);
    const overlap = await api(`/api/v1/members/${other.id}/membership`, ownerCookie, "POST", { feePlanId: plan.id, startDate: "2030-01-01" }); check("membership overlap rejected", overlap.response.status === 400);
    const privateHistory = await api(`/api/v1/member/history?section=payments&memberId=${other.id}`, memberCookie); check("member cannot read another invoice", privateHistory.response.ok && !JSON.stringify(privateHistory.data).includes(assigned.data?.invoice?.id || "missing"));
    const emailDenied = await api("/api/auth/change-email", memberCookie, "POST", { email: tag + "-new@example.invalid", password: "wrong-password" }); check("email change requires correct password", emailDenied.response.status === 403);
    const applicant = await db.memberRegistrationRequest.create({ data: { fullName: tag + " Applicant", email: tag + "-applicant@example.invalid", phone: "032" + crypto.randomInt(10000000, 99999999), passwordHash, ipHash: tag, photoUrl: null, joiningDate: new Date() } }); requests.push(applicant.id);
    const pendingLogin = await api("/api/auth/login", null, "POST", { identifier: applicant.email, password, portal: "member" }); check("pending applicant cannot login", pendingLogin.response.status === 401);
    const approval = await api(`/api/v1/member-registrations/${applicant.id}`, ownerCookie, "PATCH", { action: "APPROVE" }); check("registration approval", approval.response.ok && approval.data?.success);
    if (approval.data?.success) await login({ email: applicant.email, role: "MEMBER" });
    const secondCookie = await login(memberUser);
    const logoutOne = await api("/api/auth/logout", memberCookie, "POST", { allDevices: false }); check("logout current", logoutOne.data?.success && (await api("/api/auth/me", memberCookie)).response.status === 401 && (await api("/api/auth/me", secondCookie)).response.ok);
    const logoutAll = await api("/api/auth/logout", secondCookie, "POST", { allDevices: true }); check("logout all", logoutAll.data?.success && (await api("/api/auth/me", secondCookie)).response.status === 401);
    const passwordCookie = await login(memberUser); const nextPassword = password + "-new";
    const changed = await api("/api/auth/change-password", passwordCookie, "POST", { currentPassword: password, newPassword: nextPassword }); check("password change", changed.response.ok && changed.data?.success && (await api("/api/auth/me", passwordCookie)).response.status === 401);
    await login(memberUser, nextPassword);
    const sync = await fetch(base + "/api/v1/cache-sync", { headers: { Cookie: ownerCookie }, signal: AbortSignal.timeout(10000) }); check("cache sync stream", sync.status === 200 && sync.headers.get("content-type")?.includes("text/event-stream")); await sync.body?.cancel();
  } catch (error) { failed++; console.log("FAIL verification interrupted: " + (error.code || error.name)); }
  finally { try { await cleanup(); } catch (error) { failed++; console.log("FAIL fixture cleanup: " + (error.code || error.name)); } await db.$disconnect(); }
  console.log(JSON.stringify({ check: "API-integration", passed, failed, emailsSent: 0 })); process.exit(failed ? 1 : 0);
}
run();
