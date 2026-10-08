import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/db";
import { privateAssetToken } from "@/lib/privateAssets";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderType = (formData.get("folder") as string) || "general";
    if ((folderType === "expenses" || folderType === "branding") && current.user.role !== "OWNER") return NextResponse.json({ success: false, error: "Owner access required." }, { status: 403 });
    if (folderType === "progress" && !["MEMBER", "OWNER"].includes(current.user.role)) return NextResponse.json({ success: false, error: "Only member or owner can upload progress photos." }, { status: 403 });

    if (!file) {
      return NextResponse.json({ success: false, error: "File upload karna lazmi hai." }, { status: 400 });
    }

    // Validate size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "File ka size 10MB se zyada nahi ho sakta." }, { status: 400 });
    }

    // Allowed folder categories
    const allowedFolders: Record<string, string> = {
      members: "oxgen-gym/members",
      progress: "oxgen-gym/progress-photos",
      expenses: "oxgen-gym/expenses",
      transfers: "oxgen-gym/transfer-proofs",
      branding: "oxgen-gym/branding",
      general: "oxgen-gym/general",
    };

    if (!allowedFolders[folderType]) return NextResponse.json({ success: false, error: "Invalid upload category." }, { status: 400 });
    const privateUpload = ["progress", "expenses", "transfers"].includes(folderType);
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return NextResponse.json({ success: false, error: "Only images and PDF files are supported." }, { status: 400 });
    if (folderType === "progress" && !file.type.startsWith("image/")) return NextResponse.json({ success: false, error: "Progress photos must be images." }, { status: 400 });
    const targetFolder = `${allowedFolders[folderType]}/${current.user.id}`;

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadToCloudinary(buffer, {
      folder: targetFolder,
      resourceType: file.type.startsWith("image/") ? "image" : "raw",
      deliveryType: privateUpload ? "authenticated" : "upload",
    });

    return NextResponse.json({
      success: true,
      message: "File Cloudinary par kamiyabi se upload ho gayi.",
      data: {
        url: privateUpload ? `/api/v1/uploads/cloudinary/asset?token=${privateAssetToken({ publicId: uploadResult.publicId, ownerId: current.user.id, format: uploadResult.format || (file.type === "application/pdf" ? "pdf" : "jpg"), resourceType: file.type.startsWith("image/") ? "image" : "raw", category: folderType as "progress" | "expenses" | "transfers" })}` : uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
      },
    });
  } catch (error: any) {
    console.error("UPLOAD_API_ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message || "File upload karne mein masla aya." },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { publicId } = body;
    if (typeof publicId !== "string" || !publicId.startsWith("oxgen-gym/")) return NextResponse.json({ success: false, error: "Invalid asset." }, { status: 400 });
    let deliveryType: "upload" | "authenticated" = "upload";

    if (!publicId) {
      return NextResponse.json({ success: false, error: "Public ID lazmi hai." }, { status: 400 });
    }

    // Role-based asset ownership check
    if (current.user.role === "MEMBER") {
      const myMember = await prisma.gymMember.findFirst({
        where: { userId: current.user.id },
        include: { progressPhotos: true },
      });
      if (!myMember) {
        return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
      }
      const ownsPhoto = myMember.progressPhotos.some((p: any) => p.storageKey === publicId);
      if (ownsPhoto) deliveryType = "authenticated";
      const ownsAvatar = myMember.photoUrl?.includes(publicId);
      if (!ownsPhoto && !ownsAvatar) {
        return NextResponse.json(
          { success: false, error: "Aap sirf apni progress ya profile photos delete kar sakte hain." },
          { status: 403 }
        );
      }
    } else if (current.user.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: "Trainers ko assets delete karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    if (current.user.role === "OWNER" && /\/(progress-photos|expenses|transfer-proofs)\//.test(publicId)) deliveryType = "authenticated";
    const deleted = await deleteFromCloudinary(publicId, deliveryType);

    return NextResponse.json({
      success: deleted,
      message: deleted ? "Asset Cloudinary se delete ho gaya." : "Asset delete nahi ho saka.",
    });
  } catch (error: any) {
    console.error("DELETE_ASSET_ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Asset delete karne mein masla aya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
export const DELETE = withReadCache(deleteHandler);
