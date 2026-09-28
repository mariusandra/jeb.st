// Live triage of Hacker News submissions, straight from the browser: the public HN API allows cross-origin reads.
import { ask } from "../models.js";
import { esc } from "../render.js";

const HN = "https://hacker-news.firebaseio.com/v0";
export const QUESTIONS = {
  topic: { type: "choice", instructions: "Which topic does this Hacker News submission belong to?",
    criteria: { ai_ml: "artificial intelligence, machine learning, LLMs, model releases", programming: "programming languages, libraries, software engineering practice, developer tools",
      security_privacy: "vulnerabilities, breaches, cryptography, surveillance, privacy", startups_business: "companies, funding, markets, management, careers, the tech industry",
      science: "physics, biology, medicine, space, mathematics, research outside computing", society_politics: "law, regulation, policy, culture, history, society",
      hardware: "chips, devices, gadgets, electronics, robotics, retro computing", other: "none of the above" } },
  kind: { type: "choice", instructions: "What kind of submission is this?",
    criteria: { show_or_launch: "Show HN, a product launch, a project someone built", ask_or_discussion: "Ask HN, a question or a request for opinions", news: "a news report about an event",
      essay_or_blog: "an essay, opinion piece or personal blog post", paper_or_reference: "a research paper, documentation or reference material", job_or_promotion: "hiring, a job post or marketing" } },
  frontpage: { type: "noul", instructions: "Would this story interest most Hacker News readers enough to reach the front page?" },
  technical: { type: "score", instructions: "How technical is this submission?", criteria: ["for a general audience", "somewhat technical", "deeply technical, for specialists"] },
};

const host = url => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return ""; } };
const decode = t => (t || "").replace(/<p>/g, "\n").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
export function stateText(item) {
  const url = item.url || ""; const lines = ["Hacker News submission", `Title: ${item.title || ""}`, `Site: ${url ? host(url) : "news.ycombinator.com (text post)"}`];
  if (url) { try { lines.push(`URL path: ${new URL(url).pathname.slice(0, 120)}`); } catch {} }
  const text = decode(item.text).trim(); if (text) lines.push(`Text: ${text.slice(0, 700)}`);
  lines.push(`Submitted by ${item.by || "?"}; ${item.score || 0} point(s), ${item.descendants || 0} comment(s) so far.`);
  return lines.join("\n");
}

export class Triage {
  constructor() { this.items = []; this.seen = new Set(); this.busy = false; }
  async poll(car, limit) {
    if (this.busy) return this.items; this.busy = true;
    try {
      const ids = await (await fetch(`${HN}/newstories.json`)).json();
      const fresh = ids.slice(0, 120).filter(i => !this.seen.has(i)).slice(0, limit);
      fresh.forEach(i => this.seen.add(i));
      const rows = await Promise.all(fresh.map(async id => {
        let item; try { item = await (await fetch(`${HN}/item/${id}.json`)).json(); } catch { return null; }
        if (!item || item.type !== "story" || item.dead || item.deleted || !item.title) return null;
        const state = stateText(item); let answers = null, error = null, latency = 0;
        try { const r = await ask(car, state, QUESTIONS); answers = r.answers; latency = r.latencyMs; } catch (e) { error = e.message.slice(0, 200); }
        return { id, title: item.title, url: item.url, by: item.by, time: item.time, hn_url: `https://news.ycombinator.com/item?id=${id}`, host: item.url ? host(item.url) : null, text_post: !!item.text, state, answers, error, server: car.name, model: car.modelName, latency_ms: Math.round(latency), classified_at: new Date().toISOString() };
      }));
      const fresh_rows = rows.filter(Boolean).sort((a, b) => a.id - b.id);
      this.items = this.items.concat(fresh_rows).slice(-300);
      return this.items;
    } finally { this.busy = false; }
  }
  reset() { this.items = []; this.seen = new Set(); }
}

const topArg = probs => Object.entries(probs || {}).sort((a, b) => b[1] - a[1])[0] || ["?", 0];
export function renderStories(el, countEl, topicsEl, items, threshold) {
  const review = [], auto = [];
  items.forEach(it => { const t = it.answers && it.answers.topic ? topArg(it.answers.topic.probabilities)[1] : 0; (it.error || t < threshold ? review : auto).push(it); });
  const story = (it, weak) => {
    const a = it.answers || {}; const when = it.time ? new Date(it.time * 1000).toLocaleTimeString() : "";
    const badges = a.topic ? [`<span class="chip">${esc(topArg(a.topic.probabilities)[0])} ${(topArg(a.topic.probabilities)[1] * 100).toFixed(0)}%</span>`, `<span class="chip">${esc(topArg(a.kind.probabilities)[0])}</span>`, `<span class="chip">front page ${((a.frontpage.noul ?? a.frontpage.probability ?? 0) * 100).toFixed(0)}%</span>`, `<span class="chip">technical ${Number(a.technical.score).toFixed(1)}/2</span>`].join("") : (it.error ? `<span class="chip bad">${esc(it.error)}</span>` : "");
    return `<div class="story${weak ? " review" : ""}"><div class="t"><a href="${esc(it.url || it.hn_url)}" target="_blank" rel="noopener">${esc(it.title)}</a></div><div class="h">${esc(it.host || "text post")} · ${esc(it.by || "")} · ${when} · <a href="${esc(it.hn_url)}" target="_blank" rel="noopener">HN</a> · ${esc(it.server)} · ${it.latency_ms} ms</div><div class="badges">${badges}</div><details><summary>state the model saw</summary><pre>${esc(it.state || "")}</pre></details></div>`;
  };
  el.innerHTML = (review.length ? `<h3 class="lane">Review lane <span class="note">topic probability under ${threshold.toFixed(2)}</span></h3>` + review.slice().reverse().map(it => story(it, true)).join("") : "")
    + `<h3 class="lane">Auto-filed</h3>` + (auto.length ? auto.slice().reverse().map(it => story(it, false)).join("") : '<div class="muted small">nothing yet</div>');
  countEl.textContent = `${items.length} stories`;
  const counts = {}; items.forEach(it => { if (it.answers && it.answers.topic) { const k = topArg(it.answers.topic.probabilities)[0]; counts[k] = (counts[k] || 0) + 1; } });
  const total = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
  topicsEl.innerHTML = Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([k, n]) => `<div class="prob"><div class="prob-name">${esc(k)}</div><div class="prob-track"><div class="prob-fill" style="width:${(100 * n / total).toFixed(0)}%"></div></div><div class="prob-value">${n}</div></div>`).join("");
}
