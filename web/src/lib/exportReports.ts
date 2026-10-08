import { getCurrentSession } from "@/lib/session";
import { auditReportExport, csvCell } from "@/lib/reportAudit";
import { NextRequest, NextResponse } from "next/server";
import { GET as collection } from "@/app/api/v1/reports/collection/route";
import { GET as dues } from "@/app/api/v1/reports/dues/route";
import { GET as details } from "@/app/api/v1/reports/details/route";
import { generateXlsx } from "@/lib/xlsxGenerator";
import { generateReportPdf } from "@/lib/reportPdf";

export async function exportOperationalReport(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "collection";
  const format = url.searchParams.get("format") || "csv";
  if (!["csv", "xlsx", "pdf"].includes(format)) return NextResponse.json({ success: false, error: "Invalid export format." }, { status: 400 });
  url.searchParams.set("format", format);
  const request = new NextRequest(url, { headers: req.headers });
  if (type === "collection") return collection(request);
  if (type === "dues") return dues(request);
  const response = await details(request);
  if (!response.ok) return response;
  const data = await response.json();
  const headers: string[] = data.headers, rows: Array<Array<string | number>> = data.rows;
  let output: string | Uint8Array, contentType: string;
  if (format === "xlsx") { output = generateXlsx(type, headers, rows); contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; }
  else if (format === "pdf") { output = generateReportPdf(`${type} report`, headers, rows); contentType = "application/pdf"; }
  else { output = "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n"); contentType = "text/csv; charset=utf-8"; }
  await auditReportExport(current.user, type, format);
  return new NextResponse(typeof output === "string" ? output : new Uint8Array(output), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="gym-${type}.${format}"`, "Cache-Control": "private, no-store" } });
}
