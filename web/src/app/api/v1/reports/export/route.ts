import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest } from "next/server";
import { exportOperationalReport } from "@/lib/exportReports";
async function getHandler(req: NextRequest) { return exportOperationalReport(req); }

export const GET = withReadCache(getHandler);
