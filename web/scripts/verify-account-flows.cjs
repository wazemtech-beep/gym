require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = new PrismaClient();
const base = process.env.GYM_VERIFY_URL || "http://localhost:3001";
const tag = "verify-account-" + crypto.randomBytes(6).toString("hex");
const password = "Verify-" + crypto.randomBytes(16).toString("hex");
let fixture, emailFixture, passed = 0;
function check(name, good) { if (!good) throw new Error(name); passed++; console.log("PASS " + name); }
async function api(path, body, cookie) {
  const response = await fetch(base + path, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const data = await response.clone().json().catch(() => null);
  return { response, data };
}
async function main() {
  try {
    fixture = await db.user.create({ data: { name: tag, email: tag + "@example.invalid", passwordHash: await bcrypt.hash(password, 10), role: "MEMBER" } });
    const login = await api("/api/auth/login", { identifier: fixture.email, password, portal: "member" });
    check("fixture login", login.data?.success);
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
    const token = crypto.randomBytes(32).toString("hex");
    await db.passwordResetToken.create({ data: { userId: fixture.id, token: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
    const reset = await api("/api/auth/reset-password", { token, newPassword: password + "x" });
    check("hashed reset token accepted", reset.data?.success);
    check("reset revokes sessions", await db.session.count({ where: { userId: fixture.id } }) === 0);
    check("reset token single use", (await api("/api/auth/reset-password", { token, newPassword: password + "y" })).response.status === 400);
    const afterReset = await api("/api/auth/login", { identifier: fixture.email, password: password + "x", portal: "member" });
    check("reset password login", afterReset.data?.success);
    const emailToken = `EMAIL_CHANGE:${fixture.id}:${crypto.randomBytes(32).toString("hex")}`;
    const nextEmail = tag + "-new@example.invalid";
    await db.invitation.create({ data: { token: emailToken, email: nextEmail, role: "MEMBER", createdById: fixture.id, expiresAt: new Date(Date.now() + 3600000) } });
    const verified = await api("/api/auth/change-email/verify", { token: emailToken }, cookie);
    check("email verification redirect", verified.response.status === 303);
    const updated = await db.user.findUniqueOrThrow({ where: { id: fixture.id } });
    check("verified email saved", updated.email === nextEmail && updated.emailVerified);
    check("email verification revokes sessions", await db.session.count({ where: { userId: fixture.id } }) === 0);
    check("email verification single use", (await api("/api/auth/change-email/verify", { token: emailToken })).response.status === 409);
    const code = String(crypto.randomInt(100000, 999999));
    await db.passwordResetToken.create({ data: { userId: fixture.id, token: crypto.randomBytes(32).toString("hex"), resetCode: code, expiresAt: new Date(Date.now() + 900000) } });
    const codeReset = await api("/api/auth/reset-with-code", { identifier: nextEmail, resetCode: code, newPassword: password + "z" });
    check("reception reset code accepted", codeReset.data?.success);
    check("reception reset code single use", (await api("/api/auth/reset-with-code", { identifier: nextEmail, resetCode: code, newPassword: password + "z" })).response.status === 400);
    check("reception reset password login", (await api("/api/auth/login", { identifier: nextEmail, password: password + "z", portal: "member" })).data?.success);
    const activation = crypto.randomBytes(32).toString("hex");
    await db.invitation.create({ data: { token: activation, email: nextEmail, role: "MEMBER", createdById: fixture.id, expiresAt: new Date(Date.now() + 3600000) } });
    check("account activation accepted", (await api("/api/auth/activate", { token: activation, password: password + "a" })).data?.success);
    check("activation token single use", (await api("/api/auth/activate", { token: activation, password: password + "a" })).response.status === 400);
    const allowedEmail = process.env.GYM_VERIFY_EMAIL;
    if (allowedEmail) {
      let recipient = await db.user.findFirst({ where: { email: { equals: allowedEmail, mode: "insensitive" } } });
      if (!recipient) { emailFixture = await db.user.create({ data: { name: "OXGEN verification", email: allowedEmail, role: "MEMBER", status: "ACTIVE", passwordHash: await bcrypt.hash(password, 10) } }); recipient = emailFixture; }
      check("email recipient active", recipient.status === "ACTIVE");
      const started = new Date();
      const request = await api("/api/auth/forgot-password", { email: allowedEmail });
      check("forgot password endpoint accepted", request.data?.success);
      check("forgot password SMTP send completed", await db.auditLog.count({ where: { actorId: recipient.id, action: "PASSWORD_RESET_REQUESTED", createdAt: { gte: started } } }) > 0);
      check("reset token valid after send", await db.passwordResetToken.count({ where: { userId: recipient.id, createdAt: { gte: started }, expiresAt: { gt: new Date() } } }) > 0);
    }
    console.log(JSON.stringify({ check: "account-flows", passed, failed: 0, actualForgotPasswordEmailRequested: !!process.env.GYM_VERIFY_EMAIL }));
  } catch (error) { console.log("FAIL " + (error.code || error.message)); process.exitCode = 1; }
  finally {
    for (const user of [fixture, emailFixture].filter(Boolean)) {
      await db.auditLog.deleteMany({ where: { actorId: user.id } });
      await db.invitation.deleteMany({ where: { createdById: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
    await db.$disconnect();
  }
}
main();
