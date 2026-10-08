import { withReadCache } from "@/lib/serverReadCache";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
async function getHandler() {
  const current = await getCurrentSession();
  if (!current || current.user.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const now = new Date();
  const assignments = await prisma.trainerAssignment.findMany({ where: { isActive: true, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }], trainer: { status: "SUSPENDED" }, gymMember: { status: "CURRENT" } }, include: { trainer: { select: { name: true } }, gymMember: { select: { id: true, fullName: true, memberId: true, fitnessGoal: true, trainerId: true } } }, orderBy: { startDate: "asc" } });
  return NextResponse.json({ success: true, assignments });
}

export const GET = withReadCache(getHandler);
