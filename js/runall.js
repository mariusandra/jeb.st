// Run all: drive one car through every app and produce a scorecard. Each game is recorded as a ride.
import { createRide, step, summary } from "./runner.js";
import { REGISTRY } from "./games/index.js";
import { decide, loadPresets } from "./apps/text.js";
import { rankApps, loadCatalog } from "./apps/apps.js";
import { putRide, putRun } from "./store.js";

export const PLAN = [
  { kind: "game", game: "snake", seeds: [0], maxTurns: 150, label: "Snake, 150 turns" },
  { kind: "game", game: "connect_four", seeds: [0, 1, 2], maxTurns: 42, label: "Connect Four, 3 games vs win-or-block" },
  { kind: "game", game: "tetris", seeds: [0], maxTurns: 60, label: "Tetris, 60 pieces" },
  { kind: "game", game: "2048", seeds: [0], maxTurns: 150, label: "2048, 150 turns" },
  { kind: "game", game: "flappy", seeds: [0], maxTurns: 200, label: "Flappy Bird, 200 frames" },
  { kind: "game", game: "breakout", seeds: [0], maxTurns: 300, label: "Breakout, 300 frames" },
  { kind: "game", game: "wordle", seeds: [0, 1, 2], maxTurns: 6, label: "Wordle, 3 words" },
  { kind: "game", game: "twenty_questions", seeds: [0, 1, 2], maxTurns: 21, label: "20 Questions, 3 animals" },
  { kind: "text", label: "Text decisions, 8 presets" },
  { kind: "apps", label: "App picker, 4 example prompts" },
];

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// onProgress({label, detail, fraction}); onFrame(session, frame) lets the page draw the live board.
export async function runAll(car, { onProgress = () => {}, onFrame = () => {}, signal } = {}) {
  const run = { id: `run-${Date.now().toString(36)}`, created_at: new Date().toISOString(), car: car.name, model: car.modelName || car.name, device: car.device || "?", rows: [], rides: [] };
  const total = PLAN.reduce((n, p) => n + (p.seeds ? p.seeds.length : 1), 0); let done = 0;
  const check = () => { if (signal && signal.aborted) throw new DOMException("cancelled", "AbortError"); };
  for (const job of PLAN) {
    check();
    if (job.kind === "game") {
      const cls = REGISTRY[job.game]; const scores = [], lat = [], statuses = []; let turns = 0;
      for (const seed of job.seeds) {
        onProgress({ label: job.label, detail: `seed ${seed}`, fraction: done / total });
        const session = createRide({ game: job.game, seed, maxTurns: job.maxTurns, options: {}, car });
        session.ride.run_id = run.id;
        while (true) {
          check();
          let result;
          try { result = await step(session, { signal }); }
          catch (e) { if (e.name === "AbortError") throw e; await new Promise(r => setTimeout(r, 2500)); check(); result = await step(session, { signal }); }   // one retry for a flaky server
          onFrame(session, result.frame); if (result.done) break;
        }
        const s = summary(session.ride); scores.push(s.score); statuses.push(s.status); turns += s.turns; lat.push(...session.ride.latencies);
        try { await putRide(session.ride); } catch {}
        run.rides.push(session.ride.id); done += 1;
      }
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      run.rows.push({ app: cls.title, label: job.label, score: Math.round(avg * 100) / 100, score_label: cls.scoreLabel, games: job.seeds.length, turns, statuses, median_ms: median(lat) ? Math.round(median(lat)) : null });
    } else if (job.kind === "text") {
      onProgress({ label: job.label, detail: "", fraction: done / total });
      const presets = await loadPresets(); let answered = 0, asked = 0; const lat = []; let confident = 0;
      for (const p of presets) { check(); const rec = await decide([car], p.state, p.questions); const r = rec.results[0]; asked += Object.keys(p.questions).length; if (r.answers) { answered += Object.keys(r.answers).length; lat.push(r.latency_ms); for (const a of Object.values(r.answers)) { const top = a.x_p_max ?? (a.probabilities ? Math.max(...Object.values(a.probabilities)) : (a.noul != null ? Math.max(a.noul, 1 - a.noul) : 0)); if (top >= 0.8) confident += 1; } } }
      done += 1;
      run.rows.push({ app: "Text decisions", label: job.label, score: answered, score_label: `of ${asked} answered`, games: presets.length, turns: presets.length, statuses: [`${confident} at p ≥ 0.8`], median_ms: median(lat) ? Math.round(median(lat)) : null });
    } else if (job.kind === "apps") {
      onProgress({ label: job.label, detail: "", fraction: done / total });
      const cat = await loadCatalog(); const tops = [], lat = []; let matching = 0;
      for (const q of cat.examples) { check(); const r = await rankApps(car, q); const best = Object.entries(r.scores).sort((a, b) => b[1] - a[1])[0]; tops.push(`${q} → ${best ? best[0] : "?"}`); matching += Object.values(r.scores).filter(s => s >= cat.threshold).length; lat.push(r.latency_ms); }
      done += 1;
      run.rows.push({ app: "App picker", label: job.label, score: Math.round(matching / cat.examples.length), score_label: "matching apps per prompt", games: cat.examples.length, turns: cat.apps.length * cat.examples.length, statuses: tops, median_ms: median(lat) ? Math.round(median(lat)) : null });
    }
  }
  run.finished_at = new Date().toISOString();
  try { await putRun(run); } catch {}
  onProgress({ label: "done", detail: "", fraction: 1 });
  return run;
}
