import { withReadCache } from "@/lib/serverReadCache";
import { auditReportExport, csvCell } from "@/lib/reportAudit";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, PaymentStatus } from "@prisma/client";
import { generateXlsx } from "@/lib/xlsxGenerator";
import { generateReportPdf } from "@/lib/reportPdf";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Dues report access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const asOfDateParam = searchParams.get("asOfDate"); // Historical "as of" date (YYYY-MM-DD)
    const memberStatus = searchParams.get("memberStatus") || "ALL"; // ALL, CURRENT, ARCHIVED
    const format = searchParams.get("format"); // "csv" or json

    const now = new Date();
    const asOfDate = asOfDateParam ? new Date(`${asOfDateParam}T23:59:59.999+05:00`) : now;

    // Fetch members with invoices issued on or before asOfDate
    const memberWhere: any = {};
    if (memberStatus !== "ALL") {
      memberWhere.status = memberStatus;
    }

    const members = await prisma.gymMember.findMany({
      where: memberWhere,
      include: {
        invoices: {
          where: {
            issueDate: { lte: asOfDate },
          },
          include: {
            lineItems: { where: { createdAt: { gt: asOfDate } } },
            allocations: {
              where: {
                payment: {
                  paymentDate: { lte: asOfDate },
                  OR: [{ status: { not: PaymentStatus.REVERSED } }, { status: PaymentStatus.REVERSED, reversedAt: { gt: asOfDate } }],
                },
              },
              include: {
                payment: {
                  select: {
                    id: true,
                    paymentDate: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { dueDate: "asc" },
        },
        memberships: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { fullName: "asc" },
    });

    const voidAudit = await prisma.auditLog.findMany({ where: { action: "INVOICE_VOIDED", entityType: "INVOICE" }, select: { entityId: true, createdAt: true }, orderBy: { createdAt: "asc" } });
    const voidDates = new Map(voidAudit.map(row => [row.entityId, row.createdAt]));
    const duesData: any[] = [];
    let grandTotalOutstanding = 0;
    let grandTotalOverdue = 0;

    for (const mem of members) {
      const historicalUnpaidInvoices: any[] = [];
      let memberOutstanding = 0;
      let memberOverdue = 0;
      let memberUpcoming = 0;

      for (const inv of mem.invoices) {
        // Reconstruct settled balance strictly on or before asOfDate
        if (inv.status === "VOID" && (!voidDates.get(inv.id) || voidDates.get(inv.id)! <= asOfDate)) continue;
        const totalAsOfDate = inv.totalAmount - inv.lineItems.reduce((sum, item) => sum + item.amount, 0);
        const settledAsOfDate = inv.allocations.reduce((sum, a) => sum + a.amount, 0);
        const historicalBalance = Math.max(0, totalAsOfDate - settledAsOfDate);

        // If historical balance was > 0 as of that date, include it!
        if (historicalBalance > 0) {
          const isOverdue = new Date(inv.dueDate) < asOfDate;
          memberOutstanding += historicalBalance;

          if (isOverdue) {
            memberOverdue += historicalBalance;
          } else {
            memberUpcoming += historicalBalance;
          }

          historicalUnpaidInvoices.push({
            invoiceNumber: inv.invoiceNumber,
            title: inv.title,
            totalAmount: totalAsOfDate,
            paidAsOfDate: settledAsOfDate,
            balanceAmount: historicalBalance,
            dueDate: inv.dueDate,
            isOverdue,
          });
        }
      }

      // If member had outstanding balance as of asOfDate, add to report
      if (historicalUnpaidInvoices.length > 0) {
        grandTotalOutstanding += memberOutstanding;
        grandTotalOverdue += memberOverdue;

        const activeMembership = mem.memberships[0] || null;

        duesData.push({
          id: mem.id,
          memberId: mem.memberId,
          fullName: mem.fullName,
          phone: mem.phone,
          status: mem.status,
          membershipPlan: activeMembership?.planName || "No Plan",
          membershipStatus: activeMembership?.status || "NONE",
          membershipExpiry: activeMembership?.endDate || null,
          totalOutstanding: memberOutstanding,
          overdueDues: memberOverdue,
          upcomingDues: memberUpcoming,
          openingDues: mem.openingDues || 0,
          unpaidInvoicesCount: historicalUnpaidInvoices.length,
          invoices: historicalUnpaidInvoices,
        });
      }
    }

    // Sort by largest outstanding balance first
    duesData.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    if (["csv", "xlsx", "xls", "pdf"].includes(format || "")) await auditReportExport(current.user, "dues", format!);
    // Excel (.xlsx/.xls) Export option
    if (format === "xlsx" || format === "xls" || format === "pdf") {
      const headers = [
        "Member ID",
        "Member Name",
        "Phone",
        "Membership Plan",
        "Status",
        "Total Outstanding (PKR)",
        "Overdue Amount (PKR)",
        "Upcoming Amount (PKR)",
        "Unpaid Invoices Count",
        "As of Date",
      ];

      const dataRows = duesData.map((d) => [
        d.memberId,
        d.fullName,
        d.phone,
        d.membershipPlan,
        d.status,
        d.totalOutstanding,
        d.overdueDues,
        d.upcomingDues,
        d.unpaidInvoicesCount,
        asOfDate.toISOString().slice(0, 10),
      ]);

      const xml = format === "pdf" ? generateReportPdf("Outstanding Dues", headers, dataRows) : generateXlsx("Outstanding Dues", headers, dataRows);
      const filename = `oxgen-dues-report-${asOfDate.toISOString().slice(0, 10)}.${format === "pdf" ? "pdf" : "xlsx"}`;

      return new NextResponse(xml, {
        headers: {
          "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // CSV Export option
    if (format === "csv") {
      const csvHeader = [
        "Member ID",
        "Member Name",
        "Phone",
        "Membership Plan",
        "Status",
        "Total Outstanding (PKR)",
        "Overdue Amount (PKR)",
        "Upcoming Amount (PKR)",
        "Unpaid Invoices Count",
        "As of Date",
      ].join(",");

      const csvRows = duesData.map(d => [d.memberId, d.fullName, d.phone, d.membershipPlan, d.status, d.totalOutstanding, d.overdueDues, d.upcomingDues, d.unpaidInvoicesCount, asOfDate.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })].map(csvCell).join(","));

      const csvContent = [csvHeader, ...csvRows].join("\n");
      const filename = `oxgen-dues-report-${asOfDate.toISOString().slice(0, 10)}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      asOfDate,
      summary: {
        totalOutstandingDues: grandTotalOutstanding,
        totalOverdueDues: grandTotalOverdue,
        membersWithDuesCount: duesData.length,
      },
      duesList: duesData,
    });
  } catch (error) {
    console.error("Dues Report Error:", error);
    return NextResponse.json(
      { success: false, error: "Dues report generate karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
