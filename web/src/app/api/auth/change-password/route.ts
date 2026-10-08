import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { changeUserPassword } from "@/lib/auth";
import { loginForRole } from "@/lib/portalRoutes";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json(
        { success: false, error: "Pehle login karein." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (typeof newPassword !== "string" || newPassword.length < 8 || Buffer.byteLength(newPassword) > 72 || (currentPassword !== undefined && typeof currentPassword !== "string")) {
      return NextResponse.json(
        {
          success: false,
          error: "Naya password kam az kam 8 characters ka hona zaroori hai.",
        },
        { status: 400 }
      );
    }

    // If mustChangePassword is true, user doesn't need to provide current temporary password
    const result = await changeUserPassword(
      current.user.id,
      newPassword,
      currentPassword,
      current.user.mustChangePassword
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      redirectUrl: loginForRole(current.user.role),
      message:
        "Password kamiyabi se tabdeel ho gaya hai. Barah-e-karam naye password ke sath login karein.",
    });
  } catch (error) {
    console.error("Change Password API Error:", error);
    return NextResponse.json(
      { success: false, error: "Password tabdeeli mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
