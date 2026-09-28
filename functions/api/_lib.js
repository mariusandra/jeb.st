// Shared bits for the submissions API: responses, validation, ids.
export const GAMES = ["snake", "connect_four", "tetris", "2048", "flappy", "breakout", "wordle", "twenty_questions"];
export const MAX_BODY = 6 * 1024 * 1024;        // a run with its rides
export const MAX_RIDE = 1_900_000;              // D1 keeps rows under 2 MB; frames above this lose their state text
export const MAX_FRAMES = 2001;

export const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" };
export const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store", ...extra } });
export const fail = (status, detail) => json({ detail }, status);
export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function db(env) {
  if (!env.DB) throw new NoBackend();
  return env.DB;
}
export class NoBackend extends Error { constructor() { super("submissions are not set up on this deployment (no D1 binding)"); } }
export const handleErrors = fn => async ctx => {
  try { return await fn(ctx); }
  catch (e) {
    if (e instanceof NoBackend) return fail(503, e.message);
    if (e instanceof Bad) return fail(400, e.message);
    return fail(500, `${e.name}: ${e.message}`.slice(0, 300));
  }
};
export class Bad extends Error {}

export const newId = prefix => `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
export const now = () => new Date().toISOString();
export const text = (v, max, name, { required = false } = {}) => {
  if (v === undefined || v === null || v === "") { if (required) throw new Bad(`${name} is required`); return null; }
  if (typeof v !== "string") throw new Bad(`${name} must be a string`);
  const s = v.replace(/[\u0000-\u001f]/g, " ").trim(); if (s.length > max) throw new Bad(`${name} is longer than ${max} characters`); return s;
};
export const num = (v, name, { int = false, min = -Infinity, max = Infinity } = {}) => {
  if (v === undefined || v === null) return null; const n = Number(v);
  if (!Number.isFinite(n) || (int && !Number.isInteger(n)) || n < min || n > max) throw new Bad(`${name} is out of range`); return n;
};
export const driverName = v => { const s = text(v, 40, "driver") || "anonymous"; return s.replace(/[^\w .\-@]/g, "").slice(0, 40) || "anonymous"; };

// A ride as the page records it -> the row to store (frames kept whole unless the row would exceed D1's limit).
export function rideRow(ride, driver, runId = null) {
  if (!ride || typeof ride !== "object") throw new Bad("ride must be an object");
  if (!GAMES.includes(ride.game)) throw new Bad(`unknown game ${JSON.stringify(ride.game)}`);
  if (!Array.isArray(ride.frames) || ride.frames.length < 2) throw new Bad("a ride needs at least two frames");
  if (ride.frames.length > MAX_FRAMES) throw new Bad(`more than ${MAX_FRAMES} frames`);
  if (ride.status === "playing") throw new Bad("finish the ride before submitting it");
  let frames = ride.frames;
  let packed = JSON.stringify(frames);
  if (packed.length > MAX_RIDE) { frames = frames.map(f => ({ ...f, state_text: undefined, question: undefined })); packed = JSON.stringify(frames); }
  if (packed.length > MAX_RIDE) throw new Bad("the ride is too large even without its state text");
  const lat = (ride.latencies || []).slice(1); const sorted = [...lat].sort((a, b) => a - b);
  return {
    id: newId("c"), client_id: text(ride.id, 80, "id"), game: ride.game, model: text(ride.model_name || ride.model, 120, "model", { required: true }),
    device: text(ride.device, 40, "device"), driver, seed: num(ride.seed, "seed", { int: true }), turns: num(ride.turns, "turns", { int: true, min: 0 }) ?? frames.length - 1,
    score: num(ride.score, "score") ?? 0, score_label: text(ride.score_label, 30, "score_label"), status: text(ride.status, 40, "status"),
    options: JSON.stringify(ride.options || {}), overrides: num(ride.overrides, "overrides", { int: true, min: 0 }) ?? 0,
    median_ms: ride.median_decision_ms ?? (sorted.length ? sorted[Math.floor(sorted.length / 2)] : null), max_turns: num(ride.max_turns, "max_turns", { int: true }),
    run_id: runId, note: text(ride.note, 280, "note"), frame_count: frames.length, frames: packed, created_at: text(ride.created_at, 40, "created_at"), submitted_at: now(),
  };
}
export const RIDE_COLS = ["id", "client_id", "game", "model", "device", "driver", "seed", "turns", "score", "score_label", "status", "options", "overrides", "median_ms", "max_turns", "run_id", "note", "frame_count", "frames", "created_at", "submitted_at"];
export const insertRide = (DB, row) => DB.prepare(`INSERT INTO rides (${RIDE_COLS.join(",")}) VALUES (${RIDE_COLS.map(() => "?").join(",")})`).bind(...RIDE_COLS.map(c => row[c] ?? null));
export const summarise = r => ({ ...r, frames: undefined, options: safeParse(r.options, {}), source: "community", model_name: r.model, median_decision_ms: r.median_ms, live: false });
export const safeParse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
