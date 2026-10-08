import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { verifyPasswordReauth } from "@/lib/auth";
import { Role } from "@prisma/client";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Yeh amal sirf Owner ke liye makhsoos hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password darj karna lazmi hai." },
        { status: 400 }
      );
    }

    const result = await verifyPasswordReauth(
      current.user.id,
      password,
      current.session.token
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Password durust nahi hai." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password verification kamiyab hui.",
    });
  } catch (error) {
    console.error("Settings Reauth Error:", error);
    return NextResponse.json(
      { success: false, error: "Password verify karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
