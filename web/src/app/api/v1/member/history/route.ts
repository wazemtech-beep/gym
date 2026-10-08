import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getMemberApiContext } from "@/lib/memberApi";
import { prisma } from "@/lib/db";

async function getHandler(req: NextRequest) {
  const context = await getMemberApiContext();
  if (context.response) return context.response;
  const section = req.nextUrl.searchParams.get("section");
  if (!["membership", "payments", "workout", "attendance"].includes(section || "")) return NextResponse.json({ success: false, error: "Invalid history section." }, { status: 400 });
  const requestedPage = Number(req.nextUrl.searchParams.get("page") || 1);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) return NextResponse.json({ success: false, error: "Invalid page." }, { status: 400 });
  const skip = (requestedPage - 1) * 20;
  const where = { gymMemberId: context.member.id };
  try {
    let data: object;
    if (section === "membership") {
      const [rows, total, renewals, freezes] = await Promise.all([
        prisma.membership.findMany({ where, orderBy: { startDate: "desc" }, skip, take: 20, select: { id: true, planName: true, startDate: true, endDate: true, status: true, feeAmount: true, servicesSnapshot: true, admissionFeeCharged: true, discountApplied: true, frozenAt: true, freezeResumeDate: true } }),
        prisma.membership.count({ where }),
        prisma.renewalRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, createdAt: true, status: true, preferredStartDate: true, rejectionReason: true, reviewedAt: true, feePlan: { select: { name: true } } } }),
        prisma.membershipFreezeRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, createdAt: true, status: true, requestedDays: true, plannedResumeDate: true, reviewNotes: true, reviewedAt: true } }),
      ]);
      data = { rows, total, renewals, freezes };
    } else if (section === "payments") {
      const [rows, total, receipts, transfers] = await Promise.all([
        prisma.invoice.findMany({ where, orderBy: { issueDate: "desc" }, skip, take: 20, select: { id: true, invoiceNumber: true, title: true, status: true, issueDate: true, dueDate: true, totalAmount: true, paidAmount: true, balanceAmount: true, lineItems: { select: { id: true, description: true, amount: true } }, installments: { orderBy: { installmentNumber: "asc" }, select: { id: true, installmentNumber: true, dueDate: true, amount: true, paidAmount: true, status: true } } } }),
        prisma.invoice.count({ where }),
        prisma.payment.findMany({ where, orderBy: { paymentDate: "desc" }, skip, take: 20, select: { id: true, receiptNumber: true, paymentDate: true, amount: true, method: true, status: true } }),
        prisma.transferSubmission.findMany({ where, orderBy: { submittedAt: "desc" }, skip, take: 20, select: { id: true, amount: true, status: true, submittedAt: true, transactionReference: true, rejectionReason: true } }),
      ]);
      const [receiptTotal, transferTotal] = await Promise.all([prisma.payment.count({ where }), prisma.transferSubmission.count({ where })]);
      data = { rows, total: Math.max(total, receiptTotal, transferTotal), receipts, transfers };
    } else if (section === "workout") {
      const now = new Date();
      const [rows, total, plan] = await Promise.all([
        prisma.workoutSession.findMany({ where, orderBy: { sessionDate: "desc" }, skip, take: 20, select: { id: true, sessionDate: true, status: true, durationMinutes: true, trainerFeedback: true, plan: { select: { title: true } }, workoutDay: { select: { title: true } }, exerciseLogs: { select: { id: true, exerciseName: true, actualReps: true, actualWeight: true, actualDuration: true, isSkipped: true } } } }),
        prisma.workoutSession.count({ where }),
        prisma.workoutPlan.findFirst({ where: { ...where, status: "PUBLISHED", startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] }, orderBy: { startDate: "desc" }, select: { title: true, goal: true, weeklySchedule: true, workoutDays: { orderBy: { order: "asc" }, select: { id: true, title: true, dayOfWeek: true, exercises: { orderBy: { order: "asc" }, select: { id: true, name: true, type: true, sets: true, reps: true, targetLoad: true, durationMinutes: true, distanceMeters: true, restSeconds: true, instructions: true, alternativeExercise: true, demoVideoUrl: true } } } } } }),
      ]);
      data = { rows, total, plan };
    } else {
      const enabled = Boolean((await prisma.gymSettings.findFirst({ select: { attendanceEnabled: true } }))?.attendanceEnabled);
      if (!enabled) return NextResponse.json({ success: true, data: { enabled: false, rows: [], total: 0 } }, { headers: { "Cache-Control": "no-store" } });
      const attendanceWhere = { ...where, isVoid: false };
      const [rows, total] = await Promise.all([
        prisma.attendanceRecord.findMany({ where: attendanceWhere, orderBy: { checkIn: "desc" }, skip, take: 20, select: { id: true, checkIn: true, method: true, membership: { select: { planName: true } } } }),
        prisma.attendanceRecord.count({ where: attendanceWhere }),
      ]);
      data = { enabled, rows, total };
    }
    return NextResponse.json({ success: true, data, page: requestedPage }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ success: false, error: "History load nahi ho saki." }, { status: 500 }); }
}

export const GET = withReadCache(getHandler);
