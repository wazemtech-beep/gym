import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";

async function postHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (current.user.role !== "OWNER") return NextResponse.json({ error: "Only the owner can correct opening balances." }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const amount = Number(body.amount), reason = String(body.reason || "").trim();
  if (!Number.isFinite(amount) || amount < 0 || !reason) return NextResponse.json({ error: "Enter a valid amount and a correction reason." }, { status: 400 });
  try {
    await prisma.$transaction(async tx => {
      await lockMember(tx, id);
      const member = await tx.gymMember.findUniqueOrThrow({ where: { id } });
      let invoice = await tx.invoice.findFirst({ where: { gymMemberId: id, invoiceNumber: { startsWith: "OXG-INV-OPN-" }, status: { not: "VOID" } }, include: { installments: true } });
      if (invoice && amount < invoice.paidAmount) throw new Error("This correction is below payments already applied. Review a refund or reallocation first.");
      if (invoice?.installments.length) throw new Error("Use the invoice adjustment workflow for an opening balance with installments.");
      const oldAmount = invoice?.totalAmount ?? member.openingDues ?? 0;
      if (invoice) {
        await tx.invoiceLineItem.create({ data: { invoiceId: invoice.id, description: `Opening balance correction: ${reason}`, amount: amount - oldAmount, itemType: "CREDIT_ADJUSTMENT" } });
        await tx.invoice.update({ where: { id: invoice.id }, data: { totalAmount: amount, balanceAmount: amount - invoice.paidAmount, status: amount === invoice.paidAmount ? "PAID" : invoice.paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID" } });
      } else if (amount > 0) {
        invoice = await tx.invoice.create({ data: { invoiceNumber: `OXG-INV-OPN-${member.memberId.replace("OXG-", "")}`, gymMemberId: id, title: "Opening Dues Balance", totalAmount: amount, paidAmount: 0, balanceAmount: amount, dueDate: member.joiningDate, status: "UNPAID", notes: reason }, include: { installments: true } });
      }
      await tx.gymMember.update({ where: { id }, data: { openingDues: amount } });
      await tx.auditLog.create({ data: { actorId: current.user.id, actorName: current.user.name, actorRole: current.user.role, action: "OPENING_BALANCE_CORRECTED", entityType: "GYM_MEMBER", entityId: id, details: JSON.stringify({ oldAmount, amount, reason, invoiceId: invoice?.id }) } });
    });
    return NextResponse.json({ success: true });
  } catch(error: any) { return NextResponse.json({ error: error.message || "Could not correct opening balance." }, { status: 409 }); }
}

export const POST = withReadCache(postHandler);
