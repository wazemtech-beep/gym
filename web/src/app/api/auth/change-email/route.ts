import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentSession } from "@/lib/session";
import { getGymAuth } from "@/lib/gymAuth";
import { prisma } from "@/lib/db";
import { enqueueNotification, dispatchNotification } from "@/lib/notifications";

async function postHandler(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return NextResponse.json({ success: false, error: "Email verification is unavailable until email delivery is configured." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, error: "Enter a valid email." }, { status: 400 });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: current.user.id } });
  const context = await getGymAuth().$context;
  if (!user.passwordHash || !await context.password.verify({ hash: user.passwordHash, password: String(body.password || "") })) return NextResponse.json({ success: false, error: "Current password is incorrect." }, { status: 403 });
  if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ success: false, error: "Email is already linked to an account." }, { status: 409 });
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || (process.env.NODE_ENV !== "production" ? req.nextUrl.origin : null);
  if (!baseUrl) return NextResponse.json({ success: false, error: "Application URL is not configured." }, { status: 503 });
  const token = `EMAIL_CHANGE:${user.id}:${randomBytes(32).toString("hex")}`;
  const actionUrl = `${baseUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  const event = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    await tx.invitation.updateMany({ where: { token: { startsWith: `EMAIL_CHANGE:${user.id}:` }, usedAt: null }, data: { usedAt: new Date() } });
    await tx.invitation.create({ data: { email, role: user.role, token, expiresAt: new Date(Date.now() + 3600000), createdById: user.id } });
    return enqueueNotification(tx, { recipientUserId: user.id, eventType: "EMAIL_CHANGE_VERIFICATION", title: "Verify your new login email", message: "Confirm your new email address. This link expires in one hour. Your login email will change after confirmation.", category: "OPERATIONAL", actionUrl, dedupKey: `email-change:${token.slice(-20)}`, channels: ["EMAIL"], metadata: { verificationEmail: email } });
  }, { maxWait: 10000, timeout: 30000 });
  const delivery = await dispatchNotification({ recipientUserId: user.id, eventType: event.eventType, title: event.title, message: event.message, category: event.category, actionUrl, existingEventId: event.id, channels: ["EMAIL"] });
  if (!delivery.success || !("emailStatus" in delivery) || delivery.emailStatus !== "ACCEPTED") return NextResponse.json({ success: false, error: "Verification email could not be delivered yet. Please try again later." }, { status: 503 });
  return NextResponse.json({ success: true, message: "Verification email queued. Your current login email remains active until you confirm." });
}

export const POST = withReadCache(postHandler);
