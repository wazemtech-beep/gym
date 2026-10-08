import { initializeApp, cert, applicationDefault, getApps, App } from "firebase-admin/app";
import { getMessaging, MulticastMessage, SendResponse } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";

let isInitialized = false;

function initFirebaseAdmin(): App | null {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    let credential = null;

    if (serviceAccountPath) {
      const resolvedPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(/* turbopackIgnore: true */ process.cwd(), serviceAccountPath);

      // Credentials are supplied at runtime, never bundled into the server output.
      if (fs.existsSync(/* turbopackIgnore: true */ resolvedPath)) {
        const fileContent = fs.readFileSync(/* turbopackIgnore: true */ resolvedPath, "utf-8");
        const serviceAccount = JSON.parse(fileContent);
        credential = cert(serviceAccount);
      } else {
        console.warn("FIREBASE_SERVICE_ACCOUNT_NOT_FOUND:", resolvedPath);
      }
    }

    if (!credential) {
      credential = applicationDefault();
    }

    const app = initializeApp({
      credential,
      projectId,
    });

    isInitialized = true;
    return app;
  } catch (error: any) {
    console.error("FIREBASE_ADMIN_INIT_ERROR:", error.message);
    return null;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushDispatchResult {
  success: boolean;
  totalTokens: number;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  error?: string;
}

/**
 * Dispatch real FCM push notifications to device tokens using Firebase Admin SDK
 */
export async function sendPushNotification(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<PushDispatchResult> {
  const result: PushDispatchResult = {
    success: false,
    totalTokens: tokens.length,
    successCount: 0,
    failureCount: 0,
    invalidTokens: [],
  };

  if (!tokens || tokens.length === 0) {
    result.error = "No device tokens provided";
    return result;
  }

  const app = initFirebaseAdmin();
  if (!app) {
    result.error = "Firebase Admin SDK could not be initialized";
    return result;
  }

  try {
    const messaging = getMessaging(app);

    const message: MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "oxgen_gym_alerts",
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);

    result.successCount = response.successCount;
    result.failureCount = response.failureCount;
    result.success = response.successCount > 0;

    // Detect stale / invalid tokens to auto-prune database
    const tokensToRemove: string[] = [];

    response.responses.forEach((resp: SendResponse, idx: number) => {
      if (!resp.success && resp.error) {
        const errorCode = resp.error.code;
        if (
          errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/invalid-argument"
        ) {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    result.invalidTokens = tokensToRemove;

    // Auto cleanup dead tokens from database
    if (tokensToRemove.length > 0) {
      await prisma.devicePushToken
        .deleteMany({
          where: { token: { in: tokensToRemove } },
        })
        .catch((e: any) => console.error("AUTO_TOKEN_CLEANUP_ERROR:", e));
    }

    return result;
  } catch (error: any) {
    console.error("FCM_SEND_MULTICAST_ERROR:", error);
    result.error = error.message;
    result.failureCount = tokens.length;
    return result;
  }
}
