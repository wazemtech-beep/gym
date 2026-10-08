import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { allocatePaymentToInvoicesAndInstallments, generateReceiptNumber } from "../src/lib/financialAllocation";
import { calculateMembershipEndDate, calculatePricingBreakdown } from "../src/lib/pricing";

const tag = "verify-financial-" + randomUUID();
const rollback = new Error("VERIFICATION_ROLLBACK");
let passed = 0;
function assert(label: string, condition: boolean) { if (!condition) throw new Error(label); passed++; console.log("PASS " + label); }
async function main() {
  try {
    assert("calendar month last valid day", calculateMembershipEndDate("2026-10-05T00:00:00+05:00", 1, "CALENDAR_MONTHS").toISOString() === "2026-11-04T18:59:59.999Z");
    assert("30-day membership last valid day", calculateMembershipEndDate("2026-10-05T00:00:00+05:00", 30, "DAYS").toISOString() === "2026-11-03T18:59:59.999Z");
    assert("discount and admission breakdown", calculatePricingBreakdown({ membershipFee: 1000, admissionFee: 200, applyAdmissionFee: true, discountType: "PERCENTAGE", discountValue: 10, admissionDiscountValue: 50 }).totalPayable === 1050);
    try {
      await prisma.$transaction(async tx => {
        const owner = await tx.user.create({ data: { name: tag, email: tag + "@example.invalid", role: "OWNER", status: "ACTIVE" } });
        const member = await tx.gymMember.create({ data: { memberId: tag, fullName: tag, phone: "03000000000" } });
        const foreign = await tx.gymMember.create({ data: { memberId: tag + "-other", fullName: tag, phone: "03000000001" } });
        const first = await tx.invoice.create({ data: { invoiceNumber: tag + "-1", gymMemberId: member.id, title: tag, totalAmount: 100, balanceAmount: 100, dueDate: new Date("2020-01-01") } });
        const second = await tx.invoice.create({ data: { invoiceNumber: tag + "-2", gymMemberId: member.id, title: tag, totalAmount: 100, balanceAmount: 100, dueDate: new Date("2020-02-01") } });
        const privateInvoice = await tx.invoice.create({ data: { invoiceNumber: tag + "-private", gymMemberId: foreign.id, title: tag, totalAmount: 100, balanceAmount: 100, dueDate: new Date("2020-01-01") } });
        await tx.invoiceInstallment.createMany({ data: [1, 2].map(installmentNumber => ({ invoiceId: first.id, installmentNumber, amount: 50, dueDate: new Date("2020-01-01") })) });
        const receiptNumber = await generateReceiptNumber(tx, tag);
        const payment = await tx.payment.create({ data: { receiptNumber, gymMemberId: member.id, amount: 250, paymentDate: new Date(), method: "CASH", status: "CONFIRMED", recordedById: owner.id } });
        let denied = false;
        try { await allocatePaymentToInvoicesAndInstallments(tx, { gymMemberId: member.id, paymentId: payment.id, amount: 250, customAllocations: [{ invoiceId: privateInvoice.id, amount: 50 }] }); } catch { denied = true; }
        assert("cross-member allocation rejected", denied);
        const allocation = await allocatePaymentToInvoicesAndInstallments(tx, { gymMemberId: member.id, paymentId: payment.id, amount: 250 });
        assert("FIFO invoices settled", allocation.totalAllocated === 200 && allocation.allocations[0].invoiceId === first.id && allocation.allocations[1].invoiceId === second.id);
        assert("overpayment becomes advance credit", allocation.advanceCreditAmount === 50);
        const invoices = await tx.invoice.findMany({ where: { id: { in: [first.id, second.id] } } });
        assert("no negative balance", invoices.every(invoice => invoice.balanceAmount === 0 && invoice.status === "PAID"));
        const installments = await tx.invoiceInstallment.findMany({ where: { invoiceId: first.id } });
        assert("installment amounts settled", installments.every(item => item.paidAmount === 50 && item.status === "PAID"));
        assert("advance ledger agrees with balance", (await tx.gymMember.findUniqueOrThrow({ where: { id: member.id } })).advanceBalance === 50 && (await tx.advanceCredit.aggregate({ where: { gymMemberId: member.id }, _sum: { amount: true } }))._sum.amount === 50);
        assert("receipt lock produces a new number", await generateReceiptNumber(tx, tag) !== receiptNumber);
        throw rollback;
      }, { maxWait: 10000, timeout: 90000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert("transaction fixtures rolled back", await prisma.user.count({ where: { email: tag + "@example.invalid" } }) === 0);
    console.log(JSON.stringify({ check: "financial-integrity", passed, failed: 0, changesCommitted: false }));
  } catch (error) { console.log("FAIL " + (error instanceof Error ? error.message : "financial verification")); process.exitCode = 1; }
  finally { await prisma.$disconnect(); }
}
void main();
