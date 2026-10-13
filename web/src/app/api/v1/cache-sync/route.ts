import { getCurrentSession } from "@/lib/session";
import { readCacheRevision } from "@/lib/readCacheRevision";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET() {
  try {
    if (!await getCurrentSession()) return Response.json({ success: false, error: "Session expired. Sign in again." }, { status: 401 });
  } catch {
    return Response.json({ success: false, error: "Cache updates temporarily unavailable." }, { status: 503, headers: { "Retry-After": "15", "Cache-Control": "no-store" } });
  }
  const revision = await readCacheRevision();
  return Response.json({ success: true, revision }, { headers: { "Cache-Control": "private, no-store" } });
}
