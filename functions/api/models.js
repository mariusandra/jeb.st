// GET /api/models   every model with submitted rides or runs, with counts (feeds the filters)
import { db, json, preflight, handleErrors } from "./_lib.js";

export const onRequestOptions = preflight;
export const onRequestGet = handleErrors(async ({ env }) => {
  const DB = db(env);
  const [rides, runs] = await DB.batch([
    DB.prepare("SELECT model, COUNT(*) AS rides, MAX(submitted_at) AS last FROM rides GROUP BY model"),
    DB.prepare("SELECT model, COUNT(*) AS runs FROM runs GROUP BY model"),
  ]);
  const out = {};
  for (const r of rides.results) out[r.model] = { model: r.model, rides: r.rides, runs: 0, last: r.last };
  for (const r of runs.results) (out[r.model] = out[r.model] || { model: r.model, rides: 0, runs: 0 }).runs = r.runs;
  return json({ models: Object.values(out).sort((a, b) => b.rides + b.runs - (a.rides + a.runs)) }, 200, { "cache-control": "public, max-age=60" });
});
