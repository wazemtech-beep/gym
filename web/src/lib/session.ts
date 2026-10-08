import { cookies, headers } from "next/headers";
import { SESSION_COOKIE_NAME, validateSession } from "./auth";
import { sessionContext } from "./sessionContext";
import { cache } from "react";

/**
 * Get current logged-in user session from HttpOnly Cookie (Web) or Bearer Token (Flutter Mobile App)
 */
async function readCurrentSession() {
  const context = sessionContext.getStore();
  if (context) return context.current;
  const [cookieStore, headersList] = await Promise.all([cookies(), headers()]);
  const authHeader = headersList.get("authorization");
  // An explicitly supplied API credential must not fall back to a different cookie account.
  const bearer = authHeader?.match(/^Bearer ([a-zA-Z0-9_-]{20,256})$/i);
  if (authHeader !== null && !bearer) return null;
  const token = bearer ? bearer[1] : cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return validateSession(token);
}

// Deduplicate authentication within one server render, never across requests.
export const getCurrentSession = cache(readCurrentSession);
