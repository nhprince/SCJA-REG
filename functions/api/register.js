import { jsonResponse } from "../_utils/auth.js";

const REQUIRED_FIELDS = [
  "full_name",
  "student_id",
  "department",
  "year",
  "session",
  "email",
  "phone",
];

// Rough cap so a single row can't balloon D1 storage. Images are compressed
// client-side before upload, so legitimate submissions stay well under this.
const MAX_IMAGE_BASE64_LENGTH = 1_500_000; // ~1.1MB decoded

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: a hidden field real users never fill in. If it's populated,
  // pretend success so bots don't learn anything, but skip the insert.
  if (body.website_url) {
    return jsonResponse({ success: true });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || String(body[field]).trim() === "") {
      return jsonResponse({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  if (!isValidEmail(body.email)) {
    return jsonResponse({ error: "Please provide a valid email address." }, { status: 400 });
  }

  for (const key of ["profile_photo", "id_document_photo"]) {
    if (body[key] && String(body[key]).length > MAX_IMAGE_BASE64_LENGTH) {
      return jsonResponse({ error: "One of the uploaded images is too large. Please use a smaller photo." }, { status: 400 });
    }
  }

  const interests = Array.isArray(body.interests) ? JSON.stringify(body.interests) : "[]";

  try {
    await env.DB.prepare(
      `INSERT INTO members (
        full_name, date_of_birth, blood_group, profile_photo,
        student_id, department, year, session,
        email, phone, present_address, permanent_address,
        guardian_name, guardian_phone,
        reason_to_join, previous_experience, interests, social_link, id_document_photo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.full_name.trim(),
        body.date_of_birth || null,
        body.blood_group || null,
        body.profile_photo || null,
        body.student_id.trim(),
        body.department.trim(),
        body.year.trim(),
        body.session.trim(),
        body.email.trim().toLowerCase(),
        body.phone.trim(),
        body.present_address || null,
        body.permanent_address || null,
        body.guardian_name || null,
        body.guardian_phone || null,
        body.reason_to_join || null,
        body.previous_experience || null,
        interests,
        body.social_link || null,
        body.id_document_photo || null
      )
      .run();

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "Could not save registration. Please try again." }, { status: 500 });
  }
}

export async function onRequestGet() {
  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
}
