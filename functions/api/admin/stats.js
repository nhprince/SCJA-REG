import { requireAuth, jsonResponse, unauthorized } from "../../_utils/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  try {
    const [{ total }] = (
      await env.DB.prepare(`SELECT COUNT(*) AS total FROM members`).all()
    ).results;

    const { results: byDepartment } = await env.DB.prepare(
      `SELECT department, COUNT(*) AS count FROM members GROUP BY department ORDER BY count DESC`
    ).all();

    const { results: bySession } = await env.DB.prepare(
      `SELECT session, COUNT(*) AS count FROM members GROUP BY session ORDER BY session DESC`
    ).all();

    const [{ recent }] = (
      await env.DB.prepare(
        `SELECT COUNT(*) AS recent FROM members WHERE created_at >= datetime('now', '-7 days')`
      ).all()
    ).results;

    const { results: interestRows } = await env.DB.prepare(
      `SELECT interests FROM members`
    ).all();

    const interestCounts = {};
    for (const row of interestRows) {
      try {
        const list = JSON.parse(row.interests || "[]");
        for (const interest of list) {
          interestCounts[interest] = (interestCounts[interest] || 0) + 1;
        }
      } catch {
        // ignore malformed rows
      }
    }

    return jsonResponse({
      total,
      recent,
      departments: byDepartment,
      sessions: bySession,
      interests: interestCounts,
    });
  } catch (err) {
    return jsonResponse({ error: "Failed to load stats." }, { status: 500 });
  }
}
