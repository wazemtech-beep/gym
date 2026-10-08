import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateNextMemberId } from "@/lib/members";
async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentSession();
  if (!current || current.user.role !== "OWNER" || current.user.mustChangePassword) return NextResponse.json({ success: false, error: "Owner access required." }, { status: 403 });
  const origin = req.headers.get("origin");
  const allowed = [req.nextUrl.origin, ...(process.env.APP_URL ? [new URL(process.env.APP_URL).origin] : [])];
  if (origin && !allowed.includes(origin)) return NextResponse.json({ success: false, error: "Request origin not allowed." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !["APPROVE", "REJECT"].includes(body.action) || (body.reason !== undefined && typeof body.reason !== "string")) return NextResponse.json({ success: false, error: "Invalid decision." }, { status: 400 });
  const reason = String(body.reason || "").trim();
  if (reason.length > 500 || (body.action === "REJECT" && !reason)) return NextResponse.json({ success: false, error: "Enter a decline reason (up to 500 characters)." }, { status: 400 });
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('member-register'))`;
      const request = await tx.memberRegistrationRequest.findUnique({ where: { id } });
      if (!request) return { error: "Request not found.", status: 404 };
      if (request.status !== "PENDING") return { error: "This request has already been reviewed.", status: 409 };
      let memberRecordId: string | null = null, memberId: string | null = null;
      if (body.action === "APPROVE") {
        if (!request.passwordHash) return { error: "The request has no password. Ask the applicant to resubmit.", status: 409 };
        const user = await tx.user.findFirst({ where: { OR: [{ email: { equals: request.email, mode: "insensitive" } }, { phone: request.phone }] }, select: { id: true } });
        const member = await tx.gymMember.findFirst({ where: { OR: [{ phone: request.phone }, { email: { equals: request.email, mode: "insensitive" } }] }, select: { id: true } });
        if (user || member) return { error: "These details now belong to an existing member/account. Review that record and use its activation flow; decline this duplicate request.", status: 409 };
        memberId = await generateNextMemberId(tx);
        const account = await tx.user.create({ data: { name: request.fullName, email: request.email, phone: request.phone, memberId, passwordHash: request.passwordHash, role: "MEMBER", status: "ACTIVE", mustChangePassword: false } });
        const created = await tx.gymMember.create({ data: { memberId, fullName: request.fullName, email: request.email, phone: request.phone, userId: account.id, photoUrl: request.photoUrl, joiningDate: request.joiningDate || new Date(), dateOfBirth: request.dateOfBirth, address: request.address, emergencyContactName: request.emergencyContactName, emergencyContactPhone: request.emergencyContactPhone, fitnessGoal: request.fitnessGoal, limitations: request.limitations } });
        memberRecordId = created.id;
        await tx.notification.create({ data: { userId: account.id, title: "Registration approved", message: "Your member account is ready. Contact reception to choose your membership package.", entityType: "MEMBER_REGISTRATION", entityId: id, actionUrl: "/membership" } });
      }
      const status = body.action === "APPROVE" ? "APPROVED" : "REJECTED";
      await tx.memberRegistrationRequest.update({ where: { id }, data: { status, reviewedById: current.user.id, reviewedAt: new Date(), rejectionReason: status === "REJECTED" ? reason : null, passwordHash: null, memberRecordId } });
      await tx.auditLog.create({ data: { actorId: current.user.id, actorName: current.user.name, actorRole: current.user.role, action: "MEMBER_REGISTRATION_" + status, entityType: "MEMBER_REGISTRATION", entityId: id, reason: reason || null, details: JSON.stringify({ status, memberRecordId, memberId }) } });
      return { memberId };
    }, { maxWait: 10000, timeout: 30000 });
    if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, memberId: result.memberId, message: body.action === "APPROVE" ? "Approved. The member can now sign in with their submitted email and password." : "Request declined." });
  } catch (cause) {
    console.error("REGISTRATION_REVIEW_ERROR", cause instanceof Error ? cause.name : "Unknown error");
    return NextResponse.json({ success: false, error: "Could not review this request. Refresh and try again." }, { status: 500 });
  }
}

export const PATCH = withReadCache(patchHandler);
