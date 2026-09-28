// Text decisions: paste a text, define typed questions, ask one or every ready car, and keep the answers.
import { ask } from "../models.js";
import { esc } from "../render.js";
import { putAsk, listAsks } from "../store.js";

export async function loadPresets() { return (await (await fetch("data/presets.json")).json()); }

export async function decide(cars, state, questions) {
  const results = await Promise.all(cars.map(async car => {
    try { const r = await ask(car, state, questions); return { server: car.name, model: r.model || car.modelName, latency_ms: Math.round(r.latencyMs * 10) / 10, answers: r.answers, usage: r.usage }; }
    catch (e) { return { server: car.name, error: e.message }; }
  }));
  const text = typeof state === "string" ? state : JSON.stringify(state);
  const record = { id: `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, created_at: new Date().toISOString(), title: (text.trim().split("\n")[0] || "(empty)").slice(0, 80), state, questions, results, models: results.filter(r => r.answers).map(r => r.server) };
  if (record.models.length) { try { await putAsk(record); } catch {} }
  return record;
}

const num = (x, d = 2) => (typeof x === "number" && Number.isFinite(x) ? x.toFixed(d) : "—");

export function renderAsk(el, askRecord) {
  const results = askRecord.results || [];
  const cards = Object.entries(askRecord.questions).map(([qid, spec]) => {
    const type = spec.type || "choice";
    const cols = results.map(r => {
      const head = `<div class="col-head"><span>${esc(r.server)}</span><span>${esc(r.model || "")}${r.latency_ms ? ` · ${Math.round(r.latency_ms)} ms` : ""}</span></div>`;
      if (!r.answers) return `<div>${head}<div class="small bad">${esc(r.error || "no answer")}</div></div>`;
      const a = r.answers[qid]; if (!a) return `<div>${head}<div class="small muted">no answer</div></div>`;
      let body = "";
      if (a.type === "choice" || ("choice" in a)) {
        body = `<div class="verdict">${esc(a.choice)}</div>` + Object.entries(a.probabilities || {}).map(([k, p]) => `<div class="prob${k === a.choice ? " chosen" : ""}"><div class="prob-name" title="${esc(k)}">${esc(k)}</div><div class="prob-track"><div class="prob-fill" style="width:${(p * 100).toFixed(1)}%"></div></div><div class="prob-value">${(p * 100).toFixed(1)}%</div></div>`).join("")
          + `<div class="meta">confidence ${num(a.confidence)}${a.certainty != null ? ` · certainty ${num(a.certainty)}` : ""}${a.unknown_probability != null ? ` · unknown ${num(a.unknown_probability)}` : ""}</div>`;
      } else if (a.type === "score" || ("score" in a)) {
        const levels = a.legend || {}; const probs = a.probabilities || {}; const entries = Object.entries(probs).sort((x, y) => y[1] - x[1]); const best = entries.length ? entries[0][0] : null;
        const n = Object.keys(probs).length || (Array.isArray(spec.criteria) ? spec.criteria.length : 0);
        body = `<div class="verdict">score ${num(a.score, 2)}${n ? ` of ${n - 1}` : ""}</div>` + Object.entries(probs).map(([k, p]) => `<div class="prob${k === best ? " chosen" : ""}"><div class="prob-name" title="${esc(levels[k] || k)}">${esc(k)}: ${esc((levels[k] || (Array.isArray(spec.criteria) ? spec.criteria[Number(k)] : "") || "").slice(0, 14))}</div><div class="prob-track"><div class="prob-fill" style="width:${(p * 100).toFixed(1)}%"></div></div><div class="prob-value">${(p * 100).toFixed(1)}%</div></div>`).join("")
          + `<div class="meta">confidence ${num(a.confidence)}${a.fit_mass != null ? ` · fit mass ${num(a.fit_mass)}` : ""}</div>`;
      } else {
        const p = Number(a.noul ?? a.probability ?? 0);
        body = `<div class="verdict">${p >= 0.5 ? "yes" : "no"} · p(yes) ${(p * 100).toFixed(1)}%</div><div class="noul-track"><div class="noul-mark" style="left:${(p * 100).toFixed(1)}%"></div></div><div class="meta">no ←──────────→ yes</div>`;
      }
      return `<div>${head}${body}</div>`;
    }).join("");
    const crit = spec.criteria ? (Array.isArray(spec.criteria) ? spec.criteria.map((c, i) => `${i}: ${c}`).join(" · ") : Object.entries(spec.criteria).map(([k, v]) => v ? `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}` : k).join(" · ")) : "";
    return `<div class="qcard"><h3><span>${esc(qid)}</span><span class="chip">${esc(type)}</span></h3><div class="qtext">${esc(spec.instructions || "")}${crit ? `<br><span class="muted">${esc(crit)}</span>` : ""}</div><div class="cols">${cols}</div></div>`;
  });
  el.innerHTML = cards.join("") || '<div class="muted">no questions</div>';
}

export async function renderHistory(el, onPick, currentId) {
  let asks = []; try { asks = await listAsks(); } catch {}
  el.innerHTML = asks.slice(0, 100).map(a => `<div class="row-item${currentId === a.id ? " current" : ""}" data-id="${esc(a.id)}"><span>${esc(a.title)}</span><span class="tag">${Object.keys(a.questions || {}).length} q · ${esc((a.models || []).join(", "))}</span></div>`).join("") || '<div class="muted small">Nothing asked yet in this browser.</div>';
  el.querySelectorAll(".row-item").forEach(r => r.addEventListener("click", () => onPick(asks.find(a => a.id === r.dataset.id))));
}
