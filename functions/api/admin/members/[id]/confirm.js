import { requireAuth, jsonResponse, unauthorized } from "../../../../_utils/auth.js";
import { sendConfirmationEmail } from "../../../../_utils/email.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "Invalid id." }, { status: 400 });

  const member = await env.DB.prepare(`SELECT id, full_name, email FROM members WHERE id = ?`)
    .bind(id)
    .first();
  if (!member) return jsonResponse({ error: "Member not found." }, { status: 404 });

  try {
    await sendConfirmationEmail(env, { to: member.email, fullName: member.full_name });
  } catch (err) {
    return jsonResponse({ error: err.message }, { status: err.status === 429 ? 429 : 502 });
  }

  try {
    await env.DB.prepare(
      `UPDATE members SET confirmation_status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?`
    )
      .bind(id)
      .run();
  } catch {
    // The email already went out — don't report this as a failure, just a partial one.
    return jsonResponse({
      success: true,
      warning: "Email sent, but the member's status couldn't be updated. Refresh the page to check.",
    });
  }

  return jsonResponse({ success: true, message: `Confirmation email sent to ${member.email}.` });
}
