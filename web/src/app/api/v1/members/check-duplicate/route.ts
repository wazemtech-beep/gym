import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/members";
import { hasUserPermission } from "@/lib/permissions";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const body = await req.json();
    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    const { phone, email, fullName } = body;
    const sameNameMembers = fullName?.trim() ? await prisma.gymMember.findMany({ where: { fullName: { equals: fullName.trim(), mode: "insensitive" } }, select: { id: true, memberId: true, fullName: true }, take: 5 }) : [];

    const normalizedPhone = normalizePhoneNumber(phone || "");
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    if (!normalizedPhone && !cleanEmail) {
      return NextResponse.json({ exists: false, sameNameMembers });
    }

    const conditions: any[] = [];
    if (normalizedPhone) {
      conditions.push({ phone: normalizedPhone });
    }
    if (cleanEmail) {
      conditions.push({ email: cleanEmail });
    }

    const existing = await prisma.gymMember.findFirst({
      where: {
        OR: conditions,
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
      },
    });

    if (existing) {
      return NextResponse.json({
        exists: true,
        sameNameMembers,
        member: existing,
        message: `Same contact par member pehle se exist karta hai: ${existing.fullName} (${existing.memberId}).`,
      });
    }

    return NextResponse.json({ exists: false, sameNameMembers });
  } catch (error) {
    console.error("Duplicate check error:", error);
    return NextResponse.json({ exists: false });
  }
}

export const POST = withReadCache(postHandler);
