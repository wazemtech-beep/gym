import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { formatDateTime, formatDate } from "@/lib/formatters";
import { GET as expenses } from "../expenses/route";
import { GET as memberships } from "../memberships/route";

async function getHandler(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  if (current.user.role !== "OWNER") return NextResponse.json({ success: false, error: "Owner access required." }, { status: 403 });
  const params = req.nextUrl.searchParams, type = params.get("type");
  let headers: string[] = [], rows: Array<Array<string | number>> = [];
  if (type === "expenses") {
    const response = await expenses(req); if (!response.ok) return response;
    const data = await response.json();
    headers = ["Expense", "Title", "Payee", "Date", "Recorded (PKR)", "Paid (PKR)", "Payable (PKR)", "Status"];
    rows = data.recordedExpenses.map((item: any) => [item.expenseNumber, item.title, item.payee, formatDate(item.expenseDate), item.totalAmount, item.paidAmount, item.balanceAmount, item.status]);
  } else if (type === "memberships") {
    const response = await memberships(req); if (!response.ok) return response;
    const data = await response.json();
    headers = ["Group", "Member ID", "Member", "Plan", "Start", "End", "Status"];
    rows = [...data.expiringMemberships.map((item: any) => ["Expiring", item.gymMember.memberId, item.gymMember.fullName, item.planName, formatDate(item.startDate), formatDate(item.endDate), item.status]), ...data.renewedMemberships.map((item: any) => ["Renewed", item.gymMember.memberId, item.gymMember.fullName, item.planName, formatDate(item.startDate), formatDate(item.endDate), item.status])];
  } else if (type === "invoices" || type === "attendance") {
    const { start, end } = getDateRangeForPeriod(params.get("dateRange") || "this_month", params.get("startDate") || undefined, params.get("endDate") || undefined);
    if (type === "invoices") {
      const invoices = await prisma.invoice.findMany({ where: { issueDate: { gte: start, lte: end } }, include: { gymMember: { select: { memberId: true, fullName: true } } }, orderBy: { issueDate: "desc" } });
      headers = ["Invoice", "Member ID", "Member", "Issued", "Due", "Total (PKR)", "Paid (PKR)", "Balance (PKR)", "Status"];
      rows = invoices.map(item => [item.invoiceNumber, item.gymMember.memberId, item.gymMember.fullName, formatDate(item.issueDate), formatDate(item.dueDate), item.totalAmount, item.paidAmount, item.balanceAmount, item.status]);
    } else {
      const settings = await prisma.gymSettings.findFirst();
      if (!settings?.attendanceEnabled) return NextResponse.json({ success: false, error: "Attendance is disabled." }, { status: 400 });
      const visits = await prisma.attendanceRecord.findMany({ where: { checkIn: { gte: start, lte: end }, isVoid: false }, include: { gymMember: { select: { memberId: true, fullName: true } } }, orderBy: { checkIn: "desc" } });
      headers = ["Member ID", "Member", "Visit time (Karachi)", "Method"];
      rows = visits.map(item => [item.gymMember.memberId, item.gymMember.fullName, formatDateTime(item.checkIn), item.method]);
    }
  } else return NextResponse.json({ success: false, error: "Invalid report type." }, { status: 400 });
  return NextResponse.json({ success: true, headers, rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withReadCache(getHandler);
