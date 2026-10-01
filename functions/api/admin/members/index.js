import { requireAuth, jsonResponse, unauthorized } from "../../../_utils/auth.js";

const SORTABLE_COLUMNS = new Set([
  "created_at",
  "full_name",
  "student_id",
  "department",
  "year",
  "session",
]);

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const department = (url.searchParams.get("department") || "").trim();
  const sortParam = url.searchParams.get("sort") || "created_at";
  const orderParam = (url.searchParams.get("order") || "desc").toLowerCase();

  const sortCol = SORTABLE_COLUMNS.has(sortParam) ? sortParam : "created_at";
  const order = orderParam === "asc" ? "ASC" : "DESC";

  let query = `
    SELECT id, full_name, student_id, department, year, session, email, phone,
           blood_group, interests, created_at, confirmation_status, confirmed_at,
           (profile_photo IS NOT NULL) AS has_profile_photo,
           (id_document_photo IS NOT NULL) AS has_id_document_photo
    FROM members
    WHERE 1 = 1
  `;
  const params = [];

  if (search) {
    query += ` AND (full_name LIKE ? OR student_id LIKE ? OR email LIKE ? OR phone LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  if (department) {
    query += ` AND department = ?`;
    params.push(department);
  }

  query += ` ORDER BY ${sortCol} ${order}`;

  try {
    const { results } = await env.DB.prepare(query).bind(...params).all();
    const members = results.map((m) => ({
      ...m,
      interests: safeParseInterests(m.interests),
    }));
    return jsonResponse({ members });
  } catch (err) {
    return jsonResponse({ error: "Failed to load members." }, { status: 500 });
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
