import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getMemberApiContext } from "@/lib/memberApi";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/members";

const fields = { fullName: true, memberId: true, phone: true, email: true, address: true, emergencyContactName: true, emergencyContactPhone: true, fitnessGoal: true } as const;
async function getHandler() {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const data = await prisma.gymMember.findUnique({ where: { id: context.member.id }, select: fields });
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
async function patchHandler(req: NextRequest) {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["address", "emergencyContactName", "emergencyContactPhone"].includes(key))) return NextResponse.json({ success: false, error: "Only address and emergency contacts can be updated here." }, { status: 400 });
  for (const key of ["address", "emergencyContactName", "emergencyContactPhone"]) if (typeof body[key] !== "string" || body[key].length > (key === "address" ? 500 : 120)) return NextResponse.json({ success: false, error: "Enter valid contact details." }, { status: 400 });
  const phone = body.emergencyContactPhone.trim() ? normalizePhoneNumber(body.emergencyContactPhone) : "";
  if ((phone && !/^03\d{9}$/.test(phone)) || Boolean(phone) !== Boolean(body.emergencyContactName.trim())) return NextResponse.json({ success: false, error: "Emergency contact ka naam aur valid Pakistani mobile number dono enter karein." }, { status: 400 });
  try {
    const data = await prisma.$transaction(async tx => {
      const updated = await tx.gymMember.update({ where: { id: context.member.id, userId: context.current.user.id }, data: { address: body.address.trim() || null, emergencyContactName: body.emergencyContactName.trim() || null, emergencyContactPhone: phone || null }, select: fields });
      await tx.auditLog.create({ data: { actorId: context.current.user.id, actorRole: "MEMBER", action: "MEMBER_PROFILE_UPDATED", entityType: "GYM_MEMBER", entityId: context.member.id, details: JSON.stringify({ fields: ["address", "emergencyContactName", "emergencyContactPhone"] }) } });
      return updated;
    });
    return NextResponse.json({ success: true, data });
  } catch { return NextResponse.json({ success: false, error: "Profile save nahi ho saki." }, { status: 500 }); }
}

export const GET = withReadCache(getHandler);
export const PATCH = withReadCache(patchHandler);
