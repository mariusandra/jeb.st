// GET /api/runs/:id   one submitted scorecard with the summaries of its rides
import { db, json, fail, preflight, handleErrors, safeParse, summarise } from "../_lib.js";

export const onRequestOptions = preflight;
export const onRequestGet = handleErrors(async ({ params, env }) => {
  const DB = db(env); const id = String(params.id).slice(0, 40);
  const run = await DB.prepare("SELECT * FROM runs WHERE id = ?").bind(id).first();
  if (!run) return fail(404, "no such run");
  const { results } = await DB.prepare("SELECT id, client_id, game, model, device, driver, seed, turns, score, score_label, status, options, overrides, median_ms, max_turns, run_id, note, frame_count, created_at, submitted_at FROM rides WHERE run_id = ? ORDER BY submitted_at").bind(id).all();
  return json({ ...run, rows: safeParse(run.rows, []), ride_ids: safeParse(run.ride_ids, []), rides: results.map(summarise), source: "community" }, 200, { "cache-control": "public, max-age=60" });
});
