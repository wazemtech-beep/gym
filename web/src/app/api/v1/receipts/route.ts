import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PaymentStatus, PaymentMethod } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!["OWNER", "RECEPTIONIST", "MEMBER"].includes(current.user.role)) return NextResponse.json({ success: false, error: "Receipt access denied." }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const methodParam = searchParams.get("method") || "ALL";
    const statusParam = searchParams.get("status") || "ALL";
    const dateRange = searchParams.get("dateRange") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (current.user.role === "MEMBER") {
      const member = await prisma.gymMember.findUnique({ where: { userId: current.user.id }, select: { id: true } });
      if (!member) return NextResponse.json({ success: false, error: "Member profile missing." }, { status: 404 });
      whereClause.gymMemberId = member.id;
    }

    // Filter by Method
    if (methodParam !== "ALL") {
      whereClause.method = methodParam as PaymentMethod;
    }

    // Filter by Status
    if (statusParam !== "ALL") {
      whereClause.status = statusParam as PaymentStatus;
    }

    // Filter by Date Range (Asia/Karachi timezone)
    const now = new Date();
    if (dateRange === "today") {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      whereClause.paymentDate = { gte: startOfToday, lte: endOfToday };
    } else if (dateRange === "yesterday") {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      whereClause.paymentDate = { gte: startOfYesterday, lte: endOfYesterday };
    } else if (dateRange === "this_week") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7;
      startOfWeek.setDate(startOfWeek.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      whereClause.paymentDate = { gte: startOfWeek };
    } else if (dateRange === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      whereClause.paymentDate = { gte: startOfMonth };
    }

    // Search by receiptNumber, member name, member ID, or reference
    if (search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { receiptNumber: { contains: term, mode: "insensitive" } },
        { referenceNumber: { contains: term, mode: "insensitive" } },
        { gymMember: { fullName: { contains: term, mode: "insensitive" } } },
        { gymMember: { memberId: { contains: term, mode: "insensitive" } } },
      ];
    }

    const [totalCount, receipts, aggregates] = await Promise.all([
      prisma.payment.count({ where: whereClause }),
      prisma.payment.findMany({
        where: whereClause,
        include: {
          gymMember: {
            select: {
              id: true,
              memberId: true,
              fullName: true,
              phone: true,
              email: true,
            },
          },
          receivingAccount: {
            select: { displayName: true, type: true },
          },
          recordedBy: {
            select: { id: true, name: true, role: true },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  invoiceNumber: true,
                  title: true,
                  totalAmount: true,
                  balanceAmount: true,
                },
              },
            },
          },
        },
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.aggregate({
        where: { ...whereClause, status: PaymentStatus.CONFIRMED },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Separate Cash vs Bank confirmed totals
    const [cashAgg, bankAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...whereClause, method: PaymentMethod.CASH, status: PaymentStatus.CONFIRMED },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          ...whereClause,
          method: { in: [PaymentMethod.BANK_TRANSFER, PaymentMethod.EASYPAISA, PaymentMethod.JAZZCASH] },
          status: PaymentStatus.CONFIRMED,
        },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      receipts,
      stats: {
        totalRevenue: aggregates._sum.amount || 0,
        confirmedCount: aggregates._count || 0,
        cashTotal: cashAgg._sum.amount || 0,
        bankTotal: bankAgg._sum.amount || 0,
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get Receipts Error:", error);
    return NextResponse.json(
      { success: false, error: "Receipts load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
