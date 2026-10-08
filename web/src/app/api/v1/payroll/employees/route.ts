import { withReadCache } from "@/lib/serverReadCache";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
async function getHandler() {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (current.user.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const employees = await prisma.user.findMany({ where: { role: { in: ["TRAINER", "RECEPTIONIST"] } }, select: { id: true, name: true, role: true, status: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ success: true, employees });
}

export const GET = withReadCache(getHandler);
