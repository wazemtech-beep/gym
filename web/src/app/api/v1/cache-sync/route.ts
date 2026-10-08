import { getCurrentSession } from "@/lib/session";
import { readCacheRevision } from "@/lib/readCacheRevision";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!await getCurrentSession()) return Response.json({ success: false, error: "Session expired. Sign in again." }, { status: 401 });
  } catch {
    return Response.json({ success: false, error: "Cache updates temporarily unavailable." }, { status: 503, headers: { "Retry-After": "15", "Cache-Control": "no-store" } });
  }
  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false, previous: string | null | undefined;
      const finish = () => { if (closed) return; closed = true; clearInterval(timer); request.signal.removeEventListener("abort",finish); try { controller.close(); } catch {} };
      stop = finish;
      let running = false;
      const tick = async () => {
        if (closed || running) return; running = true;
        try {
          const revision = await readCacheRevision();
          if (closed) return;
          if (revision !== previous) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ revision })}\n\n`)); previous = revision; }
          else controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch { finish(); } finally { running = false; }
      };
      const timer = setInterval(() => { void tick(); },2000);
      request.signal.addEventListener("abort",finish,{once:true});
      if (request.signal.aborted) finish(); else void tick();
      // Renew the stream periodically to recheck session validity and permissions.
      const renewal = setTimeout(finish,60000);
      const original = stop; stop = () => { clearTimeout(renewal); original(); };
    },
    cancel() { stop(); },
  });
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"private, no-store","Connection":"keep-alive","X-Accel-Buffering":"no"}});
}
