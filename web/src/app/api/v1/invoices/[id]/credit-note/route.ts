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
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || !String(body.reason || "").trim() || typeof body.requestKey !== "string" || !body.requestKey) return NextResponse.json({ success: false, error: "Valid amount, reason and request key are required." }, { status: 400 });
  const source = await prisma.invoice.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
  try {
    const invoice = await prisma.$transaction(async tx => {
      await lockMember(tx, source.gymMemberId);
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id } });
      const existing = await tx.auditLog.findFirst({ where: { action: "INVOICE_CREDIT_NOTE", entityId: id, relatedEntityId: body.requestKey } });
      if (existing) return invoice;
      if (invoice.status === "VOID" || amount > invoice.balanceAmount) throw new Error("Credit exceeds unpaid balance. Review paid allocations for refund or reallocation first.");
      await tx.invoiceLineItem.create({ data: { invoiceId: id, description: `Credit note: ${String(body.reason).trim()}`, itemType: "CREDIT_ADJUSTMENT", amount: -amount } });
      let remaining = amount;
      const installments = await tx.invoiceInstallment.findMany({ where: { invoiceId: id }, orderBy: { installmentNumber: "desc" } });
      for (const item of installments) {
        const credit = Math.min(remaining, Math.max(0, item.amount - item.paidAmount));
        if (credit > 0) await tx.invoiceInstallment.update({ where: { id: item.id }, data: { amount: item.amount - credit, status: item.amount - credit <= item.paidAmount ? "PAID" : item.status } });
        remaining -= credit;
      }
      const balanceAmount = invoice.balanceAmount - amount;
      const updated = await tx.invoice.update({ where: { id }, data: { totalAmount: invoice.totalAmount - amount, balanceAmount, status: balanceAmount <= 0 ? "PAID" : invoice.paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID" } });
      await tx.auditLog.create({ data: { actorId: current.user.id, actorRole: current.user.role, action: "INVOICE_CREDIT_NOTE", entityType: "INVOICE", entityId: id, relatedEntityId: body.requestKey, reason: String(body.reason).trim(), details: JSON.stringify({ amount, beforeTotal: invoice.totalAmount, afterTotal: updated.totalAmount }) } });
      return updated;
    });
    return NextResponse.json({ success: true, invoice });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not issue credit note." }, { status: 409 }); }
}

export const POST = withReadCache(postHandler);
