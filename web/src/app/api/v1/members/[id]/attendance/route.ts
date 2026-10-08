import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest } from "next/server";
import { POST as checkIn } from "@/app/api/v1/attendance/check-in/route";

/** Keep old member-profile clients on the same membership, permission and duplicate-visit policy. */
async function postHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return checkIn(new NextRequest(new URL("/api/v1/attendance/check-in", req.url), { method: "POST", headers: req.headers, body: JSON.stringify({ ...body, memberId: id }) }));
}

export const POST = withReadCache(postHandler);
