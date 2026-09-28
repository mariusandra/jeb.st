// GET /api/rides/:id   one submitted ride with its frames
import { db, json, fail, preflight, handleErrors, summarise, safeParse } from "../_lib.js";

export const onRequestOptions = preflight;
export const onRequestGet = handleErrors(async ({ params, env }) => {
  const DB = db(env);
  const row = await DB.prepare("SELECT * FROM rides WHERE id = ?").bind(String(params.id).slice(0, 40)).first();
  if (!row) return fail(404, "no such ride");
  return json({ ...summarise(row), frames: safeParse(row.frames, []) }, 200, { "cache-control": "public, max-age=300" });
});
