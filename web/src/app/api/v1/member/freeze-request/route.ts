import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getMemberApiContext } from "@/lib/memberApi";
import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";
import { enqueueNotification } from "@/lib/notifications";

async function getHandler() {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const data = await prisma.membershipFreezeRequest.findMany({ where: { gymMemberId: context.member.id }, include: { membership: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
async function postHandler(req: NextRequest) {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  const days = Number(body.requestedDays);
  if (!Number.isInteger(days) || days < 1 || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 2000) return NextResponse.json({ success: false, error: "Enter freeze days and a reason." }, { status: 400 });
  try {
    const data = await prisma.$transaction(async tx => {
      await lockMember(tx, context.member.id);
      const now = new Date();
      const membership = await tx.membership.findFirst({ where: { gymMemberId: context.member.id, status: "ACTIVE", frozenAt: null, startDate: { lte: now }, endDate: { gte: now } }, orderBy: { startDate: "desc" } });
      if (!membership) throw new Error("No active membership is available to freeze.");
      const maximum = (await tx.gymSettings.findFirst())?.maxFreezeDays ?? 30;
      if (days > maximum) throw new Error(`Maximum freeze duration is ${maximum} days.`);
      if (await tx.membershipFreezeRequest.findFirst({ where: { membershipId: membership.id, status: "PENDING" } })) throw new Error("A freeze request is already awaiting review.");
      const request = await tx.membershipFreezeRequest.create({ data: { gymMemberId: context.member.id, membershipId: membership.id, requestedDays: days, reason: body.reason.trim(), status: "PENDING" } });
      await tx.auditLog.create({ data: { actorId: context.current.user.id, actorRole: "MEMBER", action: "MEMBERSHIP_FREEZE_REQUESTED", entityType: "GYM_MEMBER", entityId: context.member.id, details: JSON.stringify({ requestId: request.id }) } });
      const owners = await tx.user.findMany({ where: { role: "OWNER", status: "ACTIVE" }, select: { id: true } });
      for (const owner of owners) await enqueueNotification(tx, { recipientUserId: owner.id, eventType: "MEMBERSHIP_FREEZE_REQUESTED", title: "Freeze requested", message: `${context.current.user.name} requested ${days} freeze days.`, category: "MEMBERSHIP", actionUrl: "/admin/dashboard", dedupKey: `freeze-request:${request.id}:${owner.id}` });
      return request;
    });
    return NextResponse.json({ success: true, message: "Freeze request saved for owner approval.", data });
  } catch(cause) { return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : "Could not submit request." }, { status: 409 }); }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
