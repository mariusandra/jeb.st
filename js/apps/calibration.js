// Calibration over recorded rides: is the model's top probability an honest forecast? Ported from demos/calibration.py.
import { winningColumns, ROWS } from "../games/connect_four.js";
import { esc } from "../render.js";

const GOOD_END = new Set(["win", "cleared", "success", "turn_limit", "done", "draw", "playing", "board_filled"]);
const isBad = s => !!s && !GOOD_END.has(s);

function bins(pairs, n = 10) {
  const b = Array.from({ length: n }, (_, i) => ({ lo: i / n, hi: (i + 1) / n, n: 0, conf: 0, hit: 0 }));
  for (const [c, h] of pairs) { const i = Math.min(n - 1, Math.max(0, Math.floor(c * n))); b[i].n += 1; b[i].conf += c; b[i].hit += h; }
  const total = pairs.length; let ece = 0;
  const out = b.map(x => { if (!x.n) return { lo: x.lo, hi: x.hi, n: 0, mean_conf: null, rate: null }; const mc = x.conf / x.n, rate = x.hit / x.n; ece += x.n / total * Math.abs(rate - mc); return { lo: x.lo, hi: x.hi, n: x.n, mean_conf: mc, rate }; });
  return { bins: out, n: total, ece: total ? ece : null, rate: total ? pairs.reduce((s, p) => s + p[1], 0) / total : null, mean_conf: total ? pairs.reduce((s, p) => s + p[0], 0) / total : null };
}
const confidence = f => (f.x_p_max != null ? Number(f.x_p_max) : (f.probabilities && Object.keys(f.probabilities).length ? Math.max(...Object.values(f.probabilities)) : null));
function forcedColumns(boardRows) {
  const board = boardRows.map(r => [...r]); const wins = winningColumns(board, "X"); if (wins.length) return new Set(wins); return new Set(winningColumns(board, "O"));
}

export function analyse(rides, horizon = 10) {
  const hind = [], forced = [], perGame = {}; let decisions = 0;
  for (const rec of rides) {
    const frames = rec.frames || []; const game = rec.game || "?";
    for (let i = 1; i < frames.length; i += 1) {
      const f = frames[i]; if ((f.actor || "model") !== "model" || !f.action) continue;
      const conf = confidence(f); if (conf == null) continue; decisions += 1;
      const window = frames.slice(i, i + horizon + 1); const bad = window.some(w => isBad(w.status));
      hind.push([conf, bad ? 0 : 1]); (perGame[game] = perGame[game] || []).push([conf, bad ? 0 : 1]);
      if (game === "connect_four" && frames[i - 1].board && frames[i - 1].board.length === ROWS) {
        const must = forcedColumns(frames[i - 1].board);
        if (must.size) { const col = Number(String(f.model_choice || f.action).split(" ").pop()); forced.push([conf, must.has(col) ? 1 : 0]); }
      }
    }
  }
  return { decisions, recordings: rides.length, horizon, hindsight: bins(hind), forced: forced.length ? bins(forced) : null,
    per_game: Object.fromEntries(Object.entries(perGame).sort().map(([k, v]) => [k, { n: v.length, rate: v.reduce((s, p) => s + p[1], 0) / v.length, mean_conf: v.reduce((s, p) => s + p[0], 0) / v.length }])) };
}

export function draw(chartEl, tipEl, legendEl, kpisEl, statusEl, d) {
  const SERIES = [["hindsight", "no bad end within the horizon", "s0"], ["forced", "forced move played (Connect Four)", "s1"]];
  const W = 560, H = 400, L = 46, R = 16, T = 16, B = 44, pw = W - L - R, ph = H - T - B;
  const x = v => L + v * pw, y = v => T + (1 - v) * ph;
  const series = SERIES.filter(([k]) => d[k] && d[k].n);
  const maxN = Math.max(1, ...(d.hindsight ? d.hindsight.bins.map(b => b.n) : [1]));
  let svg = `<g class="grid">${[0, .25, .5, .75, 1].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join("")}</g><line class="diag" x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}"/>`;
  if (d.hindsight) d.hindsight.bins.forEach(b => { const h = b.n / maxN * ph * .55; svg += `<rect class="count" x="${x(b.lo) + 1}" y="${y(0) - h}" width="${pw / 10 - 2}" height="${h}" rx="3"/>`; });
  svg += `<g class="axis">${[0, .25, .5, .75, 1].map(v => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${(v * 100).toFixed(0)}%</text><text x="${x(v)}" y="${H - B + 18}" text-anchor="middle">${(v * 100).toFixed(0)}%</text>`).join("")}<text x="${L + pw / 2}" y="${H - 6}" text-anchor="middle">model's probability on the move it played</text></g>`;
  series.forEach(([k, , cls], si) => {
    const pts = d[k].bins.filter(b => b.n > 0).map(b => [x(b.mean_conf), y(b.rate), b]);
    if (pts.length > 1) svg += `<path class="${cls}" fill="none" stroke-width="2" d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")}"/>`;
    pts.forEach(([px, py, b]) => { svg += `<circle class="${cls}" cx="${px}" cy="${py}" r="${Math.max(4, Math.min(9, 3 + Math.sqrt(b.n)))}" stroke="#2b2b2b" stroke-width="2"/>`; });
    if (pts.length) { const [px, py] = pts[pts.length - 1]; svg += `<text class="lbl" x="${Math.min(px, W - R - 70)}" y="${py + 16 + si * 13}" text-anchor="end">${esc(k)}</text>`; }
  });
  for (let i = 0; i < 10; i += 1) svg += `<rect class="hit" data-i="${i}" x="${x(i / 10)}" y="${T}" width="${pw / 10}" height="${ph}"/>`;
  chartEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`; chartEl.appendChild(tipEl);
  chartEl.querySelectorAll(".hit").forEach(r => {
    r.addEventListener("mousemove", e => {
      const i = Number(r.dataset.i); const rows = series.map(([k]) => { const b = d[k].bins[i]; return b.n ? `${k}: ${(b.rate * 100).toFixed(0)}% of ${b.n} (mean p ${(b.mean_conf * 100).toFixed(0)}%)` : null; }).filter(Boolean);
      tipEl.innerHTML = `<b>p in ${i * 10}–${(i + 1) * 10}%</b><br>${rows.join("<br>") || "no decisions"}`;
      const box = chartEl.getBoundingClientRect(); tipEl.style.display = "block"; tipEl.style.left = `${Math.min(e.clientX - box.left + 12, box.width - 220)}px`; tipEl.style.top = `${e.clientY - box.top - 10}px`;
    });
    r.addEventListener("mouseleave", () => { tipEl.style.display = "none"; });
  });
  legendEl.innerHTML = series.map(([k, label, cls]) => `<span style="--c:${{ s0: "#f5c518", s1: "#6cc2ff" }[cls]}">${esc(label)} (n=${d[k].n})</span>`).join("") + '<span class="count">decisions per bucket</span>';
  const kpi = (label, v) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${v}</div></div>`;
  kpisEl.innerHTML = kpi("decisions", d.decisions) + kpi("rides", d.recordings) + kpi("forced-move ECE", d.forced ? d.forced.ece.toFixed(3) : "—") + kpi("hindsight ECE", d.hindsight && d.hindsight.n ? d.hindsight.ece.toFixed(3) : "—");
  statusEl.textContent = d.hindsight && d.hindsight.n ? `survival ${(d.hindsight.rate * 100).toFixed(0)}% overall · mean top probability ${(d.hindsight.mean_conf * 100).toFixed(0)}%${d.forced ? ` · forced moves played ${(d.forced.rate * 100).toFixed(0)}% of ${d.forced.n}` : ""}` : "no recorded decisions match";
}
