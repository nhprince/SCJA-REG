import { createSessionToken, sessionCookieHeader, jsonResponse } from "../../_utils/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return jsonResponse(
      { error: "Admin login isn't configured yet. Set ADMIN_PASSWORD and SESSION_SECRET." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password !== env.ADMIN_PASSWORD) {
    // Small delay to slow down brute-force attempts.
    await new Promise((r) => setTimeout(r, 400));
    return jsonResponse({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createSessionToken(env.SESSION_SECRET);
  return jsonResponse({ success: true }, { headers: { "Set-Cookie": sessionCookieHeader(token) } });
}
