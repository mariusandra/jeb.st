// Connect Four against an opponent that wins if it can, else blocks, else plays at random; or against a second car.
import { Game, option } from "./base.js";

export const ROWS = 6, COLS = 7;
const MODEL = "X", OPP = "O";
const LINES = [];
for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
  const cells = [0, 1, 2, 3].map(i => [r + i * dr, c + i * dc]);
  if (cells.every(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS)) LINES.push(cells);
}

export function winningColumns(board, player) {
  const legal = [...Array(COLS).keys()].filter(c => board[0][c] === ".");
  const out = [];
  for (const c of legal) {
    let row = -1; for (let r = ROWS - 1; r >= 0; r -= 1) if (board[r][c] === ".") { row = r; break; }
    board[row][c] = player;
    const win = LINES.some(cells => cells.some(([rr, cc]) => rr === row && cc === c) && cells.every(([rr, cc]) => board[rr][cc] === player));
    board[row][c] = ".";
    if (win) out.push(c);
  }
  return out;
}

export class ConnectFour extends Game {
  static key = "connect_four";
  static title = "Connect Four";
  static blurb = "The model (X) against a win-or-block opponent. One column per forward pass.";
  static scoreLabel = "result";
  static defaultMaxTurns = 42;
  static maxTurnsLimit = 42;
  static OPPONENT = "O";
  static OPTIONS = [
    option("threats", "list threats", "bool", true, { help: "The state names the columns where X wins at once and where O would win next turn." }),
    option("tactical_mask", "tactical mask", "bool", false, { help: "Harness rule: play an immediate win, else block an immediate loss. Overrides are marked." }),
  ];

  constructor(seed, options) {
    super(seed, options);
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
    this.moves = []; this.winner = null; this.winCells = []; this.result = null;
    this.modelFirst = seed % 2 === 0; this.modelOpponent = false;
    this.toMove = this.modelFirst ? MODEL : OPP;
    if (!this.modelFirst) this.opponentMove();
  }
  setOpponentModel(enabled) {
    this.modelOpponent = enabled;
    if (enabled && !this.modelFirst && this.moves.length === 1) { const [, r, c] = this.moves.pop(); this.board[r][c] = "."; this.toMove = OPP; }
  }
  actor() { return this.modelOpponent && this.toMove === OPP ? "opponent" : "model"; }
  legal() { return [...Array(COLS).keys()].filter(c => this.board[0][c] === "."); }
  landingRow(col) { for (let r = ROWS - 1; r >= 0; r -= 1) if (this.board[r][col] === ".") return r; return -1; }
  wins(player, row, col) {
    this.board[row][col] = player;
    const cells = LINES.find(line => line.some(([r, c]) => r === row && c === col) && line.every(([r, c]) => this.board[r][c] === player)) || [];
    this.board[row][col] = ".";
    return cells;
  }
  winningColumns(player) { return this.legal().filter(c => this.wins(player, this.landingRow(c), c).length); }
  drop(player, col) {
    const row = this.landingRow(col); const cells = this.wins(player, row, col);
    this.board[row][col] = player; this.moves.push([player, row, col]);
    if (cells.length) { this.winner = player; this.winCells = cells; this.status = player === MODEL ? "win" : "loss"; this.result = player === MODEL ? 1 : 0; }
    else if (!this.legal().length) { this.status = "draw"; this.result = 0.5; }
    if (this.result !== null) this.score = this.result;
  }
  opponentMove() {
    const wins = this.winningColumns(OPP), blocks = this.winningColumns(MODEL);
    const col = wins.length ? wins[0] : blocks.length ? blocks[0] : this.rng.choice(this.legal());
    this.drop(OPP, col); this.toMove = MODEL; return col;
  }
  sides() { return this.toMove === MODEL ? [MODEL, OPP] : [OPP, MODEL]; }
  stateText() {
    const [me, them] = this.sides(); const last = this.moves[this.moves.length - 1];
    let threats = "";
    if (this.options.threats) {
      const mine = this.winningColumns(me), theirs = this.winningColumns(them);
      threats = `Immediate threats. ${me} wins at once by playing column: ${mine.join(", ") || "none"}. ${them} wins on its next move by playing column: ${theirs.join(", ") || "none"} (${me} must block one of these unless ${me} can win first).\n`;
    }
    return `Connect Four on a ${COLS}-column, ${ROWS}-row board after ${this.moves.length} move(s). You play ${me}; the opponent plays ${them}. Pieces drop to the lowest empty cell of a column. Four in a row (horizontal, vertical or diagonal) wins.\n` +
      "Columns are numbered 0 to 6 from the left. Row 0 is the top.\n" + (last ? `Last move: ${last[0]} in column ${last[2]}.\n` : "You move first.\n") + threats +
      " 0123456\n" + this.board.map((r, i) => `${i}${r.join("")}`).join("\n");
  }
  question() {
    const [me, them] = this.sides(); const criteria = {};
    for (const c of this.legal()) criteria[`column ${c}`] = `drop ${me} in column ${c}; it lands in row ${this.landingRow(c)}`;
    return { move: { type: "choice", instructions: `Which column should ${me} play now? Win at once if you can; otherwise stop ${them} from winning next move; otherwise build toward four in a row while not giving ${them} a win.`, criteria } };
  }
  choose(answer) {
    const modelChoice = answer.choice;
    if (!this.options.tactical_mask) return [modelChoice, false];
    const [me, them] = this.sides(); const wins = this.winningColumns(me), blocks = this.winningColumns(them); const forced = wins.length ? wins : blocks;
    if (forced.length && !forced.includes(Number(modelChoice.split(" ").pop()))) {
      const best = forced.sort((a, b) => (answer.probabilities[`column ${b}`] || 0) - (answer.probabilities[`column ${a}`] || 0))[0];
      return [`column ${best}`, true];
    }
    return [modelChoice, false];
  }
  apply(action) {
    const col = Number(action.split(" ").pop());
    if (!this.legal().includes(col)) throw new Error(`column ${col} is full`);
    this.turn += 1; let event = "";
    if (this.toMove === OPP) { this.drop(OPP, col); this.toMove = MODEL; event = `O plays column ${col}`; }
    else {
      this.drop(MODEL, col); this.toMove = OPP;
      if (this.status === "playing") { if (this.modelOpponent) event = `X plays column ${col}`; else event = `O answers in column ${this.opponentMove()}`; }
    }
    if (this.status === "win") event = "X wins"; else if (this.status === "loss") event = "O wins"; else if (this.status === "draw") event = "draw";
    return { event };
  }
  snapshot() {
    return { board: this.board.map(r => r.join("")), last: this.moves.length ? [...this.moves[this.moves.length - 1]] : null, win_cells: this.winCells.map(c => [...c]),
             winner: this.winner, model_first: this.modelFirst, to_move: this.toMove, model_opponent: this.modelOpponent };
  }
}
