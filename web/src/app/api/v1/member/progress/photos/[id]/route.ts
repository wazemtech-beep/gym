import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { deleteFromCloudinary } from "@/lib/cloudinary";

async function deleteHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;
    const photo = await prisma.progressPhoto.findUnique({
      where: { id },
      include: { gymMember: true },
    });

    if (!photo) {
      return NextResponse.json({ success: false, error: "Photo nahi mili." }, { status: 404 });
    }

    if (current.user.role === Role.MEMBER) {
      if (photo.gymMember.userId !== current.user.id) {
        return NextResponse.json({ success: false, error: "Aap sirf apni progress photos delete kar sakte hain." }, { status: 403 });
      }
    } else if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Sirf Member ya Gym Owner ko progress photos delete karne ka ikhtiyar hai." },
        { status: 403 }
      );
    }

    if (photo.storageKey && !await deleteFromCloudinary(photo.storageKey, "authenticated")) return NextResponse.json({ success: false, error: "Photo storage deletion failed. Try again." }, { status: 503 });
    await prisma.progressPhoto.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Photo kamyabi se delete ho gayi.",
    });
  } catch (error: any) {
    console.error("DELETE_PROGRESS_PHOTO_ERROR:", error);
    return NextResponse.json({ success: false, error: "Photo delete karne mein masla aya." }, { status: 500 });
  }
}

async function patchHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { id } = await params;
    const photo = await prisma.progressPhoto.findUnique({
      where: { id },
      include: { gymMember: true },
    });

    if (!photo) {
      return NextResponse.json({ success: false, error: "Photo nahi mili." }, { status: 404 });
    }

    if (current.user.role === Role.MEMBER) {
      if (photo.gymMember.userId !== current.user.id) {
        return NextResponse.json({ success: false, error: "Aap sirf apni progress photos ko edit kar sakte hain." }, { status: 403 });
      }
    } else if (current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }

    const body = await req.json();
    const { shareWithTrainer } = body;
    if (typeof shareWithTrainer !== "boolean") return NextResponse.json({ success: false, error: "Choose whether to share this photo." }, { status: 400 });

    const updated = await prisma.progressPhoto.update({
      where: { id },
      data: {
        shareWithTrainer: !!shareWithTrainer,
      },
    });

    return NextResponse.json({
      success: true,
      message: updated.shareWithTrainer
        ? "Photo sharing trainer ke sath allow ho gayi."
        : "Photo sharing trainer se revoke kar di gayi.",
      data: updated,
    });
  } catch (error: any) {
    console.error("PATCH_PROGRESS_PHOTO_ERROR:", error);
    return NextResponse.json({ success: false, error: "Sharing update karne mein masla aya." }, { status: 500 });
  }
}

export const DELETE = withReadCache(deleteHandler);
export const PATCH = withReadCache(patchHandler);
