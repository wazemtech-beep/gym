import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Reset token aur naya password lazmi hain." },
        { status: 400 }
      );
    }

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || typeof newPassword !== "string" || newPassword.length < 8 || Buffer.byteLength(newPassword) > 72) {
      return NextResponse.json(
        { success: false, error: "Valid reset link aur kam az kam 8 characters ka password chahiye (maximum 72 bytes)." },
        { status: 400 }
      );
    }

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: { OR: [{ token: createHash("sha256").update(token).digest("hex") }, { token }] },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "Password reset link expire ho chuka hai ya pehle use ho chuka hai." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${resetRecord.userId} FOR UPDATE`;
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: resetRecord.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("RESET_LINK_USED");
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: hashedPassword,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });

      await tx.passwordResetToken.updateMany({ where: { userId: resetRecord.userId, usedAt: null }, data: { expiresAt: new Date(0) } });
      await tx.session.deleteMany({ where: { userId: resetRecord.userId } });
      await tx.auditLog.create({
        data: {
          actorId: resetRecord.userId,
          actorName: resetRecord.user.name,
          actorRole: resetRecord.user.role,
          action: "PASSWORD_RESET_COMPLETED",
          entityType: "USER",
          entityId: resetRecord.userId,
          details: JSON.stringify({ method: "EMAIL_TOKEN" }),
        },
      });
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({
      success: true,
      message: "Password kamyabi se tabdeel ho gaya hai! Ab aap naye password se login kar sakte hain.",
    });
  } catch (error: any) {
    console.error("RESET_PASSWORD_ERROR:", error);
    if (error instanceof Error && error.message === "RESET_LINK_USED") return NextResponse.json({ success: false, error: "Reset link expire ho chuka hai ya use ho gaya hai. Naya link request karein." }, { status: 400 });
    return NextResponse.json(
      { success: false, error: "Password reset karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
