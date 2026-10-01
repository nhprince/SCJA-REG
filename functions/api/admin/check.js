import { requireAuth, jsonResponse, unauthorized } from "../../_utils/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();
  return jsonResponse({ authenticated: true });
}
