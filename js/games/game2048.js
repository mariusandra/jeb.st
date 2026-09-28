// 2048: the model picks one of the legal slides each turn.
import { Game, option } from "./base.js";

const SIZE = 4; const DIRS = ["up", "right", "down", "left"];
const slideRow = row => {
  const tiles = row.filter(Boolean); const out = []; let gained = 0, merges = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) { out.push(tiles[i] * 2); gained += tiles[i] * 2; merges += 1; i += 1; } else out.push(tiles[i]);
  }
  while (out.length < SIZE) out.push(0);
  return [out, gained, merges];
};
const transpose = b => b[0].map((_, c) => b.map(r => r[c]));

export class Game2048 extends Game {
  static key = "2048";
  static title = "2048";
  static blurb = "A 4×4 tile board. Every turn the model picks one of the legal slides.";
  static scoreLabel = "score";
  static defaultMaxTurns = 500;
  static OPTIONS = [option("hint", "hint", "select", "consequences", { values: ["none", "consequences"], help: "consequences: every offered slide states the points it scores and the tiles it merges." })];

  constructor(seed, options) {
    super(seed, options);
    this.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    this.spawn(); this.spawn(); this.maxTile = Math.max(...this.board.flat());
  }
  spawn() { const empty = []; this.board.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); })); if (empty.length) { const [r, c] = this.rng.choice(empty); this.board[r][c] = this.rng.random() < 0.1 ? 4 : 2; } }
  move(board, dir) {
    let rows = board.map(r => [...r]);
    if (dir === "up" || dir === "down") rows = transpose(rows);
    if (dir === "right" || dir === "down") rows = rows.map(r => [...r].reverse());
    let gained = 0, merges = 0; let out = rows.map(r => { const [nr, g, m] = slideRow(r); gained += g; merges += m; return nr; });
    if (dir === "right" || dir === "down") out = out.map(r => [...r].reverse());
    if (dir === "up" || dir === "down") out = transpose(out);
    const moved = JSON.stringify(out) !== JSON.stringify(board);
    return [out, gained, merges, moved];
  }
  legal() { const out = {}; for (const d of DIRS) { const [b, g, m, moved] = this.move(this.board, d); if (moved) out[d] = [b, g, m]; } return out; }
  stateText() {
    const width = Math.max(...this.board.flat().map(x => String(x).length));
    const grid = this.board.map(row => row.map(x => String(x || ".").padStart(width, " ")).join(" ")).join("\n");
    return `2048 on a ${SIZE}x${SIZE} board after ${this.turn} move(s). Score ${this.score}; largest tile ${this.maxTile}.\n` +
      "A slide moves every tile as far as it goes in that direction; two equal tiles that collide merge into their sum and score that sum. After every slide a new 2 (or rarely 4) appears in a random empty cell. The game ends when no slide changes the board. Keep the board open and the large tiles together in a corner.\n" +
      "Row 0 is the top; '.' is empty.\n" + grid;
  }
  question() {
    const criteria = {};
    for (const [d, [board, gained, merges]] of Object.entries(this.legal())) {
      criteria[d] = this.options.hint === "consequences" ? `slide ${d}: scores ${gained}, merges ${merges} pair(s), leaves ${board.flat().filter(x => !x).length} empty cell(s) before the new tile` : `slide every tile ${d}`;
    }
    return { move: { type: "choice", instructions: "Which slide should be played now? Choose exactly one.", criteria } };
  }
  needsModel() { return Object.keys(this.legal()).length >= 2; }   // a Choice needs two options: a single legal slide is forced
  choose(answer) { const legal = Object.keys(this.legal()); if (!answer) return [legal[0], false]; if (legal.includes(answer.choice)) return [answer.choice, false]; const p = answer.probabilities || {}; return [legal.reduce((a, b) => ((p[b] || 0) > (p[a] || 0) ? b : a)), true]; }
  apply(action) {
    const legal = this.legal(); if (!legal[action]) throw new Error(`${action} does not change the board`);
    const [board, gained] = legal[action]; this.board = board; this.score += gained; this.turn += 1; this.spawn();
    this.maxTile = Math.max(...this.board.flat());
    if (!Object.keys(this.legal()).length) this.status = "no_moves";
    return { gained, event: gained ? `+${gained}` : "" };
  }
  snapshot() { return { board: this.board.map(r => [...r]), max_tile: this.maxTile }; }
}
