import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, resetCode, newPassword } = body;

    if (!identifier || !resetCode || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Member ID / Phone, 6-digit Reset Code aur Naya Password lazmi hain." },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8 || Buffer.byteLength(newPassword) > 72) {
      return NextResponse.json(
        { success: false, error: "Password kam az kam 8 characters ka hona chahiye (maximum 72 bytes)." },
        { status: 400 }
      );
    }

    const cleanIdentifier = String(identifier).trim();
    const cleanCode = String(resetCode).trim();

    // Find User by memberId, phone, or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { memberId: cleanIdentifier },
          { phone: cleanIdentifier },
          { email: cleanIdentifier.toLowerCase() },
          { memberProfile: { memberId: cleanIdentifier } },
          { memberProfile: { phone: cleanIdentifier } },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Diya gaya Member ID ya Phone number nahi mila." },
        { status: 404 }
      );
    }

    // Verify valid unexpired reset code
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        resetCode: cleanCode,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "Reset Code ghalat hai ya expire ho chuka hai (Code 15 minutes ke liye valid hota hai).",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: tokenRecord.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("RESET_CODE_USED");
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });

      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { expiresAt: new Date(0) } });
      await tx.session.deleteMany({ where: { userId: user.id } });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: "PASSWORD_RESET_COMPLETED",
          entityType: "USER",
          entityId: user.id,
          details: JSON.stringify({ method: "RECEPTION_RESET_CODE" }),
        },
      });
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({
      success: true,
      message: "Password kamyabi se tabdeel ho gaya hai! Ab aap naye password se login kar sakte hain.",
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === "RESET_CODE_USED") return NextResponse.json({ success: false, error: "Reset code expire ho chuka hai ya pehle use ho gaya hai." }, { status: 400 });
    console.error("RESET_WITH_CODE_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Password reset karne mein masla aya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
