import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";

export async function applyMembershipLifecycle(memberId?: string) {
  const now = new Date();
  const due = await prisma.membership.findMany({ where: { ...(memberId ? { gymMemberId: memberId } : {}), OR: [{ status: "ACTIVE", frozenAt: { lte: now } }, { status: "FROZEN", freezeResumeDate: { lte: now } }] }, select: { id: true, gymMemberId: true } });
  for (const candidate of due) await prisma.$transaction(async tx => {
    await lockMember(tx, candidate.gymMemberId);
    const membership = await tx.membership.findUniqueOrThrow({ where: { id: candidate.id } });
    if (membership.status !== "ACTIVE" && membership.status !== "FROZEN") return;
    if (!membership.frozenAt || membership.frozenAt > now) return;
    if (membership.freezeResumeDate && membership.freezeResumeDate <= now) {
      const frozenDays = Math.max(0, Math.ceil((membership.freezeResumeDate.getTime() - membership.frozenAt.getTime()) / 86400000));
      const future = await tx.membership.findMany({ where: { gymMemberId: membership.gymMemberId, status: "UPCOMING", startDate: { gt: membership.endDate } } });
      for (const renewal of future) await tx.membership.update({ where: { id: renewal.id }, data: { startDate: new Date(renewal.startDate.getTime() + frozenDays * 86400000), endDate: new Date(renewal.endDate.getTime() + frozenDays * 86400000) } });
      await tx.membership.update({ where: { id: membership.id }, data: { status: "ACTIVE", frozenAt: null, freezeResumeDate: null, endDate: new Date(membership.endDate.getTime() + frozenDays * 86400000) } });
      await tx.auditLog.create({ data: { action: "MEMBERSHIP_AUTO_RESUMED", entityType: "MEMBERSHIP", entityId: membership.id, details: JSON.stringify({ frozenDays, renewalsAdjusted: future.length }) } });
    } else if (membership.status === "ACTIVE") {
      await tx.membership.update({ where: { id: membership.id }, data: { status: "FROZEN" } });
      await tx.auditLog.create({ data: { action: "SCHEDULED_FREEZE_STARTED", entityType: "MEMBERSHIP", entityId: membership.id } });
    }
  });
  await prisma.membership.updateMany({ where: { ...(memberId ? { gymMemberId: memberId } : {}), status: "UPCOMING", startDate: { lte: now }, endDate: { gte: now } }, data: { status: "ACTIVE" } });
  await prisma.membership.updateMany({ where: { ...(memberId ? { gymMemberId: memberId } : {}), status: "ACTIVE", endDate: { lt: now }, frozenAt: null }, data: { status: "EXPIRED" } });
  const members = await prisma.gymMember.findMany({ where: memberId ? { id: memberId } : { status: "CURRENT" }, select: { id: true } });
  for (const member of members) await prisma.$transaction(async tx => {
    await lockMember(tx, member.id);
    const current = await tx.gymMember.findUniqueOrThrow({ where: { id: member.id }, select: { trainerId: true } });
    const assignment = await tx.trainerAssignment.findFirst({ where: { gymMemberId: member.id, ...effectiveTrainerAssignment(now) }, orderBy: { startDate: "desc" } });
    const trainerId = assignment?.trainerId || null;
    if (current.trainerId === trainerId) return;
    await tx.gymMember.update({ where: { id: member.id }, data: { trainerId } });
    await tx.fitnessConnection.updateMany({ where: { gymMemberId: member.id }, data: { trainerSharingEnabled: false, trainerConfirmedCoachId: null, trainerSharingCategories: [] } });
    await tx.auditLog.create({ data: { action: "TRAINER_ASSIGNMENT_BECAME_EFFECTIVE", entityType: "GYM_MEMBER", entityId: member.id, details: JSON.stringify({ previousTrainerId: current.trainerId, trainerId, sharingRequiresConfirmation: true }) } });
  });
}
