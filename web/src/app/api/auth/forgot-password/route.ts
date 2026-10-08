import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { accountEmailConfigured, sendPasswordResetEmail } from "@/lib/accountEmail";

const safeReply = () => NextResponse.json({ success: true, message: "Agar is email ka active account hai, password reset instructions email par bhej di jayengi." });
async function postHandler(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, error: "Valid email address darj karein." }, { status: 400 });
    if (!accountEmailConfigured()) return NextResponse.json({ success: false, error: "Email delivery configured nahi hai. Reception se reset code lein." }, { status: 503 });
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, status: "ACTIVE" } });
    if (!user) return safeReply();
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const recent = await tx.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600000) } } });
      if (recent >= 5) return null;
      return tx.passwordResetToken.create({ data: { userId: user.id, token: tokenHash, expiresAt: new Date(Date.now() + 3600000) } });
    });
    if (!record) return safeReply();
    try {
      const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      const url = new URL("/reset-password", base); url.searchParams.set("token", token);
      await sendPasswordResetEmail(email, user.name, url.toString());
    } catch (cause) {
      await prisma.passwordResetToken.update({ where: { id: record.id }, data: { expiresAt: new Date(0) } });
      console.error("PASSWORD_RESET_EMAIL_FAILED", cause instanceof Error ? cause.name : "Unknown error");
      return safeReply();
    }
    await prisma.auditLog.create({ data: { actorId: user.id, actorName: user.name, actorRole: user.role, action: "PASSWORD_RESET_REQUESTED", entityType: "USER", entityId: user.id } });
    return safeReply();
  } catch (cause) {
    console.error("FORGOT_PASSWORD_ERROR", cause instanceof Error ? cause.name : "Unknown error");
    return NextResponse.json({ success: false, error: "Password reset request process nahi ho saki. Dobara try karein." }, { status: 500 });
  }
}
export const POST = withReadCache(postHandler);
