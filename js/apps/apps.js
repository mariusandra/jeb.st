// The app picker from PostHog pull request 106730: every app is one yes/no question, batched 32 per request.
import { ask } from "../models.js";
import { esc } from "../render.js";

const BATCH = 32;
let catalog = null;
const cache = new Map();
export async function loadCatalog() { if (!catalog) catalog = await (await fetch("data/apps_catalog.json")).json(); return catalog; }

export const appQuestion = app => ({ type: "noul", instructions: `Would this PostHog app help with the user's goal? Interpret partial words and unfinished descriptions as intent. App: ${app.name}. Category: ${app.category || ""}. ${app.description || ""} Example: ${app.example || ""}` });

export async function rankApps(car, query) {
  const cat = await loadCatalog(); query = query.trim();
  if (!query) return { scores: {}, latency_ms: 0, batches: 0 };
  const key = `${car.id}|${query}`; if (cache.has(key)) return { ...cache.get(key), cached: true };
  const apps = cat.apps; const batches = []; for (let i = 0; i < apps.length; i += BATCH) batches.push(apps.slice(i, i + BATCH));
  const started = performance.now();
  const parts = await Promise.all(batches.map(async batch => {
    const questions = Object.fromEntries(batch.map((a, i) => [`app_${i}`, appQuestion(a)]));
    const r = await ask(car, query, questions);
    return Object.fromEntries(batch.map((a, i) => { const ans = r.answers[`app_${i}`]; const p = Number(ans.noul ?? ans.probability ?? 0); return [a.name, Math.max(0, Math.min(1, p))]; }));
  }));
  const scores = Object.assign({}, ...parts);
  const out = { scores, latency_ms: Math.round(performance.now() - started), batches: batches.length, threshold: cat.threshold, model: car.modelName || car.name };
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  cache.set(key, out); return { ...out, cached: false };
}

export function renderApps(el, titleEl, countEl, cat, scores, meta, stars, onStar) {
  const thr = cat.threshold; const apps = cat.apps;
  const row = (a, score) => {
    const on = stars.has(a.name);
    const bar = score == null ? "" : `<div class="app-score"><div class="prob-track"><div class="prob-fill" style="width:${(score * 100).toFixed(0)}%; background:${score >= thr ? "linear-gradient(90deg, #8a6d00, var(--yellow))" : "#555"}"></div></div><div class="prob-value">${(score * 100).toFixed(0)}%</div></div>`;
    return `<div class="app-row${on ? " starred" : ""}" data-app="${esc(a.name)}"><div><div class="app-name"><span class="star${on ? " on" : ""}" title="star">${on ? "★" : "☆"}</span>${esc(a.name)} <span class="cat">${esc(a.category || "Other")}</span></div><div class="app-desc">${esc(a.description || "")}${a.example ? ` <em>Example: ${esc(a.example)}</em>` : ""}</div></div>${bar}</div>`;
  };
  let html = "";
  if (!scores) {
    titleEl.textContent = "All apps"; countEl.textContent = `${apps.length} apps · alphabetical by category`;
    const groups = {}; apps.forEach(a => { (groups[a.category || "Other"] = groups[a.category || "Other"] || []).push(a); });
    html = Object.keys(groups).sort().map(c => `<div class="app-group"><h3>${esc(c)}<span class="note">${groups[c].length}</span></h3>${groups[c].sort((x, y) => x.name.localeCompare(y.name)).map(a => row(a, null)).join("")}</div>`).join("");
  } else {
    const ranked = apps.map(a => [a, scores[a.name] ?? 0]).sort((x, y) => y[1] - x[1] || x[0].name.localeCompare(y[0].name));
    const matching = ranked.filter(([, s]) => s >= thr), other = ranked.filter(([, s]) => s < thr);
    titleEl.textContent = `Ranked for “${meta.query.length > 40 ? meta.query.slice(0, 40) + "…" : meta.query}”`;
    countEl.textContent = `${matching.length} matching · ${meta.model} · ${meta.latency_ms} ms${meta.cached ? " (cached)" : ""} · ${meta.batches} request${meta.batches === 1 ? "" : "s"}`;
    html = `<div class="app-group"><h3>Matching apps<span class="note">probability of yes ≥ ${thr}</span></h3>${matching.length ? matching.map(([a, s]) => row(a, s)).join("") : '<div class="muted small">No apps meet the match threshold. Try another description or choose from the apps below.</div>'}</div>`
      + `<div class="app-group other"><h3>Other apps<span class="note">below the match threshold; you can still star them</span></h3>${other.map(([a, s]) => row(a, s)).join("")}</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll(".star").forEach(s => s.addEventListener("click", () => onStar(s.closest(".app-row").dataset.app)));
}
