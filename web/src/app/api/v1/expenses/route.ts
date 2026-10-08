import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasUserPermission } from "@/lib/permissions";
import { Role, ExpenseStatus, PaymentMethod } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Role & permission check (Point 11.9 & 14.6: Owner default; Receptionist if explicitly granted)
    if (!hasUserPermission(current.user, "EXPENSES_MANAGE")) {
      return NextResponse.json(
        { success: false, error: "Expenses access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "ALL";
    const statusParam = searchParams.get("status") || "ALL";
    const dateRange = searchParams.get("dateRange") || "this_month";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (categoryId !== "ALL") {
      whereClause.categoryId = categoryId;
    }

    if (statusParam !== "ALL") {
      whereClause.status = statusParam as ExpenseStatus;
    }

    // Filter by date range (Asia/Karachi)
    const now = new Date();
    if (dateRange === "today") {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      whereClause.expenseDate = { gte: startOfToday, lte: endOfToday };
    } else if (dateRange === "this_week") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7;
      startOfWeek.setDate(startOfWeek.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      whereClause.expenseDate = { gte: startOfWeek };
    } else if (dateRange === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      whereClause.expenseDate = { gte: startOfMonth };
    }

    if (search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { expenseNumber: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
        { payee: { contains: term, mode: "insensitive" } },
        { notes: { contains: term, mode: "insensitive" } },
      ];
    }

    const [totalCount, expenses, allExpensesInPeriod, categories] = await Promise.all([
      prisma.expense.count({ where: whereClause }),
      prisma.expense.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, name: true } },
          recordedBy: { select: { id: true, name: true } },
          payments: {
            include: {
              receivingAccount: { select: { displayName: true } },
              recordedBy: { select: { name: true } },
            },
            orderBy: { paymentDate: "desc" },
          },
        },
        orderBy: { expenseDate: "desc" },
        skip,
        take: limit,
      }),
      // Fetch all expenses in period for metric summaries
      prisma.expense.findMany({
        where: whereClause,
        select: {
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          dueDate: true,
          status: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      }),
      prisma.expenseCategory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Financial calculations
    const totalRecorded = allExpensesInPeriod.reduce((sum, e) => sum + e.totalAmount, 0);
    const totalPaid = allExpensesInPeriod.reduce((sum, e) => sum + e.paidAmount, 0);
    const outstandingPayable = allExpensesInPeriod.reduce((sum, e) => sum + e.balanceAmount, 0);

    const overduePayable = allExpensesInPeriod
      .filter((e) => e.balanceAmount > 0 && e.dueDate && new Date(e.dueDate) < now)
      .reduce((sum, e) => sum + e.balanceAmount, 0);

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    for (const exp of allExpensesInPeriod) {
      const catName = exp.category.name;
      categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.totalAmount;
    }

    return NextResponse.json({
      success: true,
      expenses,
      categories,
      stats: {
        totalRecorded,
        totalPaid,
        outstandingPayable,
        overduePayable,
        categoryTotals,
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get Expenses Error:", error);
    return NextResponse.json(
      { success: false, error: "Expenses load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "EXPENSES_MANAGE")) {
      return NextResponse.json(
        { success: false, error: "Expense add karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

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
      employeeId,
      isPaidNow,
      paymentAmount,
      paymentMethod = "CASH",
      receivingAccountId,
      referenceNumber,
    } = body;

    if (!title || !categoryId || !payee) {
      return NextResponse.json(
        { success: false, error: "Title, category aur payee ka naam lazmi hain." },
        { status: 400 }
      );
    }

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    const salary = /salar/i.test(category?.name || "");
    const employee = employeeId ? await prisma.user.findFirst({ where: { id: employeeId, role: { in: [Role.TRAINER, Role.RECEPTIONIST] } }, select: { id: true, name: true } }) : null;
    if (employeeId && !employee) return NextResponse.json({ success: false, error: "Choose a valid staff account." }, { status: 400 });
    if (salary && (!employee || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(employeeSalaryMonth || "")))) return NextResponse.json({ success: false, error: "Select an employee and salary month." }, { status: 400 });
    const parsedTotal = parseFloat(totalAmount);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json(
        { success: false, error: "Total amount positive number honi chahiye." },
        { status: 400 }
      );
    }

    const parsedExpenseDate = expenseDate ? new Date(expenseDate) : new Date();
    const parsedDueDate = dueDate ? new Date(dueDate) : null;

    // Check payment details if paid now
    let initialPaid = 0;
    let initialStatus: ExpenseStatus = ExpenseStatus.UNPAID;

    if (isPaidNow) {
      const paymentVal = parseFloat(paymentAmount || totalAmount);
      if (paymentVal > 0) {
        initialPaid = Math.min(parsedTotal, paymentVal);
        initialStatus = initialPaid >= parsedTotal ? ExpenseStatus.PAID : ExpenseStatus.PARTIALLY_PAID;
      }
    }

    const initialBalance = Math.max(0, parsedTotal - initialPaid);

    // Sequential expense numbering (OXG-EXP-000001)


    const newExpense = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('expense-number'))`;
      const expenseNumber = `OXG-EXP-${String(await tx.expense.count() + 1).padStart(6, "0")}`;
      // 1. Create Expense record
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          title: title.trim(),
          categoryId,
          payee: employee?.name || payee.trim(),
          employeeId: employee?.id || null,
          totalAmount: parsedTotal,
          paidAmount: initialPaid,
          balanceAmount: initialBalance,
          expenseDate: parsedExpenseDate,
          dueDate: parsedDueDate,
          status: initialStatus,
          notes: notes ? notes.trim() : null,
          attachmentUrl: attachmentUrl || null,
          employeeSalaryMonth: employeeSalaryMonth ? employeeSalaryMonth.trim() : null,
          recordedById: current.user.id,
        },
        include: {
          category: true,
        },
      });

      // 2. If paid now, create ExpensePayment record
      let paymentRecord = null;
      if (initialPaid > 0) {
        let openSessionId: string | null = null;
        if (paymentMethod === PaymentMethod.CASH) {
          const activeSession = await tx.cashSession.findFirst({
            where: { status: "OPEN", staffId: current.user.id },
            orderBy: { openedAt: "desc" },
          });
          if (activeSession) {
            openSessionId = activeSession.id;
            await tx.cashSession.update({
              where: { id: activeSession.id },
              data: {
                expectedCash: Math.max(0, activeSession.expectedCash - initialPaid),
              },
            });
          }
        }

        paymentRecord = await tx.expensePayment.create({
          data: {
            expenseId: expense.id,
            amount: initialPaid,
            paymentDate: new Date(),
            method: paymentMethod as PaymentMethod,
            receivingAccountId: receivingAccountId || null,
            cashSessionId: openSessionId,
            referenceNumber: referenceNumber ? referenceNumber.trim() : null,
            notes: notes ? notes.trim() : "Initial payment at creation",
            recordedById: current.user.id,
          },
        });
      }

      // 3. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "EXPENSE_RECORDED",
          entityType: "EXPENSE",
          entityId: expense.id,
          details: JSON.stringify({
            expenseNumber: expense.expenseNumber,
            title: expense.title,
            category: expense.category.name,
            totalAmount: parsedTotal,
            paidAmount: initialPaid,
            balanceAmount: initialBalance,
            status: initialStatus,
          }),
        },
      });

      return { expense, paymentRecord };
    });

    return NextResponse.json({
      success: true,
      message: `Expense '${newExpense.expense.title}' (Rs. ${parsedTotal.toLocaleString()}) kamiyabi se record ho gaya!`,
      expense: newExpense.expense,
      payment: newExpense.paymentRecord,
    });
  } catch (error) {
    console.error("Create Expense Error:", error);
    return NextResponse.json(
      { success: false, error: "Expense add karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
