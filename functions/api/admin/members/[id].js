import { requireAuth, jsonResponse, unauthorized } from "../../../_utils/auth.js";

// Rough cap so an edited photo can't balloon D1 storage — mirrors the same
// guard applied to new registrations in functions/api/register.js.
const MAX_IMAGE_BASE64_LENGTH = 1_500_000; // ~1.1MB decoded
const IMAGE_FIELDS = new Set(["profile_photo", "id_document_photo"]);

const EDITABLE_FIELDS = [
  "full_name",
  "date_of_birth",
  "blood_group",
  "student_id",
  "department",
  "year",
  "session",
  "email",
  "phone",
  "present_address",
  "permanent_address",
  "guardian_name",
  "guardian_phone",
  "reason_to_join",
  "previous_experience",
  "social_link",
  "profile_photo",
  "id_document_photo",
];

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "Invalid id." }, { status: 400 });

  const member = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`).bind(id).first();
  if (!member) return jsonResponse({ error: "Member not found." }, { status: 404 });

  member.interests = safeParseInterests(member.interests);
  return jsonResponse({ member });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "Invalid id." }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, { status: 400 });
  }

  for (const field of IMAGE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field]) {
      if (String(body[field]).length > MAX_IMAGE_BASE64_LENGTH) {
        return jsonResponse({ error: "That image is too large. Please use a smaller photo." }, { status: 400 });
      }
    }
  }

  const setClauses = [];
  const values = [];

  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      setClauses.push(`${field} = ?`);
      values.push(body[field] === "" ? null : body[field]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "interests")) {
    setClauses.push(`interests = ?`);
    values.push(Array.isArray(body.interests) ? JSON.stringify(body.interests) : "[]");
  }

  if (setClauses.length === 0) {
    return jsonResponse({ error: "No fields to update." }, { status: 400 });
  }

  values.push(id);

  try {
    await env.DB.prepare(`UPDATE members SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "Failed to update member." }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "Invalid id." }, { status: 400 });

  try {
    await env.DB.prepare(`DELETE FROM members WHERE id = ?`).bind(id).run();
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "Failed to delete member." }, { status: 500 });
  }
}

function safeParseInterests(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
