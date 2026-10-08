import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const body = await req.json();
    const { token, platform = "android", deviceModel } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: "Device token lazmi hai." }, { status: 400 });
    }

    // Upsert token
    const savedToken = await prisma.devicePushToken.upsert({
      where: { token },
      create: {
        userId: current.user.id,
        token,
        platform,
        deviceModel,
        lastUsedAt: new Date(),
      },
      update: {
        userId: current.user.id,
        platform,
        deviceModel,
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Device token register ho gaya.",
      data: savedToken,
    });
  } catch (error: any) {
    console.error("REGISTER_DEVICE_TOKEN_ERROR:", error);
    return NextResponse.json({ success: false, error: "Token save karne mein masla aya." }, { status: 500 });
  }
}

async function deleteHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (token) {
      await prisma.devicePushToken.deleteMany({
        where: {
          userId: current.user.id,
          token,
        },
      });
    } else {
      // Clear all tokens for this user on full logout
      await prisma.devicePushToken.deleteMany({
        where: {
          userId: current.user.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Device token unlink ho gaya.",
    });
  } catch (error: any) {
    console.error("DELETE_DEVICE_TOKEN_ERROR:", error);
    return NextResponse.json({ success: false, error: "Token delete karne mein masla aya." }, { status: 500 });
  }
}

export const POST = withReadCache(postHandler);
export const DELETE = withReadCache(deleteHandler);
