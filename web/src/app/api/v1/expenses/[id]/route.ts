import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, ExpenseStatus } from "@prisma/client";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json(
        { success: false, error: "Expenses access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: {
        OR: [{ id }, { expenseNumber: id }],
      },
      include: {
        category: true,
        recordedBy: {
          select: { id: true, name: true, role: true, email: true },
        },
        payments: {
          include: {
            receivingAccount: {
              select: { displayName: true, accountNumber: true, type: true },
            },
            cashSession: {
              select: { sessionNumber: true, status: true },
            },
            recordedBy: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { paymentDate: "desc" },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense nahi mila." }, { status: 404 });
    }

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error("Get Expense Error:", error);
    return NextResponse.json(
      { success: false, error: "Expense load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function putHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json(
        { success: false, error: "Expense edit karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      title,
      categoryId,
      payee,
      totalAmount,
      expenseDate,
      dueDate,
      notes,
      attachmentUrl,
      employeeSalaryMonth,
    } = body;

    const existing = await prisma.expense.findFirst({
      where: {
        OR: [{ id }, { expenseNumber: id }],
      },
      include: { category: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Expense nahi mila." }, { status: 404 });
    }

    if (existing.status === ExpenseStatus.VOID) {
      return NextResponse.json(
        { success: false, error: "Void shuda expense edit nahi kiya ja sakta." },
        { status: 400 }
      );
    }

    let newTotal = existing.totalAmount;
    if (totalAmount !== undefined) {
      const parsedTotal = parseFloat(totalAmount);
      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        return NextResponse.json(
          { success: false, error: "Valid total amount darj karein." },
          { status: 400 }
        );
      }
      if (parsedTotal < existing.paidAmount) {
        return NextResponse.json(
          {
            success: false,
            error: `Total amount paid amount (Rs. ${existing.paidAmount.toLocaleString()}) se kam nahi ho sakti.`,
          },
          { status: 400 }
        );
      }
      newTotal = parsedTotal;
    }

    const newBalance = Math.max(0, newTotal - existing.paidAmount);
    let newStatus = existing.status;
    if (existing.paidAmount === 0) {
      newStatus = ExpenseStatus.UNPAID;
    } else if (newBalance === 0) {
      newStatus = ExpenseStatus.PAID;
    } else {
      newStatus = ExpenseStatus.PARTIALLY_PAID;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.update({
        where: { id: existing.id },
        data: {
          title: title !== undefined ? title.trim() : existing.title,
          categoryId: categoryId || existing.categoryId,
          payee: payee !== undefined ? payee.trim() : existing.payee,
          totalAmount: newTotal,
          balanceAmount: newBalance,
          status: newStatus,
          expenseDate: expenseDate ? new Date(expenseDate) : existing.expenseDate,
          dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
          notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
          attachmentUrl: attachmentUrl !== undefined ? attachmentUrl : existing.attachmentUrl,
          employeeSalaryMonth:
            employeeSalaryMonth !== undefined
              ? (employeeSalaryMonth ? employeeSalaryMonth.trim() : null)
              : existing.employeeSalaryMonth,
        },
        include: {
          category: true,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "EXPENSE_UPDATED",
          entityType: "EXPENSE",
          entityId: exp.id,
          details: JSON.stringify({
            expenseNumber: exp.expenseNumber,
            oldTotal: existing.totalAmount,
            newTotal,
            oldPayee: existing.payee,
            newPayee: exp.payee,
            newBalance,
            newStatus,
          }),
        },
      });

      return exp;
    });

    return NextResponse.json({
      success: true,
      message: `Expense ${updated.expenseNumber} kamiyabi se update ho gaya!`,
      expense: updated,
    });
  } catch (error) {
    console.error("Update Expense Error:", error);
    return NextResponse.json(
      { success: false, error: "Expense update karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Only Owner can void an expense (Requirement 11.8)
    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Expense void karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason = "Duplicate ya incorrect record" } = body;

    const existing = await prisma.expense.findFirst({
      where: {
        OR: [{ id }, { expenseNumber: id }],
      },
      include: { payments: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Expense nahi mila." }, { status: 404 });
    }

    if (existing.paidAmount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Is expense ke against payments ho chuki hain (Rs. ${existing.paidAmount.toLocaleString()}). Pehle payment adjustment karein.`,
        },
        { status: 400 }
      );
    }

    const voided = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.update({
        where: { id: existing.id },
        data: {
          status: ExpenseStatus.VOID,
          notes: existing.notes ? `${existing.notes} | VOIDED: ${reason}` : `VOIDED: ${reason}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "EXPENSE_VOIDED",
          entityType: "EXPENSE",
          entityId: exp.id,
          details: JSON.stringify({
            expenseNumber: exp.expenseNumber,
            title: exp.title,
            reason,
          }),
        },
      });

      return exp;
    });

    return NextResponse.json({
      success: true,
      message: `Expense ${voided.expenseNumber} kamiyabi se VOID mark kar diya gaya.`,
      expense: voided,
    });
  } catch (error) {
    console.error("Void Expense Error:", error);
    return NextResponse.json(
      { success: false, error: "Expense void karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const PUT = withReadCache(putHandler);
export const DELETE = withReadCache(deleteHandler);
