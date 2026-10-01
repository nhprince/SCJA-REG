// Signed, stateless session cookie helper.
// A session token is: "<expiryTimestamp>.<base64url HMAC-SHA256 signature>"
// Verifying only needs SESSION_SECRET — no server-side session store required.

const encoder = new TextEncoder();
const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function toBase64Url(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toBase64Url(sig);
}

export async function createSessionToken(secret) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const signature = await sign(secret, String(expiry));
  return `${expiry}.${signature}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || typeof token !== "string") return false;
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const expiryStr = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expected = await sign(secret, expiryStr);
  if (expected.length !== signature.length) return false;

  // constant-time-ish compare
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookieHeader(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function requireAuth(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = getCookie(request, SESSION_COOKIE);
  return verifySessionToken(token, env.SESSION_SECRET);
}

export function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function unauthorized() {
  return jsonResponse({ error: "Unauthorized" }, { status: 401 });
}
