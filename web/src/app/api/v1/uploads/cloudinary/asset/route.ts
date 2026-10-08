import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ensureCloudinaryConfig } from "@/lib/cloudinary";
import { readPrivateAssetToken } from "@/lib/privateAssets";
import { hasUserPermission } from "@/lib/permissions";
import { effectiveTrainerAssignment } from "@/lib/trainerAccess";

async function getHandler(req: NextRequest) {
  const current = await getCurrentSession();
  if (!current) return new NextResponse(null, { status: 401 });
  const token = req.nextUrl.searchParams.get("token") || "";
  const asset = readPrivateAssetToken(token);
  if (!asset) return new NextResponse(null, { status: 404 });
  let allowed = current.user.id === asset.ownerId || current.user.role === "OWNER";
  if (current.user.role === "MEMBER" && asset.category === "progress") allowed = allowed || Boolean(await prisma.progressPhoto.findFirst({ where: { storageKey: asset.publicId, gymMember: { userId: current.user.id } } }));
  if (current.user.role === "RECEPTIONIST" && asset.category === "transfers" && hasUserPermission(current.user, "PAYMENT_RECORD_VERIFY")) allowed = Boolean(await prisma.transferSubmission.findFirst({ where: { proofImageUrl: { contains: token } } }));
  if (current.user.role === "TRAINER" && asset.category === "progress") {
    const photo = await prisma.progressPhoto.findFirst({ where: { storageKey: asset.publicId, shareWithTrainer: true } });
    allowed = Boolean(photo && await prisma.trainerAssignment.findFirst({ where: { gymMemberId: photo.gymMemberId, trainerId: current.user.id, consentMeasurements: true, ...effectiveTrainerAssignment() } }));
  }
  if (!allowed) return new NextResponse(null, { status: 403 });
  const url = ensureCloudinaryConfig().utils.private_download_url(asset.publicId, asset.format, { resource_type: asset.resourceType, type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 60, attachment: false });
  return new NextResponse(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export const GET = withReadCache(getHandler);
