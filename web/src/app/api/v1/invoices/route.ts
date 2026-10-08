import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Role, InvoiceStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!["OWNER", "RECEPTIONIST", "MEMBER"].includes(current.user.role)) return NextResponse.json({ success: false, error: "Invoice access denied." }, { status: 403 });
    const searchParams = req.nextUrl.searchParams;
    const memberId = searchParams.get("memberId");
    const status = searchParams.get("status") as InvoiceStatus | null;
    const search = searchParams.get("search")?.trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (current.user.role === Role.MEMBER) {
      const myMember = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
        select: { id: true },
      });
      if (!myMember) {
        return NextResponse.json({ success: true, invoices: [], total: 0 });
      }
      where.gymMemberId = myMember.id;
    } else {
      // Owner or Staff
      if (memberId) {
        where.gymMemberId = memberId;
      }
      if (status && Object.values(InvoiceStatus).includes(status)) {
        where.status = status;
      }
      if (startDate || endDate) {
        where.dueDate = {};
        if (startDate) where.dueDate.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.dueDate.lte = end;
        }
      }
      if (search) {
        where.OR = [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { gymMember: { fullName: { contains: search, mode: "insensitive" } } },
          { gymMember: { memberId: { contains: search, mode: "insensitive" } } },
          { gymMember: { phone: { contains: search, mode: "insensitive" } } },
        ];
      }
    }

    const [invoices, total, stats] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          gymMember: {
            select: { id: true, fullName: true, memberId: true, phone: true },
          },
          membership: {
            select: { id: true, planName: true, startDate: true, endDate: true },
          },
          lineItems: true,
          installments: {
            orderBy: { installmentNumber: "asc" },
          },
          allocations: {
            include: {
              payment: {
                select: { id: true, receiptNumber: true, paymentDate: true, method: true },
              },
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where: current.user.role === Role.MEMBER ? where : {},
        _sum: {
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const now = new Date();
    const overdueCount = await prisma.invoice.count({
      where: {
        ...(current.user.role === Role.MEMBER ? where : {}),
        balanceAmount: { gt: 0 },
        dueDate: { lt: now },
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
      },
    });

    return NextResponse.json({
      success: true,
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalInvoiced: stats._sum.totalAmount || 0,
        totalPaid: stats._sum.paidAmount || 0,
        totalOutstanding: stats._sum.balanceAmount || 0,
        overdueCount,
      },
    });
  } catch (error) {
    console.error("GET Invoices API Error:", error);
    return NextResponse.json(
      { success: false, error: "Invoices load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
