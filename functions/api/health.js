// GET /api/health   {ok, submissions: true|false}
import { json, preflight } from "./_lib.js";

export const onRequestOptions = preflight;
export const onRequestGet = async ({ env }) => {
  if (!env.DB) return json({ ok: true, submissions: false, detail: "no D1 binding on this deployment" });
  try { await env.DB.prepare("SELECT 1 FROM rides LIMIT 1").all(); return json({ ok: true, submissions: true }); }
  catch (e) { return json({ ok: true, submissions: false, detail: `database not ready: ${e.message}`.slice(0, 200) }); }
};
