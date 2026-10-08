import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getMemberApiContext } from "@/lib/memberApi";
import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";
import { enqueueNotification } from "@/lib/notifications";
import { getDateRangeForPeriod } from "@/lib/businessDates";

async function getHandler() {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const data = await prisma.renewalRequest.findMany({ where: { gymMemberId: context.member.id }, include: { feePlan: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
async function postHandler(req: NextRequest) {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  const { feePlanId, preferredStartDate, notes } = body;
  if (typeof feePlanId !== "string" || typeof preferredStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(preferredStartDate) || (notes !== undefined && (typeof notes !== "string" || notes.length > 2000))) return NextResponse.json({ success: false, error: "Choose a plan and valid start date." }, { status: 400 });
  const start = new Date(preferredStartDate + "T00:00:00+05:00");
  if (!Number.isFinite(start.getTime()) || new Date(start.getTime() + 18000000).toISOString().slice(0, 10) !== preferredStartDate || start < getDateRangeForPeriod("today").start) return NextResponse.json({ success: false, error: "Start date must be today or a future date." }, { status: 400 });
  try {
    const data = await prisma.$transaction(async tx => {
      await lockMember(tx, context.member.id);
      const plan = await tx.feePlan.findFirst({ where: { id: feePlanId, isActive: true } });
      if (!plan) throw new Error("This plan is no longer available.");
      if (await tx.renewalRequest.findFirst({ where: { gymMemberId: context.member.id, status: "PENDING" } })) throw new Error("A renewal request is already awaiting review.");
      const request = await tx.renewalRequest.create({ data: { gymMemberId: context.member.id, feePlanId, preferredStartDate: start, notes: notes?.trim() || null, status: "PENDING" }, include: { feePlan: true } });
      await tx.auditLog.create({ data: { actorId: context.current.user.id, actorRole: "MEMBER", action: "RENEWAL_REQUEST_CREATED", entityType: "RENEWAL_REQUEST", entityId: request.id } });
      const staff = await tx.user.findMany({ where: { role: { in: ["OWNER", "RECEPTIONIST"] }, status: "ACTIVE" }, select: { id: true } });
      for (const user of staff) await enqueueNotification(tx, { recipientUserId: user.id, eventType: "RENEWAL_REQUEST_CREATED", title: "Renewal requested", message: `${context.current.user.name} requested a membership renewal.`, category: "MEMBERSHIP", actionUrl: "/admin/members", dedupKey: `renewal-request:${request.id}:${user.id}` });
      return request;
    });
    return NextResponse.json({ success: true, message: "Renewal request saved for staff review.", data });
  } catch (cause) { return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : "Could not submit request." }, { status: 409 }); }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
