// Snake on a 10x10 text board: straight or a 90° turn per forward pass, with the harness policies from
// examples/snake_decider_demo.py (hint line, legality mask, decision rule).
import { Game, option } from "./base.js";

const DIRS = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
const OPPOSITE = { up: "down", right: "left", down: "up", left: "right" };
const DESCRIPTIONS = {
  up: "Move the head one row up (row - 1), without wrapping.",
  right: "Move the head one column right (column + 1), without wrapping.",
  down: "Move the head one row down (row + 1), without wrapping.",
  left: "Move the head one column left (column - 1), without wrapping.",
};
export const HINT_MODES = ["none", "dangers", "consequences", "safety"];
export const MASK_MODES = ["none", "step", "space"];
export const DECISION_RULES = ["argmax", "sample", "cycle_break"];
const SIZE = 10;
const key = (r, c) => r * SIZE + c;

export class Snake extends Game {
  static key = "snake";
  static title = "Snake";
  static blurb = "A 10×10 text board. Every turn the model picks straight or a 90° turn.";
  static scoreLabel = "food";
  static defaultMaxTurns = 300;
  static OPTIONS = [
    option("hint", "hint", "select", "dangers", { values: HINT_MODES, help: "Extra line in the state text. dangers: names only the controls that hit a wall or the body. consequences: every control, safe or not and whether it brings the head closer to the food. safety: every control marked safe or losing." }),
    option("legality_mask", "mask", "select", "space", { values: MASK_MODES, help: "step: only moves that survive the next step are eligible. space: additionally the move must lead into a region with room for the whole snake." }),
    option("decision", "decision", "select", "argmax", { values: DECISION_RULES, help: "argmax: most probable eligible move. sample: draw in proportion to the probabilities. cycle_break: argmax, but when the head is back on a cell visited since the last food, moves are weighted down by how often their target cell was visited." }),
  ];

  constructor(seed, options) {
    super(seed, options);
    const m = SIZE >> 1;
    this.snake = [[m, m], [m, m - 1], [m, m - 2]];
    this.direction = "right";
    this.food = this.spawnFood();
    this.crash = null;
    this.visits = new Map();
    this.recordVisit(false);
  }
  spawnFood() {
    const occ = new Set(this.snake.map(([r, c]) => key(r, c)));
    const empty = [];
    for (let r = 0; r < SIZE; r += 1) for (let c = 0; c < SIZE; c += 1) if (!occ.has(key(r, c))) empty.push([r, c]);
    return empty.length ? this.rng.choice(empty) : null;
  }
  recordVisit(ate) { if (ate) this.visits = new Map(); const k = key(...this.snake[0]); this.visits.set(k, (this.visits.get(k) || 0) + 1); }
  inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  legalMoves() {
    const [hr, hc] = this.snake[0]; const out = {};
    for (const [name, [dr, dc]] of Object.entries(DIRS)) {
      if (name === OPPOSITE[this.direction]) continue;
      const nr = hr + dr, nc = hc + dc;
      const eats = this.food && nr === this.food[0] && nc === this.food[1];
      const body = eats ? this.snake : this.snake.slice(0, -1);
      out[name] = this.inside(nr, nc) && !body.some(([r, c]) => r === nr && c === nc);
    }
    return out;
  }
  roomAfter(move) {
    const [hr, hc] = this.snake[0]; const [dr, dc] = DIRS[move]; const start = [hr + dr, hc + dc];
    const blocked = new Set(this.snake.slice(0, -1).map(([r, c]) => key(r, c)));
    if (!this.inside(...start) || blocked.has(key(...start))) return 0;
    const seen = new Set([key(...start)]); const stack = [start];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [ddr, ddc] of Object.values(DIRS)) { const nr = r + ddr, nc = c + ddc; const k = key(nr, nc); if (this.inside(nr, nc) && !blocked.has(k) && !seen.has(k)) { seen.add(k); stack.push([nr, nc]); } }
    }
    return seen.size;
  }
  hintLine(mode) {
    const [hr, hc] = this.snake[0]; const legal = this.legalMoves(); const parts = [];
    for (const [name, safe] of Object.entries(legal)) {
      const [dr, dc] = DIRS[name]; const nr = hr + dr, nc = hc + dc; const what = this.inside(nr, nc) ? "body" : "wall";
      if (mode === "dangers") { if (!safe) parts.push(`${name} hits the ${what}`); }
      else if (mode === "consequences") {
        if (!safe) parts.push(`${name}: hits the ${what}, loses`);
        else if (!this.food) parts.push(`${name}: safe`);
        else { const before = Math.abs(this.food[0] - hr) + Math.abs(this.food[1] - hc), after = Math.abs(this.food[0] - nr) + Math.abs(this.food[1] - nc);
               const trend = after === 0 ? "eats the food" : after < before ? "closer to food" : "farther from food"; parts.push(`${name}: safe, ${trend} (distance ${before} -> ${after})`); }
      } else parts.push(safe ? `${name}: safe` : `${name}: hits the ${what}, loses`);
    }
    if (mode === "dangers") return "Blocked controls: " + (parts.length ? parts.join(", ") : "none") + ".";
    if (mode === "consequences") return "Outcome of each control: " + parts.join("; ") + ".";
    return "Next-step check for each control: " + parts.join("; ") + ".";
  }
  grid() {
    const cells = Array.from({ length: SIZE }, () => Array(SIZE).fill("."));
    if (this.food) cells[this.food[0]][this.food[1]] = "F";
    for (const [r, c] of this.snake.slice(1)) cells[r][c] = "o";
    const [hr, hc] = this.snake[0]; cells[hr][hc] = "H";
    return cells.map(r => r.join(""));
  }
  stateText() {
    const head = this.snake[0], tail = this.snake[this.snake.length - 1], food = this.food;
    let rel = "No food remains.";
    if (food) {
      const v = food[0] === head[0] ? "same row" : `${Math.abs(food[0] - head[0])} row(s) ${food[0] > head[0] ? "below" : "above"}`;
      const h = food[1] === head[1] ? "same column" : `${Math.abs(food[1] - head[1])} column(s) ${food[1] > head[1] ? "right" : "left"}`;
      rel = `Food relative to head: ${v}; ${h}.`;
    }
    const hint = this.options.hint === "none" ? "" : this.hintLine(this.options.hint) + "\n";
    const rows = this.grid().map((row, i) => `${i} ${row}`).join("\n");
    return `Snake game after ${this.turn} move(s) on a ${SIZE}x${SIZE} board.\n` +
      "Coordinates are (row, column). Row 0 is the top; column 0 is the left. The board does not wrap.\n" +
      "Legend: H = head, o = body, F = food, . = empty.\n" +
      `Current direction: ${this.direction}. Head: (${head[0]}, ${head[1]}). Tail: (${tail[0]}, ${tail[1]}). Length: ${this.snake.length}. Food eaten: ${this.score}.\n` +
      `${rel}\n` +
      "Moving into a wall or any occupied body cell loses immediately. A 180-degree reversal is not a valid control and is not offered. The current tail cell becomes empty on a normal non-eating move.\n" +
      hint + "  0123456789\n" + rows;
  }
  question() {
    const criteria = {};
    for (const [name, d] of Object.entries(DESCRIPTIONS)) if (name !== OPPOSITE[this.direction]) criteria[name] = d;
    return { move: { type: "choice", instructions: "What move should the snake make now? First avoid any move that hits a wall or the snake's body. Among safe moves, prefer a route toward the food that leaves room for the snake on later turns. Choose exactly one direction.", criteria } };
  }
  choose(answer) {
    const modelChoice = answer.choice; const probs = { ...answer.probabilities }; const legal = this.legalMoves();
    let eligible = this.options.legality_mask === "none" ? probs : Object.fromEntries(Object.entries(probs).filter(([m]) => legal[m]));
    if (this.options.legality_mask === "space" && Object.keys(eligible).length) {
      const room = Object.fromEntries(Object.keys(eligible).map(m => [m, this.roomAfter(m)]));
      let roomy = Object.fromEntries(Object.entries(eligible).filter(([m]) => room[m] >= this.snake.length));
      if (!Object.keys(roomy).length) { const best = Math.max(...Object.values(room)); roomy = Object.fromEntries(Object.entries(eligible).filter(([m]) => room[m] === best)); }
      eligible = roomy;
    }
    const names = Object.keys(eligible);
    if (!names.length) return [modelChoice, false];
    if (this.options.decision === "sample") {
      const total = names.reduce((s, m) => s + eligible[m], 0); let draw = this.rng.random() * total; let move = names[0];
      for (const m of names) { move = m; draw -= eligible[m]; if (draw <= 0) break; }
      return [move, move !== modelChoice];
    }
    if (this.options.decision === "cycle_break" && (this.visits.get(key(...this.snake[0])) || 0) > 1) {
      const [hr, hc] = this.snake[0];
      const weighted = names.map(m => { const [dr, dc] = DIRS[m]; return [m, eligible[m] / (1 + (this.visits.get(key(hr + dr, hc + dc)) || 0))]; });
      const move = weighted.sort((a, b) => b[1] - a[1])[0][0];
      return [move, move !== modelChoice];
    }
    const move = names.sort((a, b) => eligible[b] - eligible[a])[0];
    return [move, move !== modelChoice];
  }
  apply(action) {
    if (this.status !== "playing") throw new Error("game over");
    if (!DIRS[action]) throw new Error(`unknown direction ${action}`);
    if (this.snake.length > 1 && action === OPPOSITE[this.direction]) throw new Error("reversal is not a valid control");
    const [dr, dc] = DIRS[action]; const [hr, hc] = this.snake[0]; const nr = hr + dr, nc = hc + dc;
    const ate = !!this.food && nr === this.food[0] && nc === this.food[1];
    const body = ate ? this.snake : this.snake.slice(0, -1);
    this.turn += 1; this.direction = action;
    if (!this.inside(nr, nc) || body.some(([r, c]) => r === nr && c === nc)) {
      this.status = this.inside(nr, nc) ? "self_collision" : "wall_collision"; this.crash = [nr, nc];
      return { ate: false, event: "" };
    }
    this.snake.unshift([nr, nc]);
    if (ate) { this.score += 1; this.food = this.spawnFood(); if (!this.food) this.status = "board_filled"; } else this.snake.pop();
    if (this.status === "playing") this.recordVisit(ate);
    return { ate, event: ate ? "◆ Food eaten" : "" };
  }
  snapshot() {
    return { snake: this.snake.map(c => [...c]), food: this.food ? [...this.food] : null, direction: this.direction, crash: this.crash ? [...this.crash] : null, length: this.snake.length };
  }
}
