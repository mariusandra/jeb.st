// Breakout: every physics frame the model moves the paddle left, right or holds it.
import { Game, option } from "./base.js";

const PADDLE_Y = 0.92, PADDLE_WIDTH = 0.18, PADDLE_SPEEDS = { slow: 0.025, normal: 0.035, fast: 0.05 }, BALL_R = 0.015, BALL_SPEED = 0.04;
const MAX_ANGLE = 65 * Math.PI / 180, MIN_ANGLE = 12 * Math.PI / 180, BRICK_ROWS = 5, BRICK_COLS = 8, BRICK_TOP = 0.08, BRICK_BOTTOM = 0.33;
const BRICK_H = (BRICK_BOTTOM - BRICK_TOP) / BRICK_ROWS, BRICK_W = 1 / BRICK_COLS, LIVES = 3, MOVES = ["left", "stay", "right"];
const VIEW_COLS = 24, VIEW_LOWER_ROWS = 6, VIEW_ROWS = 1 + BRICK_ROWS + VIEW_LOWER_ROWS;
const pct = v => `${Math.round(v * 100)}%`;
const fly = (x, y, vx, vy) => {
  x += vx; y += vy;
  if (x - BALL_R < 0) { x = 2 * BALL_R - x; vx = -vx; } else if (x + BALL_R > 1) { x = 2 * (1 - BALL_R) - x; vx = -vx; }
  if (y - BALL_R < 0) { y = 2 * BALL_R - y; vy = -vy; }
  return [x, y, vx, vy];
};

export class Breakout extends Game {
  static key = "breakout";
  static title = "Breakout";
  static blurb = "Paddle, ball, bricks. Every frame the model moves the paddle left, right or holds.";
  static scoreLabel = "bricks";
  static defaultMaxTurns = 800;
  static maxTurnsLimit = 2000;
  static REALTIME = true;
  static OPTIONS = [
    option("ticks_per_decision", "ticks per decision", "int", 1, { min: 1, max: 4, help: "Physics ticks per model answer; the chosen paddle move repeats for all of them." }),
    option("hint", "hint", "bool", true, { help: "the state names the x where the ball will reach the paddle line if nothing changes" }),
    option("paddle_speed", "paddle speed", "select", "normal", { values: Object.keys(PADDLE_SPEEDS), help: "How far the paddle moves per tick: slow 2.5%, normal 3.5%, fast 5% of the screen width." }),
  ];

  constructor(seed, options) {
    super(seed, options);
    this.paddleX = 0.5; this.speed = PADDLE_SPEEDS[this.options.paddle_speed];
    this.bricks = new Set(); for (let r = 0; r < BRICK_ROWS; r += 1) for (let c = 0; c < BRICK_COLS; c += 1) this.bricks.add(`${r},${c}`);
    this.lives = LIVES; this.tick = 0; this.lostBall = false; this.hit = false; this.bx = this.by = this.vx = this.vy = 0;
    this.launch();
  }
  launch() { const angle = this.rng.uniform(20 * Math.PI / 180, 50 * Math.PI / 180) * this.rng.choice([-1, 1]); this.bx = this.paddleX; this.by = PADDLE_Y - BALL_R - 0.01; this.vx = BALL_SPEED * Math.sin(angle); this.vy = -BALL_SPEED * Math.cos(angle); }
  landingX() { let [x, y, vx, vy] = [this.bx, this.by, this.vx, this.vy]; for (let i = 0; i < 400; i += 1) { if (vy > 0 && y + BALL_R >= PADDLE_Y) return Math.min(1, Math.max(0, x)); [x, y, vx, vy] = fly(x, y, vx, vy); } return null; }
  brickAt(x, y) { if (!(BRICK_TOP <= y && y < BRICK_BOTTOM)) return null; return `${Math.floor((y - BRICK_TOP) / BRICK_H)},${Math.min(BRICK_COLS - 1, Math.max(0, Math.floor(x / BRICK_W)))}`; }
  step(move) {
    const half = PADDLE_WIDTH / 2;
    if (move === "left") this.paddleX = Math.max(half, this.paddleX - this.speed); else if (move === "right") this.paddleX = Math.min(1 - half, this.paddleX + this.speed);
    const prevBottom = this.by + BALL_R;
    [this.bx, this.by, this.vx, this.vy] = fly(this.bx, this.by, this.vx, this.vy); this.tick += 1;
    if (this.vy > 0 && prevBottom < PADDLE_Y && PADDLE_Y <= this.by + BALL_R && Math.abs(this.bx - this.paddleX) <= half + BALL_R) {
      const offset = Math.max(-1, Math.min(1, (this.bx - this.paddleX) / half)); let angle = offset * MAX_ANGLE;
      if (Math.abs(angle) < MIN_ANGLE) angle = MIN_ANGLE * ((offset || this.vx) >= 0 ? 1 : -1);
      this.vx = BALL_SPEED * Math.sin(angle); this.vy = -BALL_SPEED * Math.cos(angle); this.by = PADDLE_Y - BALL_R; return;
    }
    if (this.by - BALL_R > PADDLE_Y) { this.lives -= 1; this.lostBall = true; if (this.lives > 0) this.launch(); return; }
    const cell = this.brickAt(this.bx, this.by);
    if (cell && this.bricks.has(cell)) { this.bricks.delete(cell); this.vy = -this.vy; this.hit = true; this.score += 1; }
  }
  paddleEdges(x) { const half = PADDLE_WIDTH / 2; return `centre ${pct(x)}, from ${pct(x - half)} to ${pct(x + half)}`; }
  row(y) { if (y < BRICK_TOP) return 0; if (y < BRICK_BOTTOM) return 1 + Math.floor((y - BRICK_TOP) / BRICK_H); return Math.min(VIEW_ROWS - 1, 1 + BRICK_ROWS + Math.floor((y - BRICK_BOTTOM) / ((1 - BRICK_BOTTOM) / VIEW_LOWER_ROWS))); }
  view() {
    const rows = Array.from({ length: VIEW_ROWS }, () => Array(VIEW_COLS).fill(" "));
    for (const key of this.bricks) { const [r, c] = key.split(",").map(Number); for (let vc = 0; vc < VIEW_COLS; vc += 1) if (Math.floor((vc + 0.5) / VIEW_COLS / BRICK_W) === c) rows[1 + r][vc] = "#"; }
    const half = PADDLE_WIDTH / 2;
    for (let vc = 0; vc < VIEW_COLS; vc += 1) { const x = (vc + 0.5) / VIEW_COLS; if (this.paddleX - half <= x && x <= this.paddleX + half) rows[this.row(PADDLE_Y)][vc] = "="; }
    rows[this.row(this.by)][Math.min(VIEW_COLS - 1, Math.max(0, Math.floor(this.bx * VIEW_COLS)))] = "o";
    return rows.map(r => "|" + r.join("") + "|").join("\n");
  }
  stateText() {
    const lines = [
      `Breakout, tick ${this.tick}, ${this.score} brick(s) broken, ${this.bricks.size} left, ${this.lives} live(s). Positions are % of the screen: x from the left edge, y from the top (0% top, 100% bottom). The paddle slides along y = ${pct(PADDLE_Y)} and moves ${pct(this.speed)} per tick. A ball that passes the paddle costs a life.`,
      `Ball: at x ${pct(this.bx)}, y ${pct(this.by)}, heading ${this.vy < 0 ? "up" : "down"} and to the ${this.vx > 0 ? "right" : "left"} (${pct(Math.abs(this.vx))} sideways, ${pct(Math.abs(this.vy))} vertically per tick).`,
      `Paddle: ${this.paddleEdges(this.paddleX)}.`,
    ];
    if (this.options.hint) {
      const land = this.landingX();
      if (land !== null) {
        const half = PADDLE_WIDTH / 2;
        const need = land < this.paddleX - half + BALL_R ? `move LEFT by ${pct(this.paddleX - land)} to centre on it` : land > this.paddleX + half - BALL_R ? `move RIGHT by ${pct(land - this.paddleX)} to centre on it` : "no move needed, the paddle already covers it";
        lines.push(`If nothing changes the ball reaches the paddle line at x ${pct(land)}: ${need}.`);
      }
    }
    lines.push("View ('#' brick, 'o' ball, '=' paddle; one row per brick row, then the open screen down to the paddle):", this.view());
    return lines.join("\n");
  }
  question() {
    const half = PADDLE_WIDTH / 2, s = this.speed; const left = Math.max(half, this.paddleX - s), right = Math.min(1 - half, this.paddleX + s);
    return { move: { type: "choice", instructions: "Which way should the paddle move this frame? Get under the point where the ball will cross the paddle line, then hold; hit with the paddle's edge to angle the ball.",
      criteria: { left: `move left: the paddle will be at ${this.paddleEdges(left)}`, stay: `hold: the paddle stays at ${this.paddleEdges(this.paddleX)}`, right: `move right: the paddle will be at ${this.paddleEdges(right)}` } } };
  }
  apply(action) {
    if (!MOVES.includes(action)) throw new Error(`unknown action ${action}`);
    if (this.status !== "playing") throw new Error("game over");
    this.turn += 1; this.hit = this.lostBall = false;
    for (let i = 0; i < this.options.ticks_per_decision; i += 1) { this.step(action); if (!this.bricks.size || this.lives === 0) break; }
    if (!this.bricks.size) { this.status = "cleared"; return { event: "cleared" }; }
    if (this.lives === 0) { this.status = "game_over"; return { event: "game over" }; }
    return { event: this.hit ? "◆ brick" : this.lostBall ? "ball lost" : "" };
  }
  snapshot() {
    const r4 = v => Math.round(v * 10000) / 10000;
    return { paddle: { x: r4(this.paddleX), width: PADDLE_WIDTH, y: PADDLE_Y }, ball: { x: r4(this.bx), y: r4(this.by), vx: r4(this.vx), vy: r4(this.vy), r: BALL_R },
             bricks: [...this.bricks].map(k => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]), brick_rows: BRICK_ROWS, brick_cols: BRICK_COLS, brick_top: BRICK_TOP, brick_height: r4(BRICK_H), lives: this.lives, tick: this.tick, lost_ball: this.lostBall, hit: this.hit };
  }
}
