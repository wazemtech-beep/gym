import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";

async function postHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentSession();
  if (!current || current.user.role !== "OWNER") return NextResponse.json({ success: false, error: "Owner approval required." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  if (!reason || !["ADVANCE_CREDIT", "REFUND_REVIEW"].includes(body.treatment)) return NextResponse.json({ success: false, error: "Choose the treatment of paid amounts and record a reason." }, { status: 400 });
  const source = await prisma.invoice.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
  try {
    const result = await prisma.$transaction(async tx => {
      await lockMember(tx, source.gymMemberId);
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id } });
      if (invoice.status === "VOID") return { invoice, reviewRequired: false };
      if (invoice.paidAmount > 0 && body.treatment === "REFUND_REVIEW") {
        await tx.auditLog.create({ data: { actorId: current.user.id, actorName: current.user.name, actorRole: current.user.role, action: "PAID_INVOICE_VOID_REVIEW", entityType: "INVOICE", entityId: id, reason, details: JSON.stringify({ paidAmount: invoice.paidAmount, status: "PENDING_REFUND_REVIEW" }) } });
        return { invoice, reviewRequired: true };
      }
      if (invoice.paidAmount > 0) {
        if (await tx.paymentAllocation.count({ where: { invoiceId: id, payment: { refunds: { some: { feeObligationTreatment: "CANCEL_OBLIGATION" } } } } })) throw new Error("A linked refund cancelled part of the fee obligation. Reconcile that refund before moving paid funds to advance credit.");
        await tx.advanceCredit.create({ data: { gymMemberId: invoice.gymMemberId, amount: invoice.paidAmount, sourceType: "INVOICE_VOID_REALLOCATION", notes: `${invoice.invoiceNumber}: ${reason}` } });
        await tx.gymMember.update({ where: { id: invoice.gymMemberId }, data: { advanceBalance: { increment: invoice.paidAmount } } });
      }
      const updated = await tx.invoice.update({ where: { id }, data: { status: "VOID", balanceAmount: 0, notes: `${invoice.notes || ""}\nVOID: ${reason}`.trim() } });
      await tx.auditLog.create({ data: { actorId: current.user.id, actorName: current.user.name, actorRole: current.user.role, action: "INVOICE_VOIDED", entityType: "INVOICE", entityId: id, reason, details: JSON.stringify({ beforeStatus: invoice.status, paidAmount: invoice.paidAmount, amountMovedToAdvance: invoice.paidAmount, treatment: body.treatment }) } });
      return { invoice: updated, reviewRequired: false };
    });
    return NextResponse.json({ success: true, ...result, reviewUrl: `/admin/payments?memberId=${source.gymMemberId}`, message: result.reviewRequired ? "Refund review recorded. Invoice remains active until the paid amount is resolved." : "Invoice voided. Paid funds are available as advance credit for reallocation." });
  } catch(error: any) { return NextResponse.json({ success: false, error: error.message || "Could not void invoice." }, { status: 409 }); }
}

export const POST = withReadCache(postHandler);
