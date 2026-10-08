import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateReportPdf } from "@/lib/reportPdf";
import { formatDateTime } from "@/lib/formatters";

async function getHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentSession();
  if (!current) return new NextResponse(null, { status: 401 });
  if (current.user.role === "TRAINER") return new NextResponse(null, { status: 403 });
  const { id } = await params;
  const refund = await prisma.refund.findUnique({ where: { id }, include: { payment: { include: { gymMember: true } }, recordedBy: true } });
  if (!refund) return new NextResponse(null, { status: 404 });
  if (current.user.role === "MEMBER" && refund.payment.gymMember.userId !== current.user.id) return new NextResponse(null, { status: 403 });
  if (current.user.role === "RECEPTIONIST" && refund.recordedById !== current.user.id) return new NextResponse(null, { status: 403 });
  const snapshot = refund.payment.brandingSnapshot as any;
  const number = refund.refundVoucherNumber || refund.id;
  const pdf = generateReportPdf("Refund acknowledgement", ["Voucher", "Original receipt", "Member", "Refunded (PKR)", "Method", "Date (Karachi)", "Reason", "Recorded by"], [[number, refund.payment.receiptNumber, snapshot?.memberName || refund.payment.gymMember.fullName, refund.amount, refund.refundMethod, formatDateTime(refund.refundDate), refund.reason, refund.recordedBy.name]]);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="refund-${number}.pdf"`, "Cache-Control": "private, no-store" } });
}

export const GET = withReadCache(getHandler);
