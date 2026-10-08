import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { Role } from "@prisma/client";
import { dashboardForRole } from "@/lib/portalRoutes";
import { validateLoginInput } from "@/lib/authValidation";

function loginResponse(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}

function getRedirectUrlForRole(role: Role, mustChangePassword: boolean): string {
  if (mustChangePassword) {
    return "/auth/change-password";
  }
  return dashboardForRole(role);
}

async function postHandler(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    const allowedOrigins = [req.nextUrl.origin];
    if (process.env.APP_URL) allowedOrigins.push(new URL(process.env.APP_URL).origin);
    if (origin && !allowedOrigins.includes(origin)) return loginResponse({ success: false, error: "Login request origin allowed nahi hai." }, 403);
    if (Number(req.headers.get("content-length") || 0) > 8192) return loginResponse({ success: false, error: "Login request bohat bari hai." }, 413);
    const text = await req.text();
    if (text.length > 8192) return loginResponse({ success: false, error: "Login request bohat bari hai." }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return loginResponse({ success: false, error: "Login request durust nahi hai." }, 400); }
    const validation = validateLoginInput(body);
    if (!validation.success) return loginResponse({ success: false, error: validation.error }, 400);
    const { identifier, password, portal } = validation.data;

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 128) ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent")?.slice(0, 512) || undefined;

    const result = await authenticateUser(identifier, password, {
      ipAddress,
      userAgent,
      portal,
    });

    if (!result.success) {
      const status = result.code === "LOCKED" ? 429 : result.code === "INVALID_INPUT" ? 400 : ["WRONG_PORTAL", "ACCOUNT_INACTIVE"].includes(result.code) ? 403 : 401;
      return loginResponse({ success: false, error: result.error, code: result.code, locked: result.locked, retryAfterSeconds: result.retryAfterSeconds }, status, result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined);
    }

    const { sessionData } = result;
    const redirectUrl = getRedirectUrlForRole(
      sessionData.user.role,
      sessionData.user.mustChangePassword
    );

    const response = loginResponse({
      success: true,
      message: "Login kamiyab!",
      user: sessionData.user,
      ...(portal === undefined || (portal === "member" && req.headers.get("X-Gym-Client") === "mobile") ? { token: sessionData.sessionToken } : {}),
      redirectUrl,
    });

    // Set secure HttpOnly cookie for Web panels
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionData.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Login API Error:", error);
    return loginResponse({ success: false, error: "Sign in filhal available nahi. Dobara koshish karein." }, 500);
  }
}

export const POST = withReadCache(postHandler);
