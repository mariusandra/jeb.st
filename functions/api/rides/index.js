// GET /api/rides?game=&model=&driver=&limit=&offset=   list submitted rides (no frames)
// POST /api/rides {ride, driver, note}                  submit one finished ride -> {id}
import { db, json, fail, preflight, handleErrors, rideRow, insertRide, summarise, driverName, text, MAX_BODY, GAMES } from "../_lib.js";

export const onRequestOptions = preflight;

export const onRequestGet = handleErrors(async ({ request, env }) => {
  const DB = db(env); const u = new URL(request.url);
  const where = [], binds = [];
  const game = u.searchParams.get("game"); if (game) { if (!GAMES.includes(game)) return fail(400, "unknown game"); where.push("game = ?"); binds.push(game); }
  const model = u.searchParams.get("model"); if (model) { where.push("model = ?"); binds.push(model.slice(0, 120)); }
  const driver = u.searchParams.get("driver"); if (driver) { where.push("driver = ?"); binds.push(driver.slice(0, 40)); }
  const run = u.searchParams.get("run"); if (run) { where.push("run_id = ?"); binds.push(run.slice(0, 40)); }
  const limit = Math.min(500, Math.max(1, Number(u.searchParams.get("limit")) || 200)); const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
  const sql = `SELECT id, client_id, game, model, device, driver, seed, turns, score, score_label, status, options, overrides, median_ms, max_turns, run_id, note, frame_count, created_at, submitted_at FROM rides ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY submitted_at DESC LIMIT ? OFFSET ?`;
  const { results } = await DB.prepare(sql).bind(...binds, limit, offset).all();
  return json({ rides: results.map(summarise) }, 200, { "cache-control": "public, max-age=30" });
});

export const onRequestPost = handleErrors(async ({ request, env }) => {
  const DB = db(env);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return fail(413, "body too large");
  let body; try { body = await request.json(); } catch { return fail(400, "invalid JSON"); }
  const driver = driverName(body.driver);
  const row = rideRow(body.ride, driver); row.note = text(body.note, 280, "note") ?? row.note;
  await insertRide(DB, row).run();
  return json({ id: row.id, driver, url: `/#/ride/${row.id}` }, 201);
});
