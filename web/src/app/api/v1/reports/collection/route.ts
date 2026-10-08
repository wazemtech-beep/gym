import { withReadCache } from "@/lib/serverReadCache";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { auditReportExport, csvCell } from "@/lib/reportAudit";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, PaymentStatus, PaymentMethod } from "@prisma/client";
import { generateXlsx } from "@/lib/xlsxGenerator";
import { generateReportPdf } from "@/lib/reportPdf";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER && current.user.role !== Role.RECEPTIONIST) {
      return NextResponse.json(
        { success: false, error: "Reports access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "this_month";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const methodParam = searchParams.get("method") || "ALL";

    // Date filtering (Asia/Karachi)
    const { start: gteDate, end: lteDate } = getDateRangeForPeriod(startDateParam && endDateParam ? "custom" : dateRange, startDateParam || undefined, endDateParam || undefined);

    const whereClause: any = {
      ...(current.user.role === Role.RECEPTIONIST ? { recordedById: current.user.id } : {}),
      paymentDate: { gte: gteDate, lte: lteDate },
    };

    if (methodParam !== "ALL") {
      whereClause.method = methodParam as PaymentMethod;
    }

    // 1. Fetch confirmed payments (Excluding reversed, per specs 12.3: "Reversed payments received total se exclude hongi")
    const confirmedWhere = { ...whereClause, status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.REFUNDED] }, method: methodParam === "ALL" ? { not: PaymentMethod.ADVANCE_CREDIT } : methodParam === "ADVANCE_CREDIT" ? { in: [] as PaymentMethod[] } : methodParam as PaymentMethod };
    const payments = await prisma.payment.findMany({
      where: confirmedWhere,
      include: {
        gymMember: {
          select: { id: true, memberId: true, fullName: true, phone: true },
        },
        receivingAccount: {
          select: { displayName: true, type: true },
        },
        recordedBy: {
          select: { name: true, role: true },
        },
        allocations: {
          include: {
            invoice: { select: { invoiceNumber: true, title: true } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    // 2. Fetch refunds in same period
    const refunds = await prisma.refund.findMany({
      where: {
        refundDate: { gte: gteDate, lte: lteDate },
        ...(current.user.role === Role.RECEPTIONIST ? { recordedById: current.user.id } : {}),
      },
      include: {
        payment: { select: { receiptNumber: true } },
      },
    });

    // 3. Financial aggregates
    const cashTotal = payments
      .filter((p) => p.method === PaymentMethod.CASH)
      .reduce((sum, p) => sum + p.amount, 0);

    const bankTransferTotal = payments
      .filter((p) => p.method === PaymentMethod.BANK_TRANSFER)
      .reduce((sum, p) => sum + p.amount, 0);

    const easypaisaTotal = payments
      .filter((p) => p.method === PaymentMethod.EASYPAISA)
      .reduce((sum, p) => sum + p.amount, 0);

    const jazzCashTotal = payments
      .filter((p) => p.method === PaymentMethod.JAZZCASH)
      .reduce((sum, p) => sum + p.amount, 0);

    const digitalTotal = bankTransferTotal + easypaisaTotal + jazzCashTotal;
    const totalReceived = cashTotal + digitalTotal;
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
    const netCollection = totalReceived - totalRefunds;

    const format = searchParams.get("format");
    if (["csv", "xlsx", "xls", "pdf"].includes(format || "")) await auditReportExport(current.user, "collection", format!);

    if (format === "xlsx" || format === "xls" || format === "pdf") {
      const headers = [
        "Receipt No",
        "Date",
        "Member ID",
        "Member Name",
        "Amount (PKR)",
        "Method",
        "Reference No",
        "Account / Bank",
        "Status",
      ];

      const dataRows = payments.map((p: any) => [
        p.receiptNumber,
        new Date(p.paymentDate).toISOString().slice(0, 10),
        p.gymMember?.memberId || "",
        p.gymMember?.fullName || "",
        p.amount,
        p.method,
        p.referenceNumber || "",
        p.receivingAccount?.displayName || "",
        p.status,
      ]);

      const xml = format === "pdf" ? generateReportPdf("Collection Report", headers, dataRows) : generateXlsx("Collection Report", headers, dataRows);
      const filename = `oxgen-collection-report-${dateRange}.${format === "pdf" ? "pdf" : "xlsx"}`;

      return new NextResponse(xml, {
        headers: {
          "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "csv") {
      const csvHeader = [
        "Receipt No",
        "Date",
        "Member ID",
        "Member Name",
        "Amount (PKR)",
        "Method",
        "Reference No",
        "Account / Bank",
        "Status",
      ].join(",");

      const csvRows = payments.map(p => [p.receiptNumber, p.paymentDate.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }), p.gymMember.memberId, p.gymMember.fullName, p.amount, p.method, p.referenceNumber || "", p.receivingAccount?.displayName || "", p.status].map(csvCell).join(","));

      const csvContent = [csvHeader, ...csvRows].join("\n");
      const filename = `oxgen-collection-report-${dateRange}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      period: { gteDate, lteDate },
      summary: {
        cashReceived: cashTotal,
        digitalReceived: digitalTotal,
        bankTransfer: bankTransferTotal,
        easypaisa: easypaisaTotal,
        jazzcash: jazzCashTotal,
        totalReceived,
        totalRefunds,
        netCollection,
        totalTransactions: payments.length,
      },
      payments,
      refunds,
    });
  } catch (error) {
    console.error("Collection Report Error:", error);
    return NextResponse.json(
      { success: false, error: "Collection report generate karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
