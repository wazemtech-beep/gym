import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function getMemberApiContext() {
  const current = await getCurrentSession();
  if (!current) return { response: NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 }) };
  if (current.user.role !== "MEMBER" || current.user.mustChangePassword) return { response: NextResponse.json({ success: false, error: "Active member login required." }, { status: 403 }) };
  const member = await prisma.gymMember.findUnique({ where: { userId: current.user.id }, select: { id: true } });
  if (!member) return { response: NextResponse.json({ success: false, error: "Member profile missing." }, { status: 404 }) };
  return { current, member };
}
