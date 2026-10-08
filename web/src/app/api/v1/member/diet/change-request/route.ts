import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { enqueueNotification } from "@/lib/notifications";

async function postHandler(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current || current.user.role !== "MEMBER") return NextResponse.json({ success: false, error: "Member login required." }, { status: 403 });
  const { reason } = await req.json().catch(() => ({}));
  if (typeof reason !== "string" || !reason.trim() || reason.length > 2000) return NextResponse.json({ success: false, error: "Describe the requested change (up to 2000 characters)." }, { status: 400 });
  const member = await prisma.gymMember.findUnique({ where: { userId: current.user.id } });
  if (!member) return NextResponse.json({ success: false, error: "Member profile missing." }, { status: 404 });
  const assignment = await prisma.trainerAssignment.findFirst({ where: { gymMemberId: member.id, ...effectiveTrainerAssignment() }, orderBy: { startDate: "desc" } });
  const recipient = assignment?.trainerId || (await prisma.user.findFirst({ where: { role: "OWNER", status: "ACTIVE" } }))?.id;
  await prisma.$transaction(async tx => {
    const request = await tx.auditLog.create({ data: { actorId: current.user.id, actorRole: "MEMBER", action: "DIET_CHANGE_REQUESTED", entityType: "GYM_MEMBER", entityId: member.id, reason: reason.trim(), details: JSON.stringify({ status: "PENDING", trainerId: assignment?.trainerId || null }) } });
    if (recipient) await enqueueNotification(tx, { recipientUserId: recipient, eventType: "DIET_CHANGE_REQUESTED", title: "Diet review requested", message: `${member.fullName}: ${reason.trim()}`, category: "TRAINING", entityType: "GYM_MEMBER", entityId: member.id, actionUrl: assignment ? "/admin/trainer/dashboard" : "/admin/dashboard", dedupKey: `diet-request:${request.id}` });
  });
  return NextResponse.json({ success: true, message: "Your change request has been saved for review." });
}

export const POST = withReadCache(postHandler);
