import { clearSessionCookieHeader, jsonResponse } from "../../_utils/auth.js";

export async function onRequestPost() {
  return jsonResponse({ success: true }, { headers: { "Set-Cookie": clearSessionCookieHeader() } });
}
