// Tetris with the shortlist harness: the four-feature heuristic ranks every placement, the top N are offered in
// placement order with their consequences and the board after landing, and the model picks one.
import { Game, option } from "./base.js";

const W = 10, H = 20;
const SHAPES = { I: ["####"], O: ["##", "##"], T: ["###", ".#."], S: [".##", "##."], Z: ["##.", ".##"], J: ["#..", "###"], L: ["..#", "###"] };
const WEIGHTS = { height: -0.510066, lines: 0.760666, holes: -0.35663, bumpiness: -0.184483 };
const rotations = shape => {
  let grid = shape.map(r => [...r]); const seen = new Set(); const out = [];
  for (let k = 0; k < 4; k += 1) {
    const cells = []; grid.forEach((row, r) => row.forEach((ch, c) => { if (ch === "#") cells.push([r, c]); }));
    cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const sig = JSON.stringify(cells);
    if (!seen.has(sig)) { seen.add(sig); out.push(cells); }
    const h = grid.length, w = grid[0].length; const rot = Array.from({ length: w }, (_, c) => Array.from({ length: h }, (_, r) => grid[h - 1 - r][c])); grid = rot;
  }
  return out;
};
const ROTATIONS = Object.fromEntries(Object.entries(SHAPES).map(([k, s]) => [k, rotations(s)]));
const heights = board => Array.from({ length: W }, (_, c) => { for (let r = 0; r < H; r += 1) if (board[r][c]) return H - r; return 0; });
const features = (board, lines) => {
  const hs = heights(board); let holes = 0;
  for (let c = 0; c < W; c += 1) { let seen = false; for (let r = 0; r < H; r += 1) { if (board[r][c]) seen = true; else if (seen) holes += 1; } }
  let bump = 0; for (let i = 0; i < W - 1; i += 1) bump += Math.abs(hs[i] - hs[i + 1]);
  return { height: hs.reduce((a, b) => a + b, 0), lines, holes, bumpiness: bump, max_height: Math.max(...hs) };
};

export class Tetris extends Game {
  static key = "tetris";
  static title = "Tetris";
  static blurb = "The heuristic shortlists 8 placements with their consequences; the model picks one.";
  static scoreLabel = "lines";
  static defaultMaxTurns = 300;
  static maxTurnsLimit = 1000;
  static OPTIONS = [
    option("shortlist", "shortlist", "int", 8, { min: 2, max: 12, help: "How many heuristic-ranked placements are offered." }),
    option("player", "player", "select", "model", { values: ["model", "heuristic", "random"], help: "model: the model picks from the shortlist. heuristic: the heuristic's own first choice (no model call). random: a random pick from the shortlist (no model call)." }),
    option("show_board_after", "board after", "bool", true, { help: "Each option includes the board after the piece lands (about 1,300 prompt tokens per turn)." }),
  ];

  constructor(seed, options) {
    super(seed, options);
    this.board = Array.from({ length: H }, () => Array(W).fill(null));
    this.bag = []; this.current = this.nextPiece(); this.next = this.nextPiece();
    this.lines = 0; this.pieces = 0; this.lastCells = [];
    this.placements = this.shortlist();
    if (!this.placements.length) this.status = "topped_out";
  }
  nextPiece() { if (!this.bag.length) this.bag = this.rng.shuffle(Object.keys(SHAPES)); return this.bag.pop(); }
  dropCells(cells, col) {
    const width = Math.max(...cells.map(c => c[1])) + 1;
    if (col < 0 || col + width > W) return null;
    for (let top = -2; top < H; top += 1) {
      const landed = cells.map(([r, c]) => [top + r, col + c]);
      const blocked = landed.some(([rr, cc]) => rr >= H || (rr >= 0 && this.board[rr][cc]));
      if (blocked) { if (top === -2) return null; const prev = cells.map(([r, c]) => [top - 1 + r, col + c]); return prev.every(([rr]) => rr >= 0) ? prev : null; }
    }
    return null;
  }
  simulate(landed) {
    const board = this.board.map(r => [...r]); for (const [r, c] of landed) board[r][c] = this.current;
    const kept = board.filter(row => !row.every(Boolean)); const cleared = H - kept.length;
    return [Array.from({ length: cleared }, () => Array(W).fill(null)).concat(kept), cleared];
  }
  shortlist() {
    const out = [];
    ROTATIONS[this.current].forEach((cells, rot) => {
      const width = Math.max(...cells.map(c => c[1])) + 1;
      for (let col = 0; col <= W - width; col += 1) {
        const landed = this.dropCells(cells, col); if (!landed) continue;
        const [board, cleared] = this.simulate(landed); const f = features(board, cleared);
        out.push({ rot, col, cells: landed, board, features: f, score: Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k] * f[k], 0), name: `r${rot}c${col}` });
      }
    });
    return out.sort((a, b) => b.score - a.score).slice(0, this.options.shortlist).sort((a, b) => a.rot - b.rot || a.col - b.col);
  }
  rows(board, crop = false) {
    let rows = board.map(row => row.map(ch => ch || ".").join(""));
    if (crop) { const first = rows.findIndex(r => r !== ".".repeat(W)); rows = rows.slice(Math.max(0, (first === -1 ? H : first) - 1)); }
    return rows;
  }
  stateText() {
    return `Tetris on a ${W}-wide, ${H}-high board after ${this.pieces} piece(s); ${this.lines} line(s) cleared.\n` +
      `Current piece: ${this.current}\n${SHAPES[this.current].join("\n")}\nNext piece: ${this.next}.\n` +
      "Letters are settled pieces, '.' is empty. Row 0 is the top; columns 0 to 9 from the left. A placement is a rotation (r0, r1, ...: the piece turned clockwise that many times) and the column of its left edge; the piece drops straight down from the top.\n" +
      "Board:\n 0123456789\n" + this.rows(this.board).map((row, i) => `${String(i).padStart(2, " ")}${row}`).join("\n");
  }
  question() {
    const criteria = {};
    for (const p of this.placements) {
      const f = p.features; const cols = [...new Set(p.cells.map(c => c[1]))].sort((a, b) => a - b);
      let text = `rotation r${p.rot} with its left edge in column ${p.col} (occupies columns ${cols[0]}-${cols[cols.length - 1]}); clears ${f.lines} line(s); holes after: ${f.holes}; bumpiness after: ${f.bumpiness}; total height after: ${f.height}; tallest column after: ${f.max_height}`;
      if (this.options.show_board_after) text += "; board after it lands:\n" + this.rows(p.board, true).join("\n");
      criteria[p.name] = text;
    }
    return { move: { type: "choice", instructions: "Which placement should the current piece take? More lines cleared is better; fewer holes, lower bumpiness and lower total height are better. Choose exactly one.", criteria } };
  }
  needsModel() { return this.options.player === "model" && this.placements.length >= 2; }
  choose(answer) {
    if (this.placements.length === 1) return [this.placements[0].name, false];
    if (this.options.player === "heuristic") return [this.placements.reduce((a, b) => (b.score > a.score ? b : a)).name, false];
    if (this.options.player === "random") return [this.rng.choice(this.placements).name, false];
    return [answer.choice, false];
  }
  apply(action) {
    const p = this.placements.find(x => x.name === action); if (!p) throw new Error(`unknown placement ${action}`);
    this.board = p.board; const cleared = p.features.lines; this.lines += cleared; this.score = this.lines; this.pieces += 1; this.turn = this.pieces;
    this.lastCells = p.cells; this.current = this.next; this.next = this.nextPiece(); this.placements = this.shortlist();
    if (!this.placements.length) this.status = "topped_out";
    return { lines: cleared, event: cleared ? `${cleared} line(s) cleared` : "" };
  }
  snapshot() {
    return { board: this.rows(this.board), current: this.current, next: this.next, lines: this.lines, pieces: this.pieces, last_cells: this.lastCells.map(c => [...c]),
             shortlist: this.placements.map(p => ({ name: p.name, cells: p.cells.map(c => [...c]), score: Math.round(p.score * 1000) / 1000 })) };
  }
}
