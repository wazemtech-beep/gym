import { createHmac, timingSafeEqual } from "node:crypto";
import { ensureCloudinaryConfig } from "@/lib/cloudinary";

export type PrivateAsset = { publicId: string; ownerId: string; format: string; resourceType: "image" | "raw"; category: "progress" | "expenses" | "transfers" };
function key() {
  const secret = process.env.ASSET_SIGNING_SECRET || process.env.CLOUDINARY_API_SECRET || ensureCloudinaryConfig().config().api_secret || process.env.AUTH_SECRET;
  if (!secret) throw new Error("Private asset signing is not configured.");
  return secret;
}
export function privateAssetToken(asset: PrivateAsset) {
  const payload = Buffer.from(JSON.stringify(asset)).toString("base64url");
  return `${payload}.${createHmac("sha256", key()).update(payload).digest("base64url")}`;
}
export function readPrivateAssetToken(token: string): PrivateAsset | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", key()).update(payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const asset = JSON.parse(Buffer.from(payload, "base64url").toString()) as PrivateAsset;
    if (!asset.publicId || !asset.ownerId || !["image", "raw"].includes(asset.resourceType) || !["progress", "expenses", "transfers"].includes(asset.category)) return null;
    return asset;
  } catch { return null; }
}
