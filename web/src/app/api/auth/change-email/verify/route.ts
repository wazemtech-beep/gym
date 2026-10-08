import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginForRole } from "@/lib/portalRoutes";

async function postHandler(req: NextRequest) {
  const body = req.headers.get("content-type")?.includes("application/json") ? await req.json() : Object.fromEntries(await req.formData());
  const token = String(body.token || "");
  if (!token.startsWith("EMAIL_CHANGE:")) return NextResponse.json({ success: false, error: "Invalid verification link." }, { status: 400 });
  const userId = token.split(":")[1];
  try {
    const verifiedUser = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const invitation = await tx.invitation.findUnique({ where: { token } });
      if (!invitation?.email || invitation.createdById !== userId || invitation.usedAt || invitation.expiresAt < new Date()) throw new Error("Verification link expired or already used.");
      await tx.invitation.update({ where: { id: invitation.id, usedAt: null }, data: { usedAt: new Date() } });
      const user = await tx.user.update({ where: { id: userId }, data: { email: invitation.email, emailVerified: true }, select: { role: true } });
      await tx.gymMember.updateMany({ where: { userId }, data: { email: invitation.email } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.auditLog.create({ data: { actorId: userId, action: "LOGIN_EMAIL_VERIFIED", entityType: "USER", entityId: userId } });
      return user;
    }, { maxWait: 10000, timeout: 30000 });
    return NextResponse.redirect(new URL(loginForRole(verifiedUser.role) + "?emailVerified=1", req.url), 303);
  } catch { return NextResponse.json({ success: false, error: "Verification link expired, already used, or email is no longer available." }, { status: 409 }); }
}

export const POST = withReadCache(postHandler);
