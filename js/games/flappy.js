// Flappy Bird: one yes/no question per physics frame, flap or glide.
import { Game, option } from "./base.js";

const BIRD_X = 0.3, BIRD_R = 0.02, GRAVITY = 0.0022, FLAP_VY = -0.02, MAX_FALL = 0.04, PIPE_SPEED = 0.012, PIPE_WIDTH = 0.12;
const GAP_HEIGHT = 0.28, PIPE_SPACING = 0.55, SPAWN_X = 1.05, GAP_MARGIN = 0.12, VIEW_ROWS = 12, VIEW_COLS = 24, VIEW_SPAN = 1.2;
const pct = v => `${Math.round(v * 100)}%`;

export class Flappy extends Game {
  static key = "flappy";
  static title = "Flappy Bird";
  static blurb = "A bird, gravity, pipes. One yes/no question per frame: flap?";
  static scoreLabel = "pipes";
  static defaultMaxTurns = 600;
  static maxTurnsLimit = 2000;
  static REALTIME = true;
  static NOUL = ["flap", "glide"];
  static OPTIONS = [
    option("ticks_per_decision", "ticks per decision", "int", 1, { min: 1, max: 4, help: "Physics ticks per model answer. A flap is applied on the first tick only, the rest glide." }),
    option("hint", "hint", "bool", true, { help: "the state says whether the bird is above or below the gap and what glide/flap does next tick" }),
  ];

  constructor(seed, options) {
    super(seed, options);
    this.y = 0.5; this.vy = 0; this.tick = 0; this.pipes = []; this.crash = false; this.flapped = false;
    this.spawn(SPAWN_X);
  }
  spawn(x) { const gapTop = this.rng.uniform(GAP_MARGIN, 1 - GAP_MARGIN - GAP_HEIGHT); this.pipes.push({ x, width: PIPE_WIDTH, gap_top: gapTop, gap_bottom: gapTop + GAP_HEIGHT, passed: false }); }
  hits(y) {
    if (y - BIRD_R < 0 || y + BIRD_R > 1) return true;
    return this.pipes.some(p => p.x < BIRD_X + BIRD_R && p.x + p.width > BIRD_X - BIRD_R && (y - BIRD_R < p.gap_top || y + BIRD_R > p.gap_bottom));
  }
  step(flap) {
    this.vy = flap ? FLAP_VY : Math.min(this.vy + GRAVITY, MAX_FALL); this.y += this.vy; let passed = 0;
    for (const p of this.pipes) { p.x -= PIPE_SPEED; if (!p.passed && p.x + p.width < BIRD_X) { p.passed = true; passed += 1; } }
    this.pipes = this.pipes.filter(p => p.x + p.width > -0.05);
    if (this.pipes[this.pipes.length - 1].x <= SPAWN_X - PIPE_SPACING) this.spawn(this.pipes[this.pipes.length - 1].x + PIPE_SPACING);
    this.tick += 1; if (this.hits(this.y)) this.crash = true; return passed;
  }
  upcoming() { return this.pipes.filter(p => !p.passed); }
  view() {
    const rows = Array.from({ length: VIEW_ROWS }, () => Array(VIEW_COLS).fill(" "));
    for (const p of this.pipes) {
      const c0 = Math.max(0, Math.floor(p.x / VIEW_SPAN * VIEW_COLS)), c1 = Math.min(VIEW_COLS, Math.floor((p.x + p.width) / VIEW_SPAN * VIEW_COLS) + 1);
      for (let r = 0; r < VIEW_ROWS; r += 1) { const yc = (r + 0.5) / VIEW_ROWS; if (!(p.gap_top <= yc && yc <= p.gap_bottom)) for (let c = c0; c < c1; c += 1) rows[r][c] = "#"; }
    }
    const br = Math.min(VIEW_ROWS - 1, Math.max(0, Math.floor(this.y * VIEW_ROWS))); rows[br][Math.floor(BIRD_X / VIEW_SPAN * VIEW_COLS)] = "@";
    return rows.map(r => "|" + r.join("") + "|").join("\n");
  }
  relative(y, p) {
    const centre = (p.gap_top + p.gap_bottom) / 2;
    if (y < p.gap_top + BIRD_R) return `ABOVE the gap by ${pct(p.gap_top + BIRD_R - y)}`;
    if (y > p.gap_bottom - BIRD_R) return `BELOW the gap by ${pct(y - p.gap_bottom + BIRD_R)}`;
    return `inside the gap, ${pct(Math.abs(y - centre))} ${y < centre ? "above" : "below"} its centre`;
  }
  stateText() {
    const speed = `${this.vy < 0 ? "rising" : "falling"} at ${(Math.abs(this.vy) * 100).toFixed(1)}% per tick`;
    const lines = [`Flappy Bird, tick ${this.tick}, ${this.score} pipe(s) passed. Heights are % from the top of the screen (0% top, 100% ground). The bird falls faster every tick; a flap sets its speed to ${pct(-FLAP_VY)} per tick upward. Touching the top, the ground or a pipe ends the game.`, `Bird: height ${pct(this.y)}, ${speed}.`];
    const nxt = this.upcoming();
    if (nxt.length) {
      const p = nxt[0]; const dist = Math.max(0, p.x - BIRD_X); const where = dist === 0 ? "the bird is between its pipes" : `${pct(dist)} ahead`;
      lines.push(`Next pipe: ${where}, ${pct(p.width)} wide, gap from ${pct(p.gap_top)} to ${pct(p.gap_bottom)} (centre ${pct((p.gap_top + p.gap_bottom) / 2)}). The bird is ${this.relative(this.y, p)}.`);
      if (nxt.length > 1) { const q = nxt[1]; lines.push(`Pipe after that: ${pct(q.x - BIRD_X)} ahead, gap ${pct(q.gap_top)} to ${pct(q.gap_bottom)}.`); }
      if (this.options.hint) { const gy = this.y + Math.min(this.vy + GRAVITY, MAX_FALL), fy = this.y + FLAP_VY; lines.push(`Next tick: glide -> height ${pct(gy)} (${this.relative(gy, p)}); flap -> height ${pct(fy)} (${this.relative(fy, p)}).`); }
    }
    lines.push(`Side view ('@' bird, '#' pipe, gaps are blank), left to right is ${Math.round(VIEW_SPAN * 100)}% of the screen:`, this.view());
    return lines.join("\n");
  }
  question() { return { move: { type: "noul", instructions: "<should the bird flap right now?> Yes means flap (a fixed upward push); no means glide and keep falling. Aim for the centre of the next gap: flap when below it or falling toward its bottom, glide when above it or rising toward its top." } }; }
  apply(action) {
    if (!["flap", "glide"].includes(action)) throw new Error(`unknown action ${action}`);
    if (this.status !== "playing") throw new Error("game over");
    this.turn += 1; this.flapped = action === "flap"; let passed = 0;
    for (let i = 0; i < this.options.ticks_per_decision; i += 1) { passed += this.step(this.flapped && i === 0); if (this.crash) break; }
    this.score += passed;
    if (this.crash) { this.status = "crash"; return { event: "crash" }; }
    return { event: passed ? "▲ pipe passed" : "" };
  }
  snapshot() {
    const r4 = v => Math.round(v * 10000) / 10000;
    return { bird: { y: r4(this.y), vy: r4(this.vy) }, bird_x: BIRD_X, pipes: this.pipes.filter(p => p.x < 1.2).map(p => ({ x: r4(p.x), width: r4(p.width), gap_top: r4(p.gap_top), gap_bottom: r4(p.gap_bottom), passed: p.passed })), tick: this.tick, crash: this.crash, flapped: this.flapped };
  }
}
