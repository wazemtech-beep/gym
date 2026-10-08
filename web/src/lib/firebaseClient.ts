// Client-side Firebase Configuration loaded strictly from environment variables
export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Register a client device token to the OXGEN GYM backend
 */
export async function registerDeviceTokenOnBackend(token: string, deviceModel?: string) {
  try {
    const res = await fetch("/api/v1/member/devices/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: "web",
        deviceModel: deviceModel || (typeof navigator !== "undefined" ? navigator.userAgent : "web-browser"),
      }),
    });
    return await res.json();
  } catch (error) {
    console.error("REGISTER_DEVICE_TOKEN_FAILED:", error);
    return { success: false, error: "Network error registering token" };
  }
}
