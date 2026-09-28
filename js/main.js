// jeb street: the page controller. Hash routes, the garage, the game views, the text and app tools, rides and run-all.
import { GAMES, REGISTRY } from "./games/index.js";
import { loadCars, saveCars, currentCarId, setCurrentCar, carById, newCarId, probe, DEFAULT_CARS } from "./models.js";
import { createRide, step, summary } from "./runner.js";
import { RENDERERS, EMPTY, esc, renderProbabilities } from "./render.js";
import { putRide, getRide, deleteRide, listRides, listRuns, deleteRun, download } from "./store.js";
import { loadPresets, decide, renderAsk, renderHistory } from "./apps/text.js";
import { loadCatalog, rankApps, renderApps } from "./apps/apps.js";
import { Triage, renderStories } from "./apps/triage.js";
import { analyse, draw } from "./apps/calibration.js";
import { runAll, PLAN } from "./runall.js";

const $ = id => document.getElementById(id);
const fmtStatus = s => (s || "").replaceAll("_", " ");
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---- state --------------------------------------------------------------------------------------------------------
let cars = loadCars(); const carInfo = {};          // id -> probe result
let view = "home", gameKey = "snake";
let session = null, ride = null, index = 0, timer = null, stepping = false, abort = null;
let bundledIndex = null;                            // data/rides/index.json
const triage = new Triage();

const readyCars = () => cars.filter(c => carInfo[c.id] && carInfo[c.id].ready);
const currentCar = () => { const id = currentCarId(); return carById(cars, id) || readyCars()[0] || null; };
const carWithInfo = car => car ? { ...car, ...(carInfo[car.id] || {}) } : null;

// ---- routing ------------------------------------------------------------------------------------------------------
const VIEWS = ["home", "garage", "game", "text", "apps", "triage", "calibration", "runall", "rides"];
function route() {
  const h = location.hash.replace(/^#\/?/, ""); const [head, arg] = h.split("/");
  stop();
  if (head === "g" && REGISTRY[arg]) { view = "game"; gameKey = arg; }
  else if (head === "ride" && arg) { view = "game"; openRide(arg); }
  else if (VIEWS.includes(head) && head !== "game") view = head;
  else view = "home";
  VIEWS.forEach(v => $(`view-${v}`).classList.toggle("active", v === view));
  document.querySelectorAll(".strip a").forEach(a => a.classList.toggle("active", a.dataset.route === (view === "game" ? `g/${gameKey}` : view)));
  window.scrollTo({ top: Math.min(window.scrollY, 260) });
  ({ home: renderHome, garage: renderGarage, game: enterGame, text: enterText, apps: enterApps, triage: enterTriage, calibration: enterCalibration, runall: enterRunAll, rides: enterRides })[view]();
}
const go = path => { location.hash = `#/${path}`; };

// ---- garage ---------------------------------------------------------------------------------------------------
async function probeAll() {
  await Promise.all(cars.map(async c => { carInfo[c.id] = await probe(c); }));
  renderCarPills(); if (view === "garage") renderGarage(); fillCarSelects();
}
function renderCarPills() {
  $("car-pills").innerHTML = cars.map(c => { const i = carInfo[c.id] || {}; const cls = i.ready ? "ready" : (i.error ? "down" : "loading");
    return `<span class="pill" title="${esc(i.error || i.modelName || "")}"><span class="dot ${cls}"></span>${esc(c.name)}${i.ready ? ` · ${esc(i.modelName || "")}` : ""}</span>`; }).join("") || '<span class="pill"><span class="dot down"></span>no cars</span>';
}
function fillCarSelects() {
  document.querySelectorAll("select[data-cars]").forEach(sel => {
    const allowAll = sel.dataset.cars === "all", allowNone = sel.dataset.cars === "opponent"; const before = sel.value || currentCarId();
    sel.innerHTML = (allowAll ? '<option value="*">every ready car (compare)</option>' : "") + (allowNone ? '<option value="">built-in opponent (win-or-block)</option>' : "")
      + cars.map(c => { const i = carInfo[c.id] || {}; return `<option value="${esc(c.id)}" ${i.ready ? "" : "disabled"}>${esc(c.name)}${i.ready ? ` (${esc(i.modelName || "")})` : " (offline)"}</option>`; }).join("");
    if ([...sel.options].some(o => o.value === before && !o.disabled)) sel.value = before; else { const first = readyCars()[0]; sel.value = allowNone ? "" : (allowAll && !first ? "*" : (first ? first.id : "")); }
  });
  const any = readyCars().length > 0;
  ["new-game", "ask", "runall-start"].forEach(id => { if ($(id)) $(id).disabled = !any; });
}
function renderGarage() {
  $("cars").innerHTML = cars.map(c => { const i = carInfo[c.id] || {}; const cls = i.ready ? "ready" : (i.error ? "down" : "loading");
    return `<div class="car${currentCarId() === c.id ? " current" : ""}" data-id="${esc(c.id)}">
      <div class="car-head"><span class="dot ${cls}"></span><b>${esc(c.name)}</b><span class="cat">${esc(c.kind === "typesafe" ? "TypeSafe" : "systemone")}</span><span class="grow"></span>
        <button class="small-btn" data-act="use">${currentCarId() === c.id ? "driving" : "drive this"}</button><button class="small-btn" data-act="edit">edit</button><button class="small-btn" data-act="probe">check</button><button class="small-btn danger" data-act="delete">remove</button></div>
      <div class="car-meta">${esc(c.url)}${c.kind === "typesafe" ? ` · model ${esc(c.model || "jev-latest")} · key ${c.apiKey ? "set" : "missing"}` : ""}${i.ready ? ` · <span class="ok">${esc(i.modelName || "ready")}${i.device ? ` on ${esc(i.device)}` : ""}${i.temperature != null ? ` · T ${i.temperature}` : ""}</span>` : (i.error ? ` · <span class="bad">${esc(i.error)}</span>` : " · checking…")}${c.note ? `<br><span class="muted">${esc(c.note)}</span>` : ""}</div></div>`; }).join("");
  $("cars").querySelectorAll("button").forEach(b => b.addEventListener("click", async () => {
    const id = b.closest(".car").dataset.id; const car = carById(cars, id);
    if (b.dataset.act === "use") { setCurrentCar(id); renderGarage(); fillCarSelects(); }
    else if (b.dataset.act === "edit") editCar(car);
    else if (b.dataset.act === "probe") { carInfo[id] = { loading: true }; renderGarage(); carInfo[id] = await probe(car); renderGarage(); renderCarPills(); fillCarSelects(); }
    else if (b.dataset.act === "delete") { cars = cars.filter(c => c.id !== id); saveCars(cars); delete carInfo[id]; renderGarage(); renderCarPills(); fillCarSelects(); }
  }));
}
function editCar(car) {
  $("car-form").dataset.id = car ? car.id : ""; $("car-name").value = car ? car.name : ""; $("car-kind").value = car ? car.kind : "systemone";
  $("car-url").value = car ? car.url : "http://127.0.0.1:8001"; $("car-model").value = car ? (car.model || "") : ""; $("car-key").value = car ? (car.apiKey || "") : ""; $("car-note").value = car ? (car.note || "") : "";
  $("car-form").classList.add("open"); $("car-form-title").textContent = car ? `Edit ${car.name}` : "Add a car"; onKindChange();
}
function onKindChange() { const ts = $("car-kind").value === "typesafe"; $("car-key-row").style.display = ts ? "" : "none"; $("car-model-row").style.display = ts ? "" : "none"; if (ts && !$("car-url").value.includes("typesafe")) $("car-url").value = "https://api.typesafe.ai"; if (ts && !$("car-model").value) $("car-model").value = "jev-latest"; }
async function saveCarForm(e) {
  e.preventDefault();
  const id = $("car-form").dataset.id || newCarId();
  const car = { id, name: $("car-name").value.trim() || "unnamed car", kind: $("car-kind").value, url: $("car-url").value.trim().replace(/\/+$/, ""), model: $("car-model").value.trim() || undefined, apiKey: $("car-key").value.trim() || undefined, note: $("car-note").value.trim() || undefined };
  const i = cars.findIndex(c => c.id === id); if (i >= 0) cars[i] = car; else cars.push(car); saveCars(cars);
  $("car-form").classList.remove("open"); if (!currentCarId()) setCurrentCar(id);
  renderGarage(); carInfo[id] = await probe(car); renderGarage(); renderCarPills(); fillCarSelects();
}

// ---- home -----------------------------------------------------------------------------------------------------
async function renderHome() {
  const idx = await bundled();
  const byGame = {}; idx.forEach(r => { (byGame[r.game] = byGame[r.game] || []).push(r); });
  $("app-grid").innerHTML = GAMES.map(g => { const rides = byGame[g.key] || []; const best = rides[0];
    return `<a class="sign app" href="#/g/${g.key}"><div class="sign-title">${esc(g.title)}</div><div class="sign-sub">${esc(g.blurb)}</div><div class="sign-foot">${rides.length ? `${rides.length} ride${rides.length === 1 ? "" : "s"} · best ${best.score} ${esc(best.score_label)} by ${esc(best.model)}` : "no rides yet"}</div></a>`; }).join("")
    + `<a class="sign app tool" href="#/text"><div class="sign-title">Text decisions</div><div class="sign-sub">Paste a text, define typed questions, read every answer from one forward pass. Compare cars side by side.</div><div class="sign-foot">8 presets</div></a>`
    + `<a class="sign app tool" href="#/apps"><div class="sign-title">App picker</div><div class="sign-sub">PostHog's "Filter by jev": 69 apps, one yes/no question each, ranked by what you type.</div><div class="sign-foot">PR 106730</div></a>`
    + `<a class="sign app tool" href="#/triage"><div class="sign-title">HN triage</div><div class="sign-sub">Every new Hacker News story classified as it arrives; low-confidence calls go to a review lane.</div><div class="sign-foot">live, from the public API</div></a>`
    + `<a class="sign app tool" href="#/calibration"><div class="sign-title">Calibration</div><div class="sign-sub">Is the model's top probability an honest forecast? Reliability curves over every ride.</div><div class="sign-foot">${idx.length} bundled rides</div></a>`;
}

// ---- rides (bundled + yours) --------------------------------------------------------------------------------------
async function bundled() { if (!bundledIndex) { try { bundledIndex = await (await fetch("data/rides/index.json")).json(); } catch { bundledIndex = []; } } return bundledIndex; }
async function allRideSummaries(game) {
  const b = (await bundled()).filter(r => !game || r.game === game).map(r => ({ ...r, source: "bundled" }));
  let mine = []; try { mine = (await listRides()).filter(r => !game || r.game === game).map(r => ({ ...r, source: "you" })); } catch {}
  return mine.concat(b).sort((x, y) => (y.created_at || "").localeCompare(x.created_at || ""));
}
async function loadRideById(id) {
  try { const mine = await getRide(id); if (mine) return { ...mine, source: "you" }; } catch {}
  const entry = (await bundled()).find(r => r.id === id); if (!entry) return null;
  const full = await (await fetch(`data/rides/${entry.file}`)).json(); return { ...entry, ...full, source: "bundled" };
}
async function openRide(id) {
  const r = await loadRideById(id); if (!r) return;
  if (session && session.ride.id !== id) session = null;
  gameKey = r.game; ride = r; index = ride.status === "playing" && session ? ride.frames.length - 1 : 0;
  document.querySelectorAll(".strip a").forEach(a => a.classList.toggle("active", a.dataset.route === `g/${gameKey}`));
  renderGameChrome(); renderFrame(); setPlayLabel(); renderRideList();
}

// ---- game view ------------------------------------------------------------------------------------------------
const desc = () => REGISTRY[gameKey].describe();
const isLive = () => !!session && ride && ride.status === "playing";
const atEnd = () => ride && index >= ride.frames.length - 1;
function chips(s) {
  const d = REGISTRY[s.game] ? REGISTRY[s.game].describe() : null; let out = "";
  (d ? d.options : []).forEach(o => { const v = (s.options || {})[o.key]; if (v === undefined || v === null || v === o.default || v === false || v === "none") return; out += `<span class="chip">${esc(v === true ? o.label : `${o.label}:${String(v).replace("_", " ")}`)}</span>`; });
  return out + `<span class="chip model">${esc(s.model || "?")}</span>` + (s.opponent ? `<span class="chip model">vs ${esc(s.opponent)}</span>` : "");
}
function enterGame() { if (ride && ride.game !== gameKey) { ride = null; session = null; } renderGameChrome(); renderFrame(); setPlayLabel(); renderRideList(); }
function renderGameChrome() {
  const d = desc(); $("game-title").textContent = d.title; $("game-blurb").textContent = d.blurb; $("max-turns").value = d.defaultMaxTurns; $("max-turns").max = d.maxTurnsLimit; $("score-label").textContent = d.scoreLabel;
  const saved = ls.get(`jebst-options-${gameKey}`, {});
  $("options").innerHTML = d.options.map(o => { const v = saved[o.key] ?? o.default, id = `opt-${o.key}`, label = `<abbr title="${esc(o.help || "")}">${esc(o.label)}</abbr>`;
    if (o.kind === "bool") return `<label><input type="checkbox" id="${id}" ${v ? "checked" : ""}> ${label}</label>`;
    if (o.kind === "int") return `<label>${label} <input type="number" id="${id}" value="${v}" min="${o.min ?? ""}" max="${o.max ?? ""}"></label>`;
    return `<label>${label} <select id="${id}" class="small">${o.values.map(x => `<option value="${esc(x)}" ${x === v ? "selected" : ""}>${esc(String(x).replace("_", " "))}</option>`).join("")}</select></label>`; }).join("");
  $("opponent-row").style.display = d.opponent ? "" : "none";
  $("speed").value = d.realtime ? "0" : (ls.get("jebst-speed", "0"));
}
const optionValues = () => Object.fromEntries(desc().options.map(o => { const el = $(`opt-${o.key}`); return [o.key, !el ? o.default : o.kind === "bool" ? el.checked : o.kind === "int" ? Number(el.value) : el.value]; }));
function renderFrame() {
  const board = $("board"); const d = desc();
  if (!ride) { RENDERERS[gameKey](board, EMPTY[gameKey] || {}); $("probabilities").innerHTML = ""; $("confidence").textContent = ""; $("override-note").textContent = ""; $("state-text").textContent = ""; $("question-text").textContent = "";
    $("timeline").max = 0; $("timeline").value = 0; $("position").textContent = "0 / 0"; $("mode").textContent = "—"; $("turn").textContent = "0"; $("score").textContent = "0"; $("move").textContent = "—"; $("latency").textContent = "— ms"; $("event").textContent = ""; $("extra-label").textContent = ""; $("extra").textContent = "";
    $("result").className = "panel result"; $("result").innerHTML = `Pick a car in the <a href="#/garage">garage</a>, or hop into someone else's ride below.`; return; }
  const f = ride.frames[index]; const extra = RENDERERS[ride.game](board, f) || [];
  $("turn").textContent = f.turn; $("score").textContent = f.score; $("move").textContent = f.action || "—";
  $("latency").textContent = f.action && f.latency_ms ? `${Math.round(f.latency_ms)} ms` : (f.action ? "no call" : "— ms");
  $("event").textContent = f.event || (f.status !== "playing" ? fmtStatus(f.status) : "");
  if (extra.length) { $("extra-label").textContent = extra[0][0]; $("extra").textContent = extra[0][1]; } else { $("extra-label").textContent = ""; $("extra").textContent = ""; }
  $("state-text").textContent = f.state_text || "";
  $("question-text").textContent = f.question ? `\nQuestion: ${f.question.instructions}\n` + Object.entries(f.question.criteria || {}).map(([k, v]) => `  (${k})${v ? ": " + v : ""}`).join("\n") : "";
  $("override-note").textContent = f.overridden ? `harness override: model chose ${f.model_choice}, played ${f.action}` : "";
  $("confidence").textContent = f.action && f.confidence != null ? `confidence ${Number(f.confidence).toFixed(2)}${f.certainty != null ? ` · certainty ${Number(f.certainty).toFixed(2)}` : ""} · top probability ${(Number(f.x_p_max ?? Math.max(0, ...Object.values(f.probabilities || { a: 0 }))) * 100).toFixed(1)}%` : "";
  renderProbabilities($("probabilities"), f);
  $("timeline").max = ride.frames.length - 1; $("timeline").value = index; $("position").textContent = `${index} / ${ride.frames.length - 1}`;
  $("mode").textContent = isLive() ? "live" : "replay";
  const s = session ? summary(session.ride) : ride; const finished = s.status !== "playing";
  $("result").className = "panel result";
  $("result").innerHTML = (finished ? `<strong>${s.score} ${esc(s.score_label || d.scoreLabel)} in ${s.turns} turns</strong>${chips(s)}<br>${fmtStatus(s.status)} · seed ${s.seed} · median ${s.median_decision_ms ?? "—"} ms/decision · ${esc((s.device || "?").toUpperCase())}`
    : `<strong>Live · seed ${s.seed}</strong>${chips(s)}<br>${s.turns} of ${s.max_turns} turns · ${s.score} ${esc(s.score_label || d.scoreLabel)} · median ${s.median_decision_ms ?? "—"} ms/decision`)
    + (s.overrides ? ` · ${s.overrides} override${s.overrides === 1 ? "" : "s"}` : "") + (s.source === "bundled" ? ` · <span class="muted">someone else's ride</span>` : "")
    + `<div class="result-actions"><button class="small-btn" id="export-ride">export JSON</button>${s.source !== "bundled" ? `<button class="small-btn" id="share-ride">${ride.shared ? "shared ✓" : "mark as shared"}</button><button class="small-btn danger" id="delete-ride">delete</button>` : ""}</div>`;
  $("export-ride").addEventListener("click", () => download(`${ride.id}.json`, ride));
  if ($("share-ride")) $("share-ride").addEventListener("click", async () => { ride.shared = !ride.shared; await putRide(ride); renderFrame(); });
  if ($("delete-ride")) $("delete-ride").addEventListener("click", async () => { await deleteRide(ride.id); ride = null; session = null; renderFrame(); renderRideList(); });
}
const setPlayLabel = () => { $("play").textContent = timer || stepping ? "Pause" : (isLive() ? "Play" : "Replay"); };
const stop = () => { clearTimeout(timer); timer = null; if (abort) { abort.abort(); abort = null; } setPlayLabel(); };
async function stepLive() {
  if (!isLive() || stepping) return false; stepping = true; $("board").classList.add("thinking"); abort = new AbortController();
  try { const { done, frame } = await step(session, { signal: abort.signal }); ride = session.ride; index = ride.frames.length - 1; renderFrame(); if (done || ride.turns % 5 === 0) { try { await putRide(ride); } catch {} } if (done) { stop(); renderRideList(); } return !done; }
  catch (e) { if (e.name !== "AbortError") { stop(); $("result").className = "panel result error"; $("result").textContent = `Step failed. ${e.message}`; } return false; }
  finally { stepping = false; $("board").classList.remove("thinking"); abort = null; }
}
async function tick() {
  if (!ride) { stop(); return; }
  if (index < ride.frames.length - 1) { index += 1; renderFrame(); }
  else if (isLive()) { const more = await stepLive(); if (!more) return; }
  else { stop(); return; }
  if (timer !== null) timer = setTimeout(tick, Number($("speed").value));
}
function play() { if (!ride) return; if (timer) { stop(); return; } if (!isLive() && atEnd()) index = 0; renderFrame(); timer = setTimeout(tick, 40); setPlayLabel(); }
function newGame() {
  stop(); const car = carWithInfo(carById(cars, $("model").value) || currentCar()); if (!car) return;
  const d = desc(); const seedText = $("seed").value.trim(); const seed = seedText === "" ? Math.floor(Math.random() * 1e6) : Number(seedText);
  const opponentSel = $("opponent").value; const opponent = d.opponent && opponentSel ? carWithInfo(carById(cars, opponentSel)) : null;
  const options = optionValues(); ls.set(`jebst-options-${gameKey}`, options); setCurrentCar(car.id);
  try { session = createRide({ game: gameKey, seed, maxTurns: Math.min(d.maxTurnsLimit, Math.max(1, Number($("max-turns").value) || d.defaultMaxTurns)), options, car, opponent }); }
  catch (e) { $("result").className = "panel result error"; $("result").textContent = e.message; return; }
  ride = session.ride; index = 0; renderFrame(); renderRideList(); play();
}
async function renderRideList() {
  const rides = await allRideSummaries(gameKey); $("rides-count").textContent = rides.length;
  $("ride-list").innerHTML = rides.map(s => { const cur = ride && ride.id === s.id ? " current" : "", live = s.status === "playing" && session && session.ride.id === s.id;
    return `<div class="row-item${cur}" data-id="${esc(s.id)}"><span>seed ${s.seed} · ${s.score} ${esc(s.score_label)} · ${s.turns} turns · ${fmtStatus(s.status)}${chips(s)}${s.overrides ? `<span class="chip override">${s.overrides} ov</span>` : ""}</span><span class="tag${live ? " live" : s.source === "you" ? " you" : ""}">${live ? "LIVE" : s.source === "you" ? (s.shared ? "yours · shared" : "yours") : "their ride"}</span></div>`; }).join("") || '<div class="muted small">No rides for this game yet.</div>';
  $("ride-list").querySelectorAll(".row-item").forEach(r => r.addEventListener("click", () => { stop(); openRide(r.dataset.id); }));
}

// ---- text decisions -------------------------------------------------------------------------------------------
let presets = null, currentAsk = null;
async function enterText() {
  if (!presets) { presets = await loadPresets(); $("preset").innerHTML = '<option value="">custom</option>' + presets.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
    const saved = ls.get("jebst-text", null); if (saved && saved.state) { $("state").value = saved.state; $("questions").value = saved.questions; $("preset").value = saved.preset ?? ""; } else { $("preset").value = "0"; applyPreset(0); } }
  fillCarSelects(); renderHistory($("ask-list"), a => { $("state").value = typeof a.state === "string" ? a.state : JSON.stringify(a.state, null, 2); $("questions").value = JSON.stringify(a.questions, null, 2); $("preset").value = ""; renderAsk($("results"), a); currentAsk = a; }, currentAsk && currentAsk.id);
}
const applyPreset = i => { const p = presets[i]; if (!p) return; $("state").value = p.state; $("questions").value = JSON.stringify(p.questions, null, 2); questionsValid(); };
const questionsValid = () => { try { const q = JSON.parse($("questions").value); $("questions").classList.remove("invalid"); return q && typeof q === "object" && Object.keys(q).length ? q : null; } catch { $("questions").classList.add("invalid"); return null; } };
async function askNow() {
  const questions = questionsValid(); const state = $("state").value; if (!questions) { $("ask-status").textContent = "questions must be a JSON object"; return; }
  ls.set("jebst-text", { state, questions: $("questions").value, preset: $("preset").value });
  const sel = $("text-model").value; const targets = sel === "*" ? readyCars() : [carById(cars, sel)].filter(Boolean); if (!targets.length) { $("ask-status").textContent = "no ready car"; return; }
  $("ask").disabled = true; $("ask-status").textContent = "asking…";
  try { const rec = await decide(targets.map(carWithInfo), state, questions); currentAsk = rec; renderAsk($("results"), rec); $("ask-status").textContent = rec.results.filter(r => r.answers).map(r => `${r.server}: ${Math.round(r.latency_ms)} ms`).join(" · ") || "no answers"; enterText(); }
  catch (e) { $("ask-status").textContent = String(e); } finally { $("ask").disabled = !readyCars().length; }
}

// ---- app picker -----------------------------------------------------------------------------------------------
let catalog = null, appScores = null, appMeta = null, rankTimer = null, rankSeq = 0;
const stars = () => new Set(ls.get("jebst-stars", []));
async function enterApps() {
  if (!catalog) { catalog = await loadCatalog(); $("apps-examples").innerHTML = catalog.examples.map(x => `<button type="button" class="small-btn" data-q="${esc(x)}">${esc(x)}</button>`).join("");
    $("apps-examples").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { $("apps-query").value = b.dataset.q; clearTimeout(rankTimer); rankNow(); })); }
  fillCarSelects(); renderAppList();
}
const renderAppList = () => renderApps($("app-groups"), $("apps-title"), $("apps-count"), catalog, appScores, appMeta, stars(), name => { const s = stars(); s.has(name) ? s.delete(name) : s.add(name); ls.set("jebst-stars", [...s]); renderAppList(); });
async function rankNow() {
  const query = $("apps-query").value.trim(); const seq = ++rankSeq; const car = carWithInfo(carById(cars, $("apps-model").value) || currentCar());
  if (!query || !car) { appScores = null; appMeta = null; $("apps-status").textContent = car ? "" : "no ready car"; renderAppList(); return; }
  $("apps-status").textContent = `ranking ${catalog.apps.length} apps…`;
  try { const r = await rankApps(car, query); if (seq !== rankSeq) return; appScores = r.scores; appMeta = { ...r, query }; $("apps-status").textContent = ""; renderAppList(); }
  catch (e) { if (seq === rankSeq) $("apps-status").textContent = `ranking failed: ${e.message}`; }
}

// ---- triage ---------------------------------------------------------------------------------------------------
let triageTimer = null;
function enterTriage() { fillCarSelects(); renderTriage(); }
const renderTriage = () => renderStories($("stories"), $("triage-count"), $("triage-topics"), triage.items, Number($("triage-threshold").value));
async function pollTriage() {
  const car = carWithInfo(carById(cars, $("triage-model").value) || currentCar()); if (!car) { $("triage-status").textContent = "no ready car"; return; }
  $("triage-status").textContent = "fetching new stories and classifying…"; $("triage-poll").disabled = true;
  try { const before = triage.items.length; await triage.poll(car, triage.items.length ? 8 : 16); renderTriage(); $("triage-status").textContent = `${new Date().toLocaleTimeString()} · ${triage.items.length - before} new · ${car.name}`; }
  catch (e) { $("triage-status").textContent = String(e.message || e); } finally { $("triage-poll").disabled = false; }
  clearTimeout(triageTimer); if ($("triage-auto").checked && view === "triage") triageTimer = setTimeout(pollTriage, 20000);
}

// ---- calibration ----------------------------------------------------------------------------------------------
async function enterCalibration() {
  const gameSel = $("calib-game"); if (gameSel.options.length <= 1) gameSel.innerHTML = '<option value="">all games</option>' + GAMES.map(g => `<option value="${g.key}">${esc(g.title)}</option>`).join("");
  $("calib-status").textContent = "loading rides…";
  const summaries = await allRideSummaries(gameSel.value || null);
  const models = [...new Set(summaries.map(s => s.model))].sort(); const msel = $("calib-model"), was = msel.value; msel.innerHTML = '<option value="">all cars</option>' + models.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join(""); msel.value = was;
  const chosen = summaries.filter(s => !msel.value || s.model === msel.value).slice(0, 120);
  const full = (await Promise.all(chosen.map(s => loadRideById(s.id)))).filter(Boolean);
  draw($("calib-chart"), $("calib-tip"), $("calib-legend"), $("calib-kpis"), $("calib-status"), analyse(full, Number($("calib-horizon").value)));
}

// ---- run all --------------------------------------------------------------------------------------------------
let runAbort = null;
async function enterRunAll() { fillCarSelects(); $("runall-plan").innerHTML = PLAN.map(p => `<li>${esc(p.label)}</li>`).join(""); renderRuns(); }
async function renderRuns() {
  let runs = []; try { runs = await listRuns(); } catch {}
  $("runs").innerHTML = runs.map(r => `<div class="run-card"><div class="car-head"><b>${esc(r.model)}</b><span class="muted small">${new Date(r.created_at).toLocaleString()}</span><span class="grow"></span><button class="small-btn" data-act="export" data-id="${esc(r.id)}">export JSON</button><button class="small-btn danger" data-act="delete" data-id="${esc(r.id)}">delete</button></div>${scorecard(r)}</div>`).join("") || '<div class="muted small">No runs yet in this browser.</div>';
  $("runs").querySelectorAll("button").forEach(b => b.addEventListener("click", async () => { const r = runs.find(x => x.id === b.dataset.id); if (b.dataset.act === "export") { const rides = (await Promise.all((r.rides || []).map(id => getRide(id)))).filter(Boolean); download(`${r.id}.json`, { ...r, ride_data: rides }); } else { await deleteRun(r.id); renderRuns(); } }));
}
const scorecard = r => `<table class="score"><tr><th>app</th><th>score</th><th>games</th><th>turns</th><th>median ms</th><th>outcome</th></tr>${r.rows.map(x => `<tr><td>${esc(x.app)}<div class="muted small">${esc(x.label)}</div></td><td><b>${x.score}</b> <span class="muted small">${esc(x.score_label)}</span></td><td>${x.games}</td><td>${x.turns}</td><td>${x.median_ms ?? "—"}</td><td class="small">${x.statuses.map(esc).join(", ")}</td></tr>`).join("")}</table>`;
async function startRunAll() {
  const car = carWithInfo(carById(cars, $("runall-model").value) || currentCar()); if (!car) return;
  runAbort = new AbortController(); $("runall-start").disabled = true; $("runall-stop").disabled = false; $("runall-live").innerHTML = ""; $("runall-result").innerHTML = "";
  const liveBoard = $("runall-board");
  try {
    const run = await runAll(car, { signal: runAbort.signal,
      onProgress: p => { $("runall-progress").style.width = `${(p.fraction * 100).toFixed(0)}%`; $("runall-status").textContent = `${p.label}${p.detail ? ` · ${p.detail}` : ""}`; },
      onFrame: (s, f) => { if (RENDERERS[s.ride.game]) { RENDERERS[s.ride.game](liveBoard, f); $("runall-live").textContent = `${s.ride.game_title}: turn ${f.turn}, ${f.score} ${s.ride.score_label}${f.action ? `, ${f.action} (${Math.round(f.latency_ms)} ms)` : ""}`; } } });
    $("runall-result").innerHTML = `<h3>Scorecard · ${esc(run.model)}</h3>${scorecard(run)}<div class="result-actions"><button class="small-btn" id="runall-export">export JSON (with rides)</button></div>`;
    $("runall-export").addEventListener("click", async () => { const rides = (await Promise.all(run.rides.map(id => getRide(id)))).filter(Boolean); download(`${run.id}.json`, { ...run, ride_data: rides }); });
    renderRuns();
  } catch (e) { $("runall-status").textContent = e.name === "AbortError" ? "stopped" : `failed: ${e.message}`; }
  finally { $("runall-start").disabled = !readyCars().length; $("runall-stop").disabled = true; runAbort = null; }
}

// ---- rides view -----------------------------------------------------------------------------------------------
async function enterRides() {
  const rides = await allRideSummaries(null); const filter = $("rides-filter").value;
  const shown = rides.filter(r => filter === "all" || (filter === "you" ? r.source === "you" : r.source === "bundled"));
  $("all-rides").innerHTML = shown.map(s => `<div class="row-item" data-id="${esc(s.id)}"><span><b>${esc(REGISTRY[s.game] ? REGISTRY[s.game].title : s.game)}</b> · seed ${s.seed} · ${s.score} ${esc(s.score_label)} · ${s.turns} turns · ${fmtStatus(s.status)}${chips(s)}</span><span class="tag${s.source === "you" ? " you" : ""}">${s.source === "you" ? (s.shared ? "yours · shared" : "yours") : "their ride"}</span></div>`).join("") || '<div class="muted small">nothing here</div>';
  $("all-rides").querySelectorAll(".row-item").forEach(r => r.addEventListener("click", () => go(`ride/${r.dataset.id}`)));
  $("rides-summary").textContent = `${rides.filter(r => r.source === "you").length} yours · ${rides.filter(r => r.source === "bundled").length} bundled`;
}
async function importRide(file) {
  const data = JSON.parse(await file.text()); const rides = data.ride_data || (Array.isArray(data) ? data : [data]);
  for (const r of rides) if (r && r.id && r.frames) await putRide({ ...r, source: undefined, imported: true });
  enterRides();
}

// ---- wiring ---------------------------------------------------------------------------------------------------
window.addEventListener("hashchange", route);
$("new-game").addEventListener("click", newGame);
$("play").addEventListener("click", play);
$("previous").addEventListener("click", () => { stop(); if (ride) { index = Math.max(0, index - 1); renderFrame(); } });
$("next").addEventListener("click", () => { stop(); if (!ride) return; if (atEnd()) { if (isLive()) stepLive().then(setPlayLabel); } else { index += 1; renderFrame(); } });
$("timeline").addEventListener("input", e => { stop(); if (ride) { index = Number(e.target.value); renderFrame(); } });
$("speed").addEventListener("change", () => ls.set("jebst-speed", $("speed").value));
$("model").addEventListener("change", () => setCurrentCar($("model").value));
document.addEventListener("keydown", e => { if (view !== "game" || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return; if (e.key === "ArrowLeft") $("previous").click(); if (e.key === "ArrowRight") $("next").click(); if (e.key === " ") { e.preventDefault(); $("play").click(); } if (e.key.toLowerCase() === "n" && !$("new-game").disabled) newGame(); });
$("add-car").addEventListener("click", () => editCar(null));
$("car-form").addEventListener("submit", saveCarForm);
$("car-cancel").addEventListener("click", () => $("car-form").classList.remove("open"));
$("car-kind").addEventListener("change", onKindChange);
$("probe-all").addEventListener("click", probeAll);
$("reset-cars").addEventListener("click", () => { cars = DEFAULT_CARS.map(c => ({ ...c })); saveCars(cars); probeAll(); });
$("preset").addEventListener("change", e => { if (e.target.value !== "") applyPreset(Number(e.target.value)); });
$("questions").addEventListener("input", questionsValid);
$("ask").addEventListener("click", askNow);
$("apps-query").addEventListener("input", () => { clearTimeout(rankTimer); rankTimer = setTimeout(rankNow, 600); });
$("apps-model").addEventListener("change", () => { if ($("apps-query").value.trim()) rankNow(); });
$("triage-poll").addEventListener("click", pollTriage);
$("triage-threshold").addEventListener("input", () => { $("triage-threshold-value").textContent = Number($("triage-threshold").value).toFixed(2); renderTriage(); });
$("triage-reset").addEventListener("click", () => { triage.reset(); renderTriage(); });
["calib-game", "calib-model"].forEach(id => $(id).addEventListener("change", enterCalibration));
$("calib-horizon").addEventListener("input", () => { $("calib-horizon-value").textContent = $("calib-horizon").value; });
$("calib-horizon").addEventListener("change", enterCalibration);
$("runall-start").addEventListener("click", startRunAll);
$("runall-stop").addEventListener("click", () => runAbort && runAbort.abort());
$("rides-filter").addEventListener("change", enterRides);
$("import-ride").addEventListener("change", e => { if (e.target.files[0]) importRide(e.target.files[0]); e.target.value = ""; });

renderCarPills(); fillCarSelects(); route(); probeAll(); setInterval(probeAll, 30000);
