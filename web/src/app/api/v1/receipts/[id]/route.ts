import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { lockMember } from "@/lib/recordLocks";
import { Role, PaymentStatus, InvoiceStatus } from "@prisma/client";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;

    // Lookup by ID or Receipt Number (e.g. OXG-RCP-000104)
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { receiptNumber: id }],
      },
      include: {
        gymMember: {
          select: {
            id: true,
            memberId: true,
            fullName: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        receivingAccount: {
          select: {
            displayName: true,
            accountTitle: true,
            accountNumber: true,
            type: true,
          },
        },
        recordedBy: {
          select: {
            name: true,
            role: true,
          },
        },
        reversedBy: {
          select: {
            name: true,
            role: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              include: {
                membership: {
                  select: {
                    planName: true,
                    startDate: true,
                    endDate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: "Receipt nahi mili." }, { status: 404 });
    }

    // Role check (TXT requirement / Line 1120): Trainers are strictly excluded from financial receipts
    if (current.user.role === Role.TRAINER) {
      return NextResponse.json(
        { success: false, error: "Trainers ko financial receipts dekhne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    // Role check (Requirement Point 7): Member can only view their own receipts
    if (current.user.role === Role.MEMBER) {
      const memberProfile = await prisma.gymMember.findFirst({
        where: { userId: current.user.id },
      });
      if (!memberProfile || memberProfile.id !== payment.gymMemberId) {
        return NextResponse.json(
          { success: false, error: "Aap sirf apni receipts dekh sakte hain." },
          { status: 403 }
        );
      }
    }

    // Calculate/use immutable balance for each allocation so subsequent payments NEVER rewrite past receipts
    const frozenAllocations = await Promise.all(
      payment.allocations.map(async (alloc) => {
        let frozenBalance = alloc.balanceAfterAllocation;

        if (frozenBalance === null || frozenBalance === undefined) {
          // Reconstruct historical balance as of this payment date
          const priorAllocations = await prisma.paymentAllocation.findMany({
            where: {
              invoiceId: alloc.invoiceId,
              payment: {
                paymentDate: { lte: payment.paymentDate },
                status: { not: PaymentStatus.REVERSED },
              },
            },
          });
          const totalSettledUpToThisPayment = priorAllocations.reduce((s, a) => s + a.amount, 0);
          frozenBalance = Math.max(0, alloc.invoice.totalAmount - totalSettledUpToThisPayment);
        }

        return {
          ...alloc,
          invoice: {
            ...alloc.invoice,
            balanceAmount: frozenBalance,
            frozenBalanceAfterPayment: frozenBalance,
          },
        };
      })
    );

    // Use immutable branding snapshot if available, falling back to current settings (Requirement 14.2)
    const snapshot = payment.brandingSnapshot as any;
    const settings = await prisma.gymSettings.findFirst();

    return NextResponse.json({
      success: true,
      receipt: {
        ...payment,
        gymMember: { ...payment.gymMember, fullName: snapshot?.memberName ?? payment.gymMember.fullName, memberId: snapshot?.memberId ?? payment.gymMember.memberId, phone: snapshot?.memberPhone ?? payment.gymMember.phone },
        allocations: frozenAllocations,
        memberRemainingDues: payment.memberRemainingDues ?? undefined,
        gymInfo: {
          name: snapshot?.gymName || settings?.gymName || "OXGEN GYM",
          tagline: snapshot?.tagline || settings?.tagline || "Strength & Performance",
          phone: snapshot?.contactPhone || settings?.contactPhone || "+92 300 1234567",
          email: snapshot?.contactEmail || settings?.contactEmail || "info@oxgengym.com",
          address: snapshot?.address || settings?.address || "Main Boulevard, Gulberg III, Lahore, Pakistan",
          currency: snapshot?.currency || settings?.currency || "PKR",
          timezone: settings?.timezone || "Asia/Karachi",
          footer: snapshot?.receiptFooter || settings?.receiptFooter || "Thank you for choosing OXGEN GYM",
        },
      },
    });
  } catch (error) {
    console.error("Get Receipt Error:", error);
    return NextResponse.json({ success: false, error: "Receipt load karne mein khata aayi." }, { status: 500 });
  }
}

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Reversal is strictly Owner only (Requirement Point 6 & 7)
    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Payment reverse karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: "Payment reverse karne ki waja (reason) likhna lazmi hai." },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { receiptNumber: id }],
      },
      include: {
        allocations: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment nahi mili." }, { status: 404 });
    }

    if (payment.status !== PaymentStatus.CONFIRMED) {
      return NextResponse.json(
        { success: false, error: "Only a confirmed payment without refunds can be reversed." },
        { status: 400 }
      );
    }

    // Atomic reversal: Update Payment + Restore Invoices + Audit Log (Requirement Point 6)
    const reversed = await prisma.$transaction(async (tx) => {
      await lockMember(tx, payment.gymMemberId);
      if (await tx.refund.count({ where: { paymentId: payment.id } })) throw new Error("Review existing refunds before reversing this payment.");
      const member = await tx.gymMember.findUniqueOrThrow({ where: { id: payment.gymMemberId } });
      const advancePortion = Math.max(0, payment.amount - payment.allocations.reduce((sum, allocation) => sum + allocation.amount, 0));
      if (payment.method === "ADVANCE_CREDIT") {
        await tx.gymMember.update({ where: { id: member.id }, data: { advanceBalance: { increment: payment.amount } } });
        await tx.advanceCredit.create({ data: { gymMemberId: member.id, amount: payment.amount, sourceType: "ADVANCE_PAYMENT_REVERSAL", paymentId: payment.id, notes: reason.trim() } });
      } else if (advancePortion > 0) {
        if ((member.advanceBalance || 0) < advancePortion) throw new Error("Payment advance credit has already been used. Resolve its allocations before reversing.");
        await tx.gymMember.update({ where: { id: member.id }, data: { advanceBalance: { decrement: advancePortion } } });
        await tx.advanceCredit.create({ data: { gymMemberId: member.id, amount: -advancePortion, sourceType: "OVERPAYMENT_REVERSAL", paymentId: payment.id, notes: reason.trim() } });
      }
      // 1. Mark Payment REVERSED with reason & timestamp
      const p = await tx.payment.update({
        where: { id: payment.id, status: PaymentStatus.CONFIRMED },
        data: {
          status: PaymentStatus.REVERSED,
          reversalReason: reason.trim(),
          reversedAt: new Date(),
          reversedById: current.user.id,
        },
      });

      // 2. Restore Invoice balances for all allocations
      for (const alloc of payment.allocations) {
        const inv = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
        if (inv) {
          if (inv.status === InvoiceStatus.VOID) throw new Error("This invoice has released paid funds. Review its advance credit or refund before reversing the linked payment.");
          const newPaid = Math.max(0, inv.paidAmount - alloc.amount);
          const newBalance = inv.totalAmount - newPaid;
          const newStatus = newPaid === 0 ? InvoiceStatus.UNPAID : InvoiceStatus.PARTIALLY_PAID;

          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBalance,
              status: newStatus,
            },
          });
          let remaining = alloc.amount;
          const installments = await tx.invoiceInstallment.findMany({ where: { invoiceId: inv.id }, orderBy: { installmentNumber: "desc" } });
          for (const installment of installments) {
            const reduce = Math.min(remaining, installment.paidAmount);
            if (reduce > 0) await tx.invoiceInstallment.update({ where: { id: installment.id }, data: { paidAmount: installment.paidAmount - reduce, status: installment.dueDate < new Date() ? "OVERDUE" : "PENDING" } });
            remaining -= reduce;
            if (remaining <= 0) break;
          }
        }
      }

      if (payment.method === "CASH") {
        const drawer = await tx.cashSession.findFirst({ where: { staffId: payment.recordedById, status: "OPEN", openedAt: { lte: payment.createdAt } } });
        if (drawer) await tx.cashSession.update({ where: { id: drawer.id, status: "OPEN" }, data: { expectedCash: { decrement: payment.amount } } });
      }

      // 3. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "PAYMENT_REVERSED",
          entityType: "PAYMENT",
          entityId: payment.id,
          details: JSON.stringify({
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            reason: reason.trim(),
          }),
        },
      });

      return p;
    });

    return NextResponse.json({
      success: true,
      message: `Receipt ${reversed.receiptNumber} kamiyabi se REVERSED mark ho gayi aur invoice balance restore ho gaya.`,
      payment: reversed,
    });
  } catch (error) {
    console.error("Reverse Receipt Error:", error);
    return NextResponse.json(
      { success: false, error: "Payment reverse karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
