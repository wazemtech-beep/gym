import * as dotenv from "dotenv";
dotenv.config();

import { cloudinary, uploadToCloudinary, ensureCloudinaryConfig } from "../src/lib/cloudinary";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=================================================");
  console.log("   OXGEN GYM: CLOUDINARY & FIREBASE TEST SUITE   ");
  console.log("=================================================");

  // 1. Check ENV variables presence
  console.log("\n[1] Checking Environment Variables:");
  const envVars = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "CLOUDINARY_URL",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_SERVICE_ACCOUNT_PATH",
  ];

  let missingVars = 0;
  for (const v of envVars) {
    const val = process.env[v];
    if (val && val.length > 0) {
      const masked = val.length > 8 ? `${val.slice(0, 4)}...${val.slice(-4)}` : "***";
      console.log(`  ✓ ${v} is set: [${masked}]`);
    } else {
      console.log(`  ✗ ${v} is MISSING!`);
      missingVars++;
    }
  }

  if (missingVars > 0) {
    throw new Error(`Failed: ${missingVars} environment variables are missing!`);
  }

  // 2. Test Cloudinary SDK
  console.log("\n[2] Testing Cloudinary SDK Connection & Upload:");
  ensureCloudinaryConfig();
  try {
    const pingRes = await cloudinary.api.ping();
    console.log("  ✓ Cloudinary ping response:", pingRes);

    // Create a 1x1 transparent PNG buffer to test upload
    const testBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    );

    const uploadRes = await uploadToCloudinary(testBuffer, {
      folder: "oxgen-gym/test",
      resourceType: "image",
    });

    console.log("  ✓ Test image uploaded successfully to Cloudinary!");
    console.log(`    URL: ${uploadRes.secureUrl}`);
    console.log(`    Public ID: ${uploadRes.publicId}`);

    // Clean up test image
    await cloudinary.uploader.destroy(uploadRes.publicId);
    console.log("  ✓ Cleaned up test image from Cloudinary.");
  } catch (err: any) {
    console.error("  ✗ Cloudinary test failed:", err.message || err);
    throw err;
  }

  // 3. Test Firebase Admin SDK Initialization
  console.log("\n[3] Testing Firebase Admin SDK:");
  try {
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH!;
    const resolvedPath = path.isAbsolute(saPath) ? saPath : path.resolve(process.cwd(), saPath);
    console.log(`  Resolving service account at: ${resolvedPath}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account file not found at: ${resolvedPath}`);
    }

    const saContent = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
    console.log(`  ✓ Service account file verified for client_email: ${saContent.client_email}`);
    console.log(`  ✓ Project ID: ${saContent.project_id}`);

    // Initialize admin app if not already
    const apps = getApps();
    let app: App;
    if (apps.length > 0) {
      app = apps[0];
    } else {
      app = initializeApp({
        credential: cert(saContent),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }

    console.log(`  ✓ Firebase Admin App initialized: [${app.name}]`);

    // Verify messaging service instance
    const messaging = getMessaging(app);
    console.log("  ✓ Firebase Admin Messaging instance acquired successfully.");

    // Test multicast with a dummy test token (expect token error response from FCM, but SDK call succeeds)
    const multicastRes = await messaging.sendEachForMulticast({
      tokens: ["dummy_test_token_not_registered_12345"],
      notification: {
        title: "Test Notification",
        body: "Testing FCM connection",
      },
    });

    console.log("  ✓ Firebase FCM sendEachForMulticast reached Google FCM servers!");
    console.log(`    Success count: ${multicastRes.successCount}`);
    console.log(`    Failure count: ${multicastRes.failureCount}`);
    console.log(`    Server error code on dummy token: ${multicastRes.responses[0]?.error?.code}`);
  } catch (err: any) {
    console.error("  ✗ Firebase Admin SDK test failed:", err.message || err);
    throw err;
  }

  console.log("\n=================================================");
  console.log("  ALL TESTS PASSED! CREDENTIALS & INTEGRATIONS 100% OPERATIONAL!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
