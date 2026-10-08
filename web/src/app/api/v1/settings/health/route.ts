import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";

async function getHandler(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current || current.user.role !== "OWNER") return new NextResponse(null, { status: 403 });
  let database = "Unavailable";
  try { await prisma.$queryRaw`SELECT 1`; database = "Connected"; } catch { /* Availability only; connection secrets are never returned. */ }
  const heartbeat = await prisma.auditLog.findFirst({ where: { action: "BACKGROUND_WORKER_HEARTBEAT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }).catch(() => null);
  return NextResponse.json({ success: true, database, smtp: process.env.SMTP_USER && process.env.SMTP_PASS ? "Configured" : "Not configured", push: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_PROJECT_ID ? "Configured" : "Not configured", worker: heartbeat && Date.now() - heartbeat.createdAt.getTime() < 360000 ? "Recent heartbeat" : "No recent heartbeat", workerLastSeen: heartbeat?.createdAt || null, backups: "Not monitored by this application" }, { headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withReadCache(getHandler);
