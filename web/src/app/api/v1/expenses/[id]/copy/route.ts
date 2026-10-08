import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, ExpenseStatus } from "@prisma/client";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Expense copy karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      newExpenseDate,
      newDueDate,
      newSalaryMonth,
      newTitle,
    } = body;

    const source = await prisma.expense.findFirst({
      where: {
        OR: [{ id }, { expenseNumber: id }],
      },
      include: { category: true },
    });

    if (!source) {
      return NextResponse.json({ success: false, error: "Source expense nahi mila." }, { status: 404 });
    }

    // Sequential numbering


    const parsedExpenseDate = newExpenseDate ? new Date(newExpenseDate) : new Date();
    const parsedDueDate = newDueDate ? new Date(newDueDate) : null;

    // Generated cloned expense (always starts UNPAID per specs: "Recurring record generate hona automatically paisa pay hona nahi hoga")
    const cloned = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('expense-number'))`;
      const expenseNumber = `OXG-EXP-${String(await tx.expense.count() + 1).padStart(6, "0")}`;
      const exp = await tx.expense.create({
        data: {
          expenseNumber,
          title: newTitle?.trim() || `${source.title} (Copy)`,
          categoryId: source.categoryId,
          payee: source.payee,
          employeeId: source.employeeId,
          totalAmount: source.totalAmount,
          paidAmount: 0,
          balanceAmount: source.totalAmount,
          expenseDate: parsedExpenseDate,
          dueDate: parsedDueDate,
          status: ExpenseStatus.UNPAID,
          notes: source.notes ? `Cloned from ${source.expenseNumber}. ${source.notes}` : `Cloned from ${source.expenseNumber}`,
          attachmentUrl: null, // Attachments are unique to bills, so leave empty for new bill
          employeeSalaryMonth: newSalaryMonth?.trim() || (source.employeeId ? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }).slice(0, 7) : source.employeeSalaryMonth),
          recordedById: current.user.id,
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
          action: "EXPENSE_CLONED",
          entityType: "EXPENSE",
          entityId: exp.id,
          details: JSON.stringify({
            sourceExpenseNumber: source.expenseNumber,
            newExpenseNumber: exp.expenseNumber,
            totalAmount: exp.totalAmount,
          }),
        },
      });

      return exp;
    });

    return NextResponse.json({
      success: true,
      message: `Expense clone ho gaya: ${cloned.expenseNumber} (${cloned.title}). Total Rs. ${cloned.totalAmount.toLocaleString()} UNPAID save hua.`,
      expense: cloned,
    });
  } catch (error) {
    console.error("Copy Expense Error:", error);
    return NextResponse.json(
      { success: false, error: "Expense copy karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
