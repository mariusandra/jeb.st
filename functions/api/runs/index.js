// GET /api/runs?model=&driver=&limit=      submitted scorecards
// POST /api/runs {run, rides: [...], driver, note}   submit a Run all with its rides -> {id, ride_ids}
import { db, json, fail, preflight, handleErrors, rideRow, insertRide, driverName, text, num, newId, now, safeParse, MAX_BODY } from "../_lib.js";

export const onRequestOptions = preflight;

const shape = r => ({ ...r, rows: safeParse(r.rows, []), ride_ids: safeParse(r.ride_ids, []), source: "community" });

export const onRequestGet = handleErrors(async ({ request, env }) => {
  const DB = db(env); const u = new URL(request.url);
  const where = [], binds = [];
  const model = u.searchParams.get("model"); if (model) { where.push("model = ?"); binds.push(model.slice(0, 120)); }
  const driver = u.searchParams.get("driver"); if (driver) { where.push("driver = ?"); binds.push(driver.slice(0, 40)); }
  const limit = Math.min(200, Math.max(1, Number(u.searchParams.get("limit")) || 100));
  const { results } = await DB.prepare(`SELECT * FROM runs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY submitted_at DESC LIMIT ?`).bind(...binds, limit).all();
  return json({ runs: results.map(shape) }, 200, { "cache-control": "public, max-age=30" });
});

export const onRequestPost = handleErrors(async ({ request, env }) => {
  const DB = db(env);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return fail(413, "body too large");
  let body; try { body = await request.json(); } catch { return fail(400, "invalid JSON"); }
  const run = body.run; if (!run || typeof run !== "object" || !Array.isArray(run.rows) || !run.rows.length) return fail(400, "run.rows is required");
  const driver = driverName(body.driver); const id = newId("r");
  const rides = Array.isArray(body.rides) ? body.rides.slice(0, 40) : [];
  const rows = rides.map(ride => rideRow(ride, driver, id));
  const cleanRows = run.rows.slice(0, 40).map(x => ({ app: text(x.app, 60, "app", { required: true }), label: text(x.label, 120, "label"), score: num(x.score, "score") ?? 0, score_label: text(x.score_label, 60, "score_label"),
    games: num(x.games, "games", { int: true, min: 0 }) ?? 1, turns: num(x.turns, "turns", { int: true, min: 0 }) ?? 0, median_ms: num(x.median_ms, "median_ms"), statuses: (Array.isArray(x.statuses) ? x.statuses : []).slice(0, 12).map(s => text(String(s), 120, "status")) }));
  const runRow = { id, client_id: text(run.id, 80, "id"), model: text(run.model, 120, "model", { required: true }), device: text(run.device, 40, "device"), driver, car: text(run.car, 80, "car"),
    rows: JSON.stringify(cleanRows), ride_ids: JSON.stringify(rows.map(r => r.id)), note: text(body.note, 280, "note"), created_at: text(run.created_at, 40, "created_at"), submitted_at: now() };
  const stmts = [DB.prepare("INSERT INTO runs (id, client_id, model, device, driver, car, rows, ride_ids, note, created_at, submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(runRow.id, runRow.client_id, runRow.model, runRow.device, runRow.driver, runRow.car, runRow.rows, runRow.ride_ids, runRow.note, runRow.created_at, runRow.submitted_at)];
  for (const r of rows) stmts.push(insertRide(DB, r));
  await DB.batch(stmts);
  return json({ id, driver, ride_ids: rows.map(r => r.id), url: `/#/runs` }, 201);
});
