import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";
import { enqueueNotification } from "@/lib/notifications";
import { getDateRangeForPeriod } from "@/lib/businessDates";

class FreezeReviewConflict extends Error {}

async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });
  if (current.user.role !== "OWNER") return NextResponse.json({ success: false, error: "Only the owner can approve or reject a membership freeze." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!["APPROVE", "REJECT"].includes(body.action)) return NextResponse.json({ success: false, error: "Choose approve or reject." }, { status: 400 });
  if (body.action === "REJECT" && !String(body.reviewNotes || "").trim()) return NextResponse.json({ success: false, error: "Enter a reason for declining this request." }, { status: 400 });
  if (body.freezeStartDate && (typeof body.freezeStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.freezeStartDate))) return NextResponse.json({ success: false, error: "Choose a valid freeze start date." }, { status: 400 });
  const source = await prisma.membershipFreezeRequest.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ success: false, error: "Freeze request not found." }, { status: 404 });
  try {
    const data = await prisma.$transaction(async tx => {
      await lockMember(tx, source.gymMemberId);
      const request = await tx.membershipFreezeRequest.findUniqueOrThrow({ where: { id }, include: { gymMember: { select: { userId: true } }, membership: true } });
      const expectedStatus = body.action === "APPROVE" ? "APPROVED" : "REJECTED";
      if (request.status === expectedStatus) return { request, membership: request.membership, alreadyReviewed: true };
      if (request.status !== "PENDING") throw new FreezeReviewConflict("This request has already been reviewed. Refresh the list.");
      let membership = request.membership;
      if (body.action === "APPROVE") {
        const maxDays = (await tx.gymSettings.findFirst())?.maxFreezeDays ?? 30;
        const start = body.freezeStartDate ? new Date(String(body.freezeStartDate).slice(0, 10) + "T00:00:00+05:00") : new Date();
        if (body.freezeStartDate && (!Number.isFinite(start.getTime()) || new Date(start.getTime() + 5 * 3600000).toISOString().slice(0, 10) !== body.freezeStartDate || start < getDateRangeForPeriod("today").start)) throw new FreezeReviewConflict("Freeze start must be today or a future date.");
        if (membership.status !== "ACTIVE") throw new FreezeReviewConflict(`Membership is ${membership.status.toLowerCase()}. Only an active membership can be frozen.`);
        if (membership.frozenAt) throw new FreezeReviewConflict("A freeze is already scheduled for this membership.");
        if (request.requestedDays <= 0 || request.requestedDays > maxDays) throw new FreezeReviewConflict(`Requested freeze exceeds the current policy of ${maxDays} days. Decline this request and ask for a new one.`);
        if (!Number.isFinite(start.getTime()) || start < membership.startDate || start > membership.endDate) throw new FreezeReviewConflict("Freeze start must be within this membership's validity dates.");
        const resume = new Date(start.getTime() + request.requestedDays * 86400000);
        membership = await tx.membership.update({ where: { id: membership.id, status: "ACTIVE", frozenAt: null }, data: { status: start > new Date() ? "ACTIVE" : "FROZEN", frozenAt: start, freezeResumeDate: resume, freezeReason: request.reason } });
      }
      const updated = await tx.membershipFreezeRequest.update({ where: { id, status: "PENDING" }, data: { status: body.action === "APPROVE" ? "APPROVED" : "REJECTED", reviewNotes: String(body.reviewNotes || "").trim() || null, reviewedById: current.user.id, reviewedAt: new Date(), ...(body.action === "APPROVE" ? { plannedResumeDate: membership.freezeResumeDate } : {}) } });
      await tx.auditLog.create({ data: { actorId: current.user.id, actorName: current.user.name, actorRole: current.user.role, action: body.action === "APPROVE" ? "MEMBERSHIP_FREEZE_APPROVED" : "MEMBERSHIP_FREEZE_REJECTED", entityType: "GYM_MEMBER", entityId: source.gymMemberId, details: JSON.stringify({ requestId: id, reviewNotes: body.reviewNotes || null, freezeStart: membership.frozenAt, resume: membership.freezeResumeDate }) } });
      if (request.gymMember.userId) await enqueueNotification(tx, { recipientUserId: request.gymMember.userId, eventType: "MEMBERSHIP_FREEZE_REVIEWED", title: body.action === "APPROVE" ? "Freeze approved" : "Freeze request declined", message: body.action === "APPROVE" ? "Your membership freeze has been approved." : String(body.reviewNotes || "Contact reception for details."), category: "MEMBERSHIP", actionUrl: "/dashboard", dedupKey: "freeze-reviewed:" + id });
      return { request: updated, membership };
    }, { maxWait: 10000, timeout: 20000 });
    return NextResponse.json({ success: true, message: "alreadyReviewed" in data ? "This decision was already saved." : "Freeze request reviewed.", data });
  } catch (error) {
    if (error instanceof FreezeReviewConflict) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    // Infrastructure/transaction failures belong to the API error handler;
    // they must not masquerade as membership conflicts or expose Prisma internals.
    throw error;
  }
}

export const PATCH = withReadCache(patchHandler);
