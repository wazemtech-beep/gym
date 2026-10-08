import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";

/** Explicit deployment migration; never invoked by the app or background worker. */
async function main() {
  if (!process.argv.includes("--apply")) throw new Error("This migration changes stored assets. Run with --apply only during an authorized deployment.");
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../src/lib/db");
  const { ensureCloudinaryConfig } = await import("../src/lib/cloudinary");
  const { privateAssetToken } = await import("../src/lib/privateAssets");
  const cloudinary = ensureCloudinaryConfig();
  const owner = await prisma.user.findFirst({ where: { role: "OWNER", status: "ACTIVE" }, select: { id: true } });
  if (!owner) throw new Error("An active owner account is required.");
  const photos = await prisma.progressPhoto.findMany({ include: { gymMember: { select: { userId: true } } } });
  const expenses = await prisma.expense.findMany({ where: { attachmentUrl: { not: null } } });
  const proofs = await prisma.transferSubmission.findMany({ where: { proofImageUrl: { not: null } }, include: { gymMember: { select: { userId: true } } } });
  async function migrate(url: string, category: "progress" | "expenses" | "transfers", ownerId: string) {
    if (!url.startsWith("https://res.cloudinary.com/")) return null;
    const match = new URL(url).pathname.match(/^\/([^/]+)\/(image|raw)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match || match[1] !== cloudinary.config().cloud_name) throw new Error("An asset does not belong to the configured Cloudinary account.");
    const resourceType = match[2] as "image" | "raw";
    const original = decodeURIComponent(match[3]);
    const format = original.split(".").at(-1) || "jpg";
    const oldId = resourceType === "image" ? original.replace(/\.[^.]+$/, "") : original;
    const newId = `oxgen-gym/private-migrated/${category}/${createHash("sha256").update(url).digest("hex")}${resourceType === "raw" ? `.${format}` : ""}`;
    // Resume safely if provider migration completed but the database update was interrupted.
    let alreadyMoved = false;
    try { await cloudinary.api.resource(newId, { resource_type: resourceType, type: "authenticated" }); alreadyMoved = true; } catch(error: any) { if (error?.error?.http_code !== 404 && error?.http_code !== 404) throw error; }
    if (!alreadyMoved) await cloudinary.uploader.rename(oldId, newId, { resource_type: resourceType, type: "upload", to_type: "authenticated", invalidate: true, overwrite: false });
    return { url: `/api/v1/uploads/cloudinary/asset?token=${privateAssetToken({ publicId: newId, ownerId, resourceType, category, format })}`, publicId: newId };
  }
  try {
    for (const photo of photos) {
      const asset = await migrate(photo.photoUrl, "progress", photo.gymMember.userId || owner.id);
      if (asset) await prisma.progressPhoto.update({ where: { id: photo.id }, data: { photoUrl: asset.url, storageKey: asset.publicId } });
    }
    for (const expense of expenses) {
      const asset = await migrate(expense.attachmentUrl!, "expenses", owner.id);
      if (asset) await prisma.expense.update({ where: { id: expense.id }, data: { attachmentUrl: asset.url } });
    }
    for (const proof of proofs) {
      const asset = await migrate(proof.proofImageUrl!, "transfers", proof.gymMember.userId || owner.id);
      if (asset) await prisma.transferSubmission.update({ where: { id: proof.id }, data: { proofImageUrl: asset.url } });
    }
    console.info("Private asset migration finished. Previously downloaded or cached copies cannot be recalled.");
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
