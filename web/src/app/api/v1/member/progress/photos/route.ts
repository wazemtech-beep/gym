import { withReadCache } from "@/lib/serverReadCache";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { readPrivateAssetToken } from "@/lib/privateAssets";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { Role, PhotoViewType } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    let gymMemberId: string | null = null;
    let trainerFilterOnlyShared = false;

    if (current.user.role === Role.MEMBER) {
      const member = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!member) {
        return NextResponse.json({ success: false, error: "Member profile nahi mili." }, { status: 404 });
      }
      gymMemberId = member.id;
    } else if (current.user.role === Role.TRAINER) {
      // Record-level permission check: Trainer must be currently assigned to this member
      const searchParams = req.nextUrl.searchParams;
      gymMemberId = searchParams.get("memberId");

      if (!gymMemberId) {
        return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
      }

      const activeAssignment = await prisma.trainerAssignment.findFirst({
        where: {
          gymMemberId,
          trainerId: current.user.id,
          ...effectiveTrainerAssignment(),
          consentMeasurements: true,
        },
      });

      if (!activeAssignment) {
        return NextResponse.json(
          {
            success: false,
            error: "Aap is member ke assigned trainer nahi hain. Private progress photos dekhne ki ijazat nahi hai.",
          },
          { status: 403 }
        );
      }

      // Trainer can only see photos that the member has explicitly permitted to share
      trainerFilterOnlyShared = true;
    } else if (current.user.role === Role.OWNER) {
      const searchParams = req.nextUrl.searchParams;
      gymMemberId = searchParams.get("memberId");
      if (!gymMemberId) {
        return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
      }
    } else {
      // RECEPTIONIST or other unapproved roles cannot view intimate progress photos
      return NextResponse.json(
        {
          success: false,
          error: "Is role ko private progress photos dekhne ki ijazat nahi hai.",
        },
        { status: 403 }
      );
    }

    const whereClause: any = { gymMemberId };
    if (trainerFilterOnlyShared) {
      whereClause.shareWithTrainer = true;
    }

    const photos = await prisma.progressPhoto.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ success: true, data: photos });
  } catch (error: any) {
    console.error("GET_PROGRESS_PHOTOS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Photos load nahi huin." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Only Member themselves (or Owner managing profile) can upload photos
    if (current.user.role === Role.TRAINER || current.user.role === Role.RECEPTIONIST) {
      return NextResponse.json(
        { success: false, error: "Progress photos sirf member khud upload kar sakta hai." },
        { status: 403 }
      );
    }

    let gymMemberId: string | null = null;
    if (current.user.role === Role.MEMBER) {
      const member = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!member) {
        return NextResponse.json({ success: false, error: "Member profile nahi mili." }, { status: 404 });
      }
      gymMemberId = member.id;
    } else if (current.user.role === Role.OWNER) {
      const bodyPreview = await req.clone().json().catch(() => ({}));
      gymMemberId = bodyPreview.memberId || null;
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member identify nahi ho saka." }, { status: 400 });
    }

    const body = await req.json();
    const {
      photoUrl,
      viewType = "FRONT",
      date,
      notes,
      shareWithTrainer = false,
    } = body;

    if (!photoUrl || !photoUrl.trim()) {
      return NextResponse.json({ success: false, error: "Photo URL faraham karein." }, { status: 400 });
    }

    const asset = readPrivateAssetToken(new URL(photoUrl, req.url).searchParams.get("token") || "");
    if (!asset || asset.category !== "progress" || asset.ownerId !== current.user.id) return NextResponse.json({ success: false, error: "Upload a private progress photo using the upload button." }, { status: 400 });
    const createdPhoto = await prisma.progressPhoto.create({
      data: {
        gymMemberId,
        photoUrl: photoUrl.trim(),
        storageKey: readPrivateAssetToken(new URL(photoUrl, req.url).searchParams.get("token") || "")?.publicId || null,
        viewType: (viewType as PhotoViewType) || PhotoViewType.FRONT,
        date: date ? new Date(date) : new Date(),
        notes: notes?.trim() || null,
        shareWithTrainer: !!shareWithTrainer,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Progress photo mehfooz ho gayi.",
      data: createdPhoto,
    });
  } catch (error: any) {
    console.error("ADD_PROGRESS_PHOTO_ERROR:", error);
    return NextResponse.json({ success: false, error: "Photo save karne mein masla aya." }, { status: 500 });
  }
}

async function deleteHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const photoId = searchParams.get("photoId");

    if (!photoId) {
      return NextResponse.json({ success: false, error: "Photo ID darkaar hai." }, { status: 400 });
    }

    const photo = await prisma.progressPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return NextResponse.json({ success: false, error: "Photo nahi mili." }, { status: 404 });
    }

    if (current.user.role === Role.MEMBER) {
      const member = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!member || member.id !== photo.gymMemberId) {
        return NextResponse.json({ success: false, error: "Aap sirf apni photo delete kar sakte hain." }, { status: 403 });
      }
    } else if (current.user.role !== Role.OWNER) {
      return NextResponse.json({ success: false, error: "Photo delete karne ki ijazat nahi hai." }, { status: 403 });
    }

    if (photo.storageKey && !await deleteFromCloudinary(photo.storageKey, "authenticated")) return NextResponse.json({ success: false, error: "Storage deletion failed. Photo remains available for retry." }, { status: 503 });
    await prisma.progressPhoto.delete({
      where: { id: photoId },
    });

    return NextResponse.json({
      success: true,
      message: "Progress photo delete kar di gayi hai.",
    });
  } catch (error: any) {
    console.error("DELETE_PROGRESS_PHOTO_ERROR:", error);
    return NextResponse.json({ success: false, error: "Photo delete karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
export const DELETE = withReadCache(deleteHandler);
