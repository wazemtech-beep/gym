import { prisma } from "@/lib/db";
export async function auditReportExport(user: { id: string; name: string; role: any }, type: string, format: string) {
  await prisma.auditLog.create({ data: { actorId: user.id, actorName: user.name, actorRole: user.role, action: "REPORT_EXPORTED", entityType: "REPORT", entityId: type, details: JSON.stringify({ type, format }) } });
}
export function csvCell(value: string | number) {
  const text = String(value);
  const safe = typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
