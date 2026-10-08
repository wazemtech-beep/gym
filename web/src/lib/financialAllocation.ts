import { PrismaClient, InvoiceStatus, InstallmentStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lockMember, lockReceiptSequence } from "@/lib/recordLocks";

type PrismaTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface AllocationResult {
  allocations: Array<{
    invoiceId: string;
    invoiceNumber: string;
    allocatedAmount: number;
    newBalance: number;
    isPaid: boolean;
  }>;
  advanceCreditAmount: number;
  totalAllocated: number;
}

/**
 * Concurrency-safe helper to generate next unique receipt number
 */
export async function generateReceiptNumber(tx?: PrismaTx, prefix = "OXG-RCP"): Promise<string> {
  if (!tx) return prisma.$transaction((transaction) => generateReceiptNumber(transaction, prefix));
  await lockReceiptSequence(tx, prefix);
  const db = tx || prisma;
  const lastPayment = await db.payment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { receiptNumber: true },
  });

  let nextSeq = 101;
  if (lastPayment?.receiptNumber) {
    const parts = lastPayment.receiptNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  } else {
    const totalCount = await db.payment.count();
    nextSeq = totalCount + 101;
  }

  // Double check uniqueness with collision-free retry loop
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0
      ? `${prefix}-${String(nextSeq).padStart(6, "0")}`
      : `${prefix}-${String(nextSeq + attempt).padStart(6, "0")}-${Math.floor(Math.random() * 900) + 100}`;

    const existing = await db.payment.findUnique({ where: { receiptNumber: candidate } });
    if (!existing) {
      return candidate;
    }
  }

  return `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900) + 100}`;
}

/**
 * Allocates a confirmed payment against member's unpaid invoices and installments.
 * Supports:
 * - Specific target invoice priority (if provided)
 * - FIFO oldest-due invoice allocation across multiple open bills
 * - Installment settlement (updating paidAmount and status: PAID / OVERDUE / PENDING)
 * - Overpayment handling (excess credited to AdvanceCredit ledger without negative dues)
 */
export async function allocatePaymentToInvoicesAndInstallments(
  tx: PrismaTx,
  params: {
    gymMemberId: string;
    paymentId: string;
    amount: number;
    preferredInvoiceId?: string | null;
    customAllocations?: Array<{ invoiceId: string; amount: number }>;
  }
): Promise<AllocationResult> {
  const { gymMemberId, paymentId, amount, preferredInvoiceId } = params;
  await lockMember(tx, gymMemberId);

  let remainingPayment = amount;
  const allocations: AllocationResult["allocations"] = [];

  // 1. Fetch eligible open invoices for this member
  // (balanceAmount > 0 and status in UNPAID or PARTIALLY_PAID)
  const openInvoices = await tx.invoice.findMany({
    where: {
      gymMemberId,
      balanceAmount: { gt: 0 },
      status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
    },
    orderBy: [
      { dueDate: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      installments: {
        orderBy: { installmentNumber: "asc" },
      },
    },
  });

  // Reorder so that preferredInvoiceId comes first if present
  let orderedInvoices = [...openInvoices];
  if (preferredInvoiceId) {
    const prefIdx = orderedInvoices.findIndex((inv) => inv.id === preferredInvoiceId);
    if (prefIdx > 0) {
      const [preferred] = orderedInvoices.splice(prefIdx, 1);
      orderedInvoices.unshift(preferred);
    }
  }

  const now = new Date();
  const requested = params.customAllocations;
  if (requested?.length) {
    const ids = new Set<string>();
    let total = 0;
    for (const allocation of requested) {
      const invoice = openInvoices.find((item) => item.id === allocation.invoiceId);
      if (!invoice || ids.has(allocation.invoiceId) || !Number.isFinite(allocation.amount) || allocation.amount <= 0 || allocation.amount > invoice.balanceAmount + 0.001) throw new Error("Invalid invoice allocation. Refresh balances and try again.");
      ids.add(allocation.invoiceId);
      total += allocation.amount;
    }
    if (Math.abs(total - amount) > 0.001) throw new Error("Invoice allocations must equal the payment amount.");
    orderedInvoices = requested.map((item) => openInvoices.find((invoice) => invoice.id === item.invoiceId)!);
  }

  // 2. Sequentially allocate payment across invoices
  for (const invoice of orderedInvoices) {
    if (remainingPayment <= 0.001) break;

    const currentBalance = invoice.balanceAmount;
    const allocAmount = requested?.length ? requested.find((item) => item.invoiceId === invoice.id)!.amount : Math.min(remainingPayment, currentBalance);

    if (allocAmount > 0) {
      const newPaidAmount = Math.round((invoice.paidAmount + allocAmount) * 100) / 100;
      const newBalance = Math.max(0, Math.round((invoice.totalAmount - newPaidAmount) * 100) / 100);
      const isPaid = newBalance <= 0.001;
      const newStatus = isPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      // Update Invoice
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalance,
          status: newStatus,
        },
      });

      // Record Allocation with immutable balance snapshot
      await tx.paymentAllocation.create({
        data: {
          paymentId,
          invoiceId: invoice.id,
          amount: allocAmount,
          balanceAfterAllocation: newBalance,
        },
      });

      // 3. Settle individual installments if invoice is installment-based
      if (invoice.installments && invoice.installments.length > 0) {
        let instAllocationRemaining = allocAmount;

        for (const inst of invoice.installments) {
          if (instAllocationRemaining <= 0.001) break;

          const currentInstPaid = inst.paidAmount || 0;
          const instRemainingDue = Math.max(0, Math.round((inst.amount - currentInstPaid) * 100) / 100);

          if (instRemainingDue > 0) {
            const instPayment = Math.min(instRemainingDue, instAllocationRemaining);
            const newInstPaid = Math.round((currentInstPaid + instPayment) * 100) / 100;
            const isInstFullyPaid = newInstPaid >= (inst.amount - 0.001);

            let newInstStatus: InstallmentStatus;
            if (isInstFullyPaid) {
              newInstStatus = InstallmentStatus.PAID;
            } else if (new Date(inst.dueDate) < now) {
              newInstStatus = InstallmentStatus.OVERDUE;
            } else {
              newInstStatus = InstallmentStatus.PENDING;
            }

            await tx.invoiceInstallment.update({
              where: { id: inst.id },
              data: {
                paidAmount: newInstPaid,
                status: newInstStatus,
              },
            });

            instAllocationRemaining = Math.round((instAllocationRemaining - instPayment) * 100) / 100;
          }
        }
      }

      allocations.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        allocatedAmount: allocAmount,
        newBalance,
        isPaid,
      });

      remainingPayment = Math.round((remainingPayment - allocAmount) * 100) / 100;
    }
  }

  // 4. Overpayment: Store excess in AdvanceCredit ledger (Requirement 5.5 / Line 1080)
  let advanceCreditAmount = 0;
  if (remainingPayment > 0.001) {
    advanceCreditAmount = remainingPayment;

    await tx.advanceCredit.create({
      data: {
        gymMemberId,
        amount: advanceCreditAmount,
        sourceType: "OVERPAYMENT",
        paymentId,
        notes: `Excess payment of Rs. ${advanceCreditAmount.toLocaleString()} credited to advance balance`,
      },
    });

    await tx.gymMember.update({
      where: { id: gymMemberId },
      data: {
        advanceBalance: { increment: advanceCreditAmount },
      },
    });
  }

  return {
    allocations,
    advanceCreditAmount,
    totalAllocated: Math.round((amount - advanceCreditAmount) * 100) / 100,
  };
}
