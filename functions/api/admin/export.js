import { requireAuth, jsonResponse, unauthorized } from "../../_utils/auth.js";

// Real columns pulled from the members table.
const DB_COLUMNS = [
  "id",
  "full_name",
  "student_id",
  "department",
  "year",
  "session",
  "email",
  "phone",
  "date_of_birth",
  "blood_group",
  "present_address",
  "permanent_address",
  "guardian_name",
  "guardian_phone",
  "previous_experience",
  "reason_to_join",
  "interests",
  "social_link",
  "created_at",
  "confirmation_status",
  "confirmed_at",
];

// Final CSV column order — appends the synthetic photo-URL columns (built
// per-row below, not selected from D1 directly) after the real columns.
const CSV_COLUMNS = [...DB_COLUMNS, "profile_photo_url", "id_document_photo_url"];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  try {
    const origin = new URL(request.url).origin;

    const { results } = await env.DB.prepare(
      `SELECT ${DB_COLUMNS.join(", ")},
              (profile_photo IS NOT NULL) AS has_profile_photo,
              (id_document_photo IS NOT NULL) AS has_id_document_photo
       FROM members ORDER BY created_at DESC`
    ).all();

    const lines = [CSV_COLUMNS.join(",")];
    for (const row of results) {
      const values = CSV_COLUMNS.map((col) => {
        if (col === "interests") {
          try {
            return csvEscape(JSON.parse(row.interests || "[]").join("; "));
          } catch {
            return "";
          }
        }
        if (col === "profile_photo_url") {
          return row.has_profile_photo ? csvEscape(`${origin}/api/admin/members/${row.id}/photo?field=profile_photo`) : "";
        }
        if (col === "id_document_photo_url") {
          return row.has_id_document_photo
            ? csvEscape(`${origin}/api/admin/members/${row.id}/photo?field=id_document_photo`)
            : "";
        }
        return csvEscape(row[col]);
      });
      lines.push(values.join(","));
    }

    const csv = lines.join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scja-members-${date}.csv"`,
      },
    });
  } catch (err) {
    return jsonResponse({ error: "Failed to export data." }, { status: 500 });
  }
}
