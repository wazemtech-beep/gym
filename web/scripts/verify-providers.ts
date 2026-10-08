import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { cert } from "firebase-admin/app";
import { cloudinary, ensureCloudinaryConfig, uploadToCloudinary } from "../src/lib/cloudinary";

async function main() {
  let publicId: string | undefined;
  try {
    ensureCloudinaryConfig();
    if ((await cloudinary.api.ping()).status !== "ok") throw new Error("Cloudinary authentication");
    console.log("PASS Cloudinary authentication");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    const upload = await uploadToCloudinary(png, { folder: "oxgen-gym/verification", publicId: "verify-" + randomBytes(8).toString("hex"), resourceType: "image", deliveryType: "authenticated" });
    publicId = upload.publicId;
    console.log("PASS authenticated test image upload");
    const signed = cloudinary.url(publicId + ".png", { type: "authenticated", secure: true, sign_url: true });
    const response = await fetch(signed, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Signed image retrieval");
    await response.arrayBuffer();
    console.log("PASS signed image retrieval");
    const unsigned = cloudinary.url(publicId + ".png", { type: "authenticated", secure: true });
    const denied = await fetch(unsigned, { signal: AbortSignal.timeout(20000) });
    if (denied.ok) throw new Error("Private image accessible without signature");
    console.log("PASS private image denies unsigned retrieval");
    const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!credentialPath) throw new Error("Firebase service account path not configured");
    const credential = cert(JSON.parse(await readFile(path.resolve(process.cwd(), credentialPath), "utf8")));
    const token = await credential.getAccessToken();
    if (!token.access_token || token.expires_in <= 0) throw new Error("Firebase authentication");
    console.log("PASS Firebase credential authentication (no push sent)");
  } catch (error) { console.log("FAIL provider check: " + (error instanceof Error ? error.name + ": " + error.message : "provider unavailable")); process.exitCode = 1; }
  finally {
    if (publicId) { const deleted = await cloudinary.uploader.destroy(publicId, { type: "authenticated", resource_type: "image", invalidate: true }); if (deleted.result !== "ok") { console.log("FAIL test asset cleanup"); process.exitCode = 1; } else console.log("PASS test asset cleanup"); }
  }
}
void main();
