import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

async function postHandler(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
  if (!hasUserPermission(current.user, "PAYMENT_RECORD_VERIFY")) return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const openingCash = Number(body?.openingCash);
  if (!body || !Number.isFinite(openingCash) || openingCash < 0) return NextResponse.json({ success: false, error: "Valid opening cash amount is required." }, { status: 400 });
  const session = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${current.user.id} FOR UPDATE`;
    const existing = await tx.cashSession.findFirst({ where: { staffId: current.user.id, status: "OPEN" } });
    if (existing) return existing;
    const opened = await tx.cashSession.create({ data: { staffId: current.user.id, sessionNumber: `CS-${randomUUID()}`, openingCash, expectedCash: openingCash } });
    await tx.auditLog.create({ data: { actorId: current.user.id, actorName: current.user.name, actorRole: current.user.role, action: "CASH_SESSION_OPENED", entityType: "CASH_SESSION", entityId: opened.id, details: JSON.stringify({ openingCash }) } });
    return opened;
  });
  return NextResponse.json({ success: true, session });
}

export const POST = withReadCache(postHandler);
