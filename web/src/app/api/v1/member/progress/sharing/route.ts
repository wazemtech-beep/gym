import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getMemberApiContext } from "@/lib/memberApi";
import { prisma } from "@/lib/db";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { lockMember } from "@/lib/recordLocks";

async function getHandler() {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const data = await prisma.trainerAssignment.findFirst({ where: { gymMemberId: context.member.id, ...effectiveTrainerAssignment() }, orderBy: { startDate: "desc" }, select: { id: true, consentMeasurements: true, trainer: { select: { name: true } } } });
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
async function patchHandler(req: NextRequest) {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean" || typeof body.assignmentId !== "string") return NextResponse.json({ success: false, error: "Choose a sharing setting." }, { status: 400 });
  try {
    const data = await prisma.$transaction(async tx => {
      await lockMember(tx, context.member.id);
      const assignment = await tx.trainerAssignment.findFirst({ where: { gymMemberId: context.member.id, ...effectiveTrainerAssignment() }, orderBy: { startDate: "desc" } });
      if (!assignment || assignment.id !== body.assignmentId) throw new Error("Trainer assignment changed. Refresh before confirming sharing.");
      const updated = await tx.trainerAssignment.update({ where: { id: assignment.id }, data: { consentMeasurements: body.enabled }, select: { id: true, consentMeasurements: true, trainer: { select: { name: true } } } });
      await tx.auditLog.create({ data: { actorId: context.current.user.id, actorRole: "MEMBER", action: "PROGRESS_SHARING_CHANGED", entityType: "GYM_MEMBER", entityId: context.member.id, details: JSON.stringify({ assignmentId: assignment.id, enabled: body.enabled }) } });
      return updated;
    });
    return NextResponse.json({ success: true, data });
  } catch(cause) { return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : "Sharing update failed." }, { status: 409 }); }
}

export const GET = withReadCache(getHandler);
export const PATCH = withReadCache(patchHandler);
