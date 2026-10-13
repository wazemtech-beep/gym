import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { timingSafeEqual } from "node:crypto";
import { runScheduledWork } from "@/lib/scheduledWork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function validCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  const actual = Buffer.from(req.headers.get("authorization") || "");
  return !!secret && actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function postHandler(req: NextRequest) {
  try {
    const isCron = validCron(req);
    // GET mutates scheduled state and requires the cron secret, never a cookie.
    const current = !isCron && req.method === "POST" ? await getCurrentSession() : null;
    const isOwner = current?.user.role === "OWNER" && !current.user.mustChangePassword;
    if (!isCron && !isOwner) {
      return NextResponse.json({ success: false, error: "Unauthorized access to scheduler." }, { status: 403 });
    }

    const result = await runScheduledWork();

    return NextResponse.json({
      ...result,
      message: result.skipped ? "A scheduled run is already active." : "System background processing batch mukammal ho gaya.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("SCHEDULER_ROUTE_ERROR:", error instanceof Error ? error.message : "Unknown failure");
    return NextResponse.json({ success: false, error: "Scheduler chalane mein masla aya." }, { status: 500 });
  }
}

export const GET = postHandler;
export const POST = postHandler;
