import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { destroySession, revokeAllUserSessions, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    const body = await req.json().catch(() => ({}));
    const { allDevices, deviceToken } = body;
    const headerDeviceToken = req.headers.get("x-device-token");
    const activeDeviceToken = deviceToken || headerDeviceToken;

    const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;
    const token = bearerToken || cookieToken;

    if (allDevices && current?.user?.id) {
      await revokeAllUserSessions(current.user.id);
      // Invalidate all registered mobile push tokens for this user
      await prisma.devicePushToken.deleteMany({
        where: { userId: current.user.id },
      });
    } else if (token) {
      await destroySession(token);
      // Unlink the specific mobile device token if supplied
      if (activeDeviceToken && current?.user?.id) {
        await prisma.devicePushToken.deleteMany({
          where: {
            userId: current.user.id,
            token: activeDeviceToken,
          },
        });
      }
    }

    const response = NextResponse.json({
      success: true,
      message: allDevices
        ? "Tamam devices se logout kar diya gaya hai."
        : "Logout kamiyab!",
    });

    // Clear session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout API Error:", error);
    return NextResponse.json(
      { success: false, error: "Logout mein masla pesh aaya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
