import { NextRequest } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "bazaar-admin-dev";
const SESSION_COOKIE = "bazaar_admin_session";

/**
 * Simple session token: hash of password + a fixed salt.
 * Not cryptographically robust but sufficient for a password-gated admin.
 */
function makeSessionToken(password: string): string {
  // Simple hash — in production, use a proper HMAC
  let hash = 0;
  const str = `bazaar-session-${password}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `session_${Math.abs(hash).toString(36)}`;
}

export const EXPECTED_TOKEN = makeSessionToken(ADMIN_PASSWORD);

export function validateAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function getSessionToken(): string {
  return EXPECTED_TOKEN;
}

export function isAdminAuthenticated(request: NextRequest): boolean {
  // Check cookie
  const cookie = request.cookies.get(SESSION_COOKIE);
  if (cookie?.value === EXPECTED_TOKEN) return true;

  // Check Authorization header
  const auth = request.headers.get("Authorization");
  if (auth === `Bearer ${EXPECTED_TOKEN}`) return true;

  return false;
}

export function adminUnauthorizedResponse(): Response {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

export { SESSION_COOKIE };
