import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
async function getHandler(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current || current.user.role !== "OWNER" || current.user.mustChangePassword) return NextResponse.json({ success: false, error: "Owner access required." }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") || "PENDING";
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
  const rawPage = Number(req.nextUrl.searchParams.get("page") || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  try {
    const [count, requests] = await Promise.all([
      prisma.memberRegistrationRequest.count({ where: { status } }),
      prisma.memberRegistrationRequest.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 20, skip: (page - 1) * 20, select: { id: true, fullName: true, email: true, phone: true, dateOfBirth: true, address: true, emergencyContactName: true, emergencyContactPhone: true, fitnessGoal: true, limitations: true, status: true, rejectionReason: true, createdAt: true, reviewedAt: true, memberRecordId: true } }),
    ]);
    return NextResponse.json({ success: true, requests, page, totalPages: Math.ceil(count / 20), count }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("REGISTRATION_LIST_ERROR", cause instanceof Error ? cause.message : "Unknown error");
    const schemaMissing = cause && typeof cause === "object" && "code" in cause && ["P2021", "P2022"].includes(String(cause.code));
    return NextResponse.json({ success: false, error: schemaMissing ? "Registration database setup is pending. Apply the registration schema and restart the app." : "Could not load registration requests. Please refresh." }, { status: schemaMissing ? 503 : 500 });
  }
}

export const GET = withReadCache(getHandler);
