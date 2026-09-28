// Board renderers, one per game, drawing a recorded frame into the board element. Ported from the Jev demos page.
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const PIECE_COLORS = { I: "#5ad8ff", O: "#ffd166", T: "#c48bff", S: "#58f29b", Z: "#ff6b6b", J: "#6c8cff", L: "#ffa04d" };

function grid(board, cols, rows, cls) {
  board.className = "board " + cls; board.parentElement.className = "board-wrap " + cls;
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`; board.style.aspectRatio = `${cols} / ${rows}`;
  if (board.childElementCount !== cols * rows || board.dataset.kind !== cls) { board.innerHTML = ""; for (let i = 0; i < cols * rows; i += 1) { const c = document.createElement("div"); c.className = "cell"; board.appendChild(c); } board.dataset.kind = cls; }
  return Array.from(board.children);
}
function svgBoard(board, cls, w, h, inner) {
  board.className = "board svg " + cls; board.parentElement.className = "board-wrap " + cls; board.style.gridTemplateColumns = ""; board.style.aspectRatio = "";
  board.dataset.kind = "svg-" + cls; board.innerHTML = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
function textBoard(board, cls, html) {
  board.className = "board text " + cls; board.parentElement.className = "board-wrap " + cls; board.style.gridTemplateColumns = ""; board.style.aspectRatio = "";
  board.dataset.kind = "text-" + cls; board.innerHTML = html;
}

export const EMPTY = {
  snake: { snake: [[5, 5], [5, 4], [5, 3]], food: null, length: 3 },
  connect_four: { board: Array(6).fill("......."), win_cells: [] },
  tetris: { board: Array(20).fill(".........."), current: "", next: "" },
  "2048": { board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], max_tile: 0 },
  flappy: { bird: { y: .5, vy: 0 }, bird_x: .3, pipes: [{ x: .75, width: .12, gap_top: .35, gap_bottom: .63 }], score: 0 },
  breakout: { paddle: { x: .5, width: .18, y: .92 }, ball: { x: .5, y: .85, r: .015 }, bricks: Array.from({ length: 40 }, (_, i) => [Math.floor(i / 8), i % 8]), brick_rows: 5, brick_cols: 8, brick_top: .08, brick_height: .05, lives: 3, score: 0 },
  wordle: { guesses: [], answer: null, solved: false },
  twenty_questions: { universe: [], history: [], consistent: [] },
};

export const RENDERERS = {
  snake(board, f) {
    const size = 10, cells = grid(board, size, size, "snake"); cells.forEach(c => { c.className = "cell"; c.textContent = ""; });
    if (f.food) cells[f.food[0] * size + f.food[1]].classList.add("food");
    (f.snake || []).slice(1).forEach(([r, c]) => cells[r * size + c].classList.add("body"));
    if (f.snake && f.snake.length) { const [hr, hc] = f.snake[0]; cells[hr * size + hc].classList.add("head"); }
    if (f.crash && f.crash[0] >= 0 && f.crash[0] < size && f.crash[1] >= 0 && f.crash[1] < size) cells[f.crash[0] * size + f.crash[1]].classList.add("crash");
    return [["Length", f.length ?? (f.snake ? f.snake.length : 3)]];
  },
  connect_four(board, f) {
    const cells = grid(board, 7, 6, "c4"); cells.forEach(c => { c.className = "cell"; c.textContent = ""; });
    (f.board || []).forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "X") cells[r * 7 + c].classList.add("x"); if (ch === "O") cells[r * 7 + c].classList.add("o"); }));
    if (f.last) cells[f.last[1] * 7 + f.last[2]].classList.add("last");
    (f.win_cells || []).forEach(([r, c]) => cells[r * 7 + c].classList.add("win"));
    return [["Plays", f.model_first ? "X first" : "O first"]];
  },
  tetris(board, f) {
    const cells = grid(board, 10, 20, "tetris"); cells.forEach(c => { c.className = "cell"; c.textContent = ""; delete c.dataset.p; c.style.removeProperty("--pc"); });
    (f.board || []).forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") { const cell = cells[r * 10 + c]; cell.dataset.p = ch; cell.style.setProperty("--pc", PIECE_COLORS[ch] || "#ccc"); } }));
    (f.last_cells || []).forEach(([r, c]) => cells[r * 10 + c].classList.add("landed"));
    return [["Next", `${f.current || "—"} → ${f.next || "—"}`]];
  },
  "2048"(board, f) {
    const cells = grid(board, 4, 4, "g2048");
    const colors = { 2: "#eee4da", 4: "#ede0c8", 8: "#f2b179", 16: "#f59563", 32: "#f67c5f", 64: "#f65e3b", 128: "#edcf72", 256: "#edcc61", 512: "#edc850", 1024: "#edc53f", 2048: "#edc22e" };
    (f.board || EMPTY["2048"].board).forEach((row, r) => row.forEach((v, c) => { const cell = cells[r * 4 + c]; cell.className = "cell"; cell.textContent = v || ""; cell.style.background = v ? (colors[v] || "#3c3a32") : "rgba(255,255,255,.06)"; cell.style.color = v > 4 ? "#f9f6f2" : "#776e65"; }));
    return [["Max tile", f.max_tile ?? 0]];
  },
  flappy(board, f) {
    const W = 480, H = 360, bird = f.bird || { y: .5, vy: 0 }, bx = (f.bird_x ?? .3) * W, by = bird.y * H;
    const pipes = (f.pipes || []).map(p => { const x = p.x * W, w = p.width * W, top = p.gap_top * H, bot = p.gap_bottom * H, c = p.passed ? "#2a8a55" : "#3ecf7a";
      return `<rect x="${x}" y="0" width="${w}" height="${top}" rx="4" fill="${c}"/><rect x="${x - 4}" y="${top - 14}" width="${w + 8}" height="14" rx="3" fill="${c}"/><rect x="${x}" y="${bot}" width="${w}" height="${H - bot}" rx="4" fill="${c}"/><rect x="${x - 4}" y="${bot}" width="${w + 8}" height="14" rx="3" fill="${c}"/>`; }).join("");
    const tilt = Math.max(-35, Math.min(70, bird.vy * 1400));
    const birdSvg = `<g transform="translate(${bx} ${by}) rotate(${tilt})"><ellipse rx="14" ry="11" fill="${f.crash ? "#ff6b6b" : "#ffd166"}"/><circle cx="6" cy="-4" r="3.2" fill="#111"/><path d="M8 2 L20 4 L8 7 Z" fill="#ff9f43"/>${f.flapped ? '<ellipse cx="-4" cy="-8" rx="7" ry="4" fill="#fff" opacity=".8"/>' : '<ellipse cx="-4" cy="2" rx="7" ry="4" fill="#fff" opacity=".6"/>'}</g>`;
    svgBoard(board, "flappy", W, H, `<rect width="${W}" height="${H}" fill="#0b2233"/><rect y="${H - 10}" width="${W}" height="10" fill="#b9975b"/>${pipes}${birdSvg}<text x="${W / 2}" y="40" text-anchor="middle" fill="#fff" font-size="28" font-weight="800" font-family="ui-monospace, Menlo, monospace" opacity=".85">${f.score ?? 0}</text>`);
    return [];
  },
  breakout(board, f) {
    const W = 480, H = 360, pd = f.paddle || { x: .5, width: .18, y: .92 }, b = f.ball || { x: .5, y: .8, r: .015 };
    const cols = f.brick_cols || 8, top = (f.brick_top ?? .08) * H, bh = (f.brick_height ?? .05) * H, bw = W / cols;
    const rowColors = ["#ff6b6b", "#ffa04d", "#ffd166", "#58f29b", "#6cc2ff", "#c48bff"];
    const bricks = (f.bricks || []).map(([r, c]) => `<rect x="${c * bw + 2}" y="${top + r * bh + 2}" width="${bw - 4}" height="${bh - 4}" rx="3" fill="${rowColors[r % rowColors.length]}"/>`).join("");
    const lives = Array.from({ length: f.lives ?? 0 }, (_, i) => `<circle cx="${W - 16 - i * 16}" cy="14" r="5" fill="#fff" opacity=".8"/>`).join("");
    svgBoard(board, "breakout", W, H, `<rect width="${W}" height="${H}" fill="#0a1626"/>${bricks}<rect x="${(pd.x - pd.width / 2) * W}" y="${pd.y * H}" width="${pd.width * W}" height="10" rx="5" fill="#fff"/><circle cx="${b.x * W}" cy="${b.y * H}" r="${Math.max(5, (b.r || .015) * W)}" fill="${f.lost_ball ? "#ff6b6b" : "#ffd166"}"/>${lives}<text x="14" y="22" fill="#fff" font-size="16" font-weight="800" font-family="ui-monospace, Menlo, monospace" opacity=".8">${f.score ?? 0}</text>`);
    return [];
  },
  wordle(board, f) {
    const cells = grid(board, 5, 6, "wordle"); cells.forEach(c => { c.className = "cell"; c.textContent = ""; });
    (f.guesses || []).forEach((g, r) => [...g.word].forEach((ch, c) => { const cell = cells[r * 5 + c]; cell.textContent = ch; cell.classList.add(g.feedback[c]); }));
    if (f.answer && !f.solved) { const r = Math.min(5, (f.guesses || []).length); if (r < 6) [...f.answer].forEach((ch, c) => { const cell = cells[r * 5 + c]; if (!cell.textContent) { cell.textContent = ch; cell.classList.add("answer"); } }); }
    return [["Candidates", f.candidates_left ?? "—"]];
  },
  twenty_questions(board, f) {
    const consistent = new Set(f.consistent || []);
    const qa = (f.history || []).map((h, i) => `<div class="q">Q${i + 1}. ${esc(h.question)}</div><div class="a ${h.answer}">${esc(h.answer)}</div>`).join("");
    const verdict = f.guess ? `<div class="verdict ${f.correct ? "ok" : "bad"}">Guess: ${esc(f.guess)} — ${f.correct ? "correct" : `wrong, it was ${esc(f.secret || "?")}`}</div>` : "";
    const animals = (f.universe || []).map(a => `<span class="${consistent.has(a) ? "in" : ""}${f.secret === a ? " secret" : ""}${f.guess === a && !f.correct ? " guess" : ""}">${esc(a)}</span>`).join("");
    textBoard(board, "twenty_questions", `${verdict}<div class="qa">${qa || '<div class="q muted">No questions asked yet.</div><div></div>'}</div><div class="trail">${consistent.size} of ${(f.universe || []).length} animals still fit the answers</div><div class="animals">${animals}</div>`);
    return [];
  },
};

export function renderProbabilities(el, frame) {
  const probs = frame.probabilities || {}; const names = Object.keys(probs).length ? Object.keys(probs) : (frame.options_offered || []);
  el.innerHTML = names.map(name => {
    const p = probs[name] || 0, chosen = frame.model_choice === name ? " chosen" : "", played = frame.overridden && frame.action === name ? " played" : "";
    return `<div class="prob${chosen}${played}"><div class="prob-name" title="${esc(name)}">${esc(name)}</div><div class="prob-track"><div class="prob-fill" style="width:${(p * 100).toFixed(1)}%"></div></div><div class="prob-value">${(p * 100).toFixed(1)}%</div></div>`;
  }).join("") || '<div class="muted small">no model call this turn</div>';
}
