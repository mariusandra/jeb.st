// The garage: the cars you can drive. A car is a /v1/systemone server (decider, imajev, jevk5, any TypeSafe-compatible
// endpoint) or TypeSafe's hosted Jev with your own key. Cars live in this browser's localStorage only.
const KEY = "jebst-cars";
const CURRENT = "jebst-car";

export const DEFAULT_CARS = [
  { id: "local-8001", name: "local car on :8001", kind: "systemone", url: "http://127.0.0.1:8001", note: "a decider / jevk5 / imajev server on this machine" },
  { id: "typesafe", name: "TypeSafe Jev (your key)", kind: "typesafe", url: "/ts", model: "jev-latest", apiKey: "", note: "the real thing, paid per request; goes through this site's /ts hop because api.typesafe.ai refuses browser calls" },
  { id: "posthog-us", name: "PostHog AI gateway (your phs_ key)", kind: "posthog", url: "https://gateway.us.posthog.com", model: "posthog/hogference/jevk5-fp8-0.2", apiKey: "", note: "PostHog's gateway serving JevK5; a project secret key with the llm_gateway:read scope; EU projects use gateway.eu.posthog.com" },
];
export const POSTHOG_DEFAULT_MODEL = "posthog/hogference/jevk5-fp8-0.2";
export const POSTHOG_GATEWAYS = { us: "https://gateway.us.posthog.com", eu: "https://gateway.eu.posthog.com" };

export function loadCars() {
  try {
    const cars = JSON.parse(localStorage.getItem(KEY) || "null");
    // cars saved by an earlier version pointed TypeSafe straight at api.typesafe.ai, which browsers cannot reach
    if (Array.isArray(cars) && cars.length) {
      const saved = cars.map(c => (c.kind === "typesafe" && /^https:\/\/api\.typesafe\.ai\/?$/.test(c.url || "") ? { ...c, url: "/ts" } : c));
      // a default car added in a later version (the PostHog gateway) joins a list saved earlier, unless it was removed on purpose
      const removed = new Set(JSON.parse(localStorage.getItem(KEY + "-removed") || "[]"));
      for (const d of DEFAULT_CARS) if (!saved.some(c => c.id === d.id) && !removed.has(d.id)) saved.push({ ...d });
      return saved;
    }
  } catch {}
  return DEFAULT_CARS.map(c => ({ ...c }));
}
export function saveCars(cars) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cars));
    localStorage.setItem(KEY + "-removed", JSON.stringify(DEFAULT_CARS.filter(d => !cars.some(c => c.id === d.id)).map(d => d.id)));
  } catch {}
}
export function currentCarId() { try { return localStorage.getItem(CURRENT) || ""; } catch { return ""; } }
export function setCurrentCar(id) { try { localStorage.setItem(CURRENT, id); } catch {} }
export const carById = (cars, id) => cars.find(c => c.id === id) || null;
export const newCarId = () => `car-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// A relative URL ("/ts") is this site's own relay; anything else is used as given.
export const carUrl = car => (car.url.startsWith("/") ? `${location.origin}${car.url.replace(/\/+$/, "")}` : car.url.replace(/\/+$/, ""));
const explain = (car, e) => {
  if (e.name === "AbortError") return "timeout";
  if (e.name !== "TypeError") return `${e.name}: ${e.message}`;
  if (car.url.startsWith("/")) return "this host has no /ts relay (deploy on Cloudflare Pages, or run tools/jebst-proxy.py --target https://api.typesafe.ai and point the car at it)";
  if (car.kind === "typesafe") return "api.typesafe.ai refuses browser calls; set the URL to /ts on jeb.st or run tools/jebst-proxy.py with --api-key";
  if (car.kind === "posthog") return "gateway unreachable (check the region host: gateway.us.posthog.com or gateway.eu.posthog.com)";
  if (/^http:\/\/(127\.0\.0\.1|localhost)/.test(car.url) && location.protocol === "https:") return "blocked: an https page can only reach a local server through tools/jebst-proxy.py (adds CORS and the private-network header); Chrome may also ask you to allow it";
  return "unreachable or blocked by CORS: put tools/jebst-proxy.py in front of the server";
};
const headers = car => {
  const h = { "content-type": "application/json" };
  if (car.apiKey) h.authorization = `Bearer ${car.apiKey}`;
  return h;
};

export async function probe(car, timeoutMs = 4000) {
  const info = { ready: false };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (car.kind === "typesafe") {
      if (!car.apiKey) { info.error = "no API key"; return info; }
      const r = await fetch(`${carUrl(car)}/v1/models`, { headers: headers(car), signal: ctrl.signal });
      info.ready = r.ok; info.modelName = car.model || "jev-latest"; info.device = "cloud";
      if (!r.ok) info.error = r.status === 401 || r.status === 403 ? `HTTP ${r.status}: the key was refused` : (r.status === 404 && car.url.startsWith("/") ? "no /ts relay on this host" : `HTTP ${r.status}`);
      return info;
    }
    if (car.kind === "posthog") {
      if (!car.apiKey) { info.error = "no API key (a phs_ project secret key with the llm_gateway:read scope)"; return info; }
      info.modelName = car.model || POSTHOG_DEFAULT_MODEL; info.device = "posthog gateway";
      const models = await fetch(`${carUrl(car)}/v1/models`, { headers: headers(car), signal: ctrl.signal });
      if (models.status === 401 || models.status === 403) { info.error = `HTTP ${models.status}: the key was refused`; return info; }
      // the only way to know the decision route works for this key is to ask it something tiny
      const r = await fetch(`${carUrl(car)}/v1/systemone`, { method: "POST", headers: headers(car), signal: ctrl.signal,
        body: JSON.stringify({ model: info.modelName, state: "2 + 2 = 4", questions: { probe: { type: "noul", instructions: "Is the statement true?" } } }) });
      if (r.ok) { const j = await r.json(); info.ready = true; info.modelName = j.model || info.modelName; return info; }
      info.error = r.status === 404 ? "gateway reachable, but /v1/systemone is not enabled for this key or region yet (PostHog is rolling the decision route out)" : r.status === 401 || r.status === 403 ? `HTTP ${r.status}: the key was refused` : `HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`;
      return info;
    }
    let health = null;
    try { const r = await fetch(`${carUrl(car)}/health`, { signal: ctrl.signal }); if (r.ok) health = await r.json(); } catch (e) { if (e.name === "AbortError") throw e; }
    if (health) { info.ready = !!health.ok; info.device = health.device; info.temperature = health.temperature; info.checkpoint = String(health.model || "").split("/").pop() || null; }
    const r = await fetch(`${carUrl(car)}/v1/models`, { signal: ctrl.signal });
    if (r.ok) {
      const listed = await r.json(); const models = Array.isArray(listed) ? listed : (listed.models || []);
      if (models.length && typeof models[0] === "object") info.modelName = models[0].name || models[0].id;
      else if (typeof listed.model === "string") info.modelName = listed.model;   // imajev's playground answers one object
      if (!health) info.ready = true;
    } else if (!health) info.error = `HTTP ${r.status}`;
    if (!info.modelName) info.modelName = info.checkpoint || car.name;
    return info;
  } catch (e) {
    info.error = explain(car, e);
    return info;
  } finally { clearTimeout(t); }
}

// One request: a state and typed questions -> {model, answers, usage}. latencyMs is measured here.
export async function ask(car, state, questions, { signal } = {}) {
  const body = { state, questions };
  if (car.kind === "typesafe" || car.kind === "posthog" || car.model) body.model = car.model || (car.kind === "posthog" ? POSTHOG_DEFAULT_MODEL : "jev-latest");
  const started = performance.now();
  let r;
  try { r = await fetch(`${carUrl(car)}/v1/systemone`, { method: "POST", headers: headers(car), body: JSON.stringify(body), signal }); }
  catch (e) { if (e.name === "AbortError") throw e; throw new Error(`${car.name}: ${explain(car, e)}`); }
  const latencyMs = performance.now() - started;
  if (!r.ok) { const text = await r.text(); throw new Error(`${car.name}: HTTP ${r.status} ${text.slice(0, 200)}`); }
  const json = await r.json();
  return { ...json, latencyMs };
}

// A Noul answer becomes a two-option Choice answer so games and the page see one shape.
export function normaliseAnswer(answer, noulOptions) {
  if (answer && (answer.type === "noul" || ("noul" in answer && !("choice" in answer)))) {
    const [yes, no] = noulOptions || ["yes", "no"]; const p = Math.max(0, Math.min(1, Number(answer.noul))); const top = Math.max(p, 1 - p);
    return { type: "choice", choice: p >= 0.5 ? yes : no, probabilities: { [yes]: p, [no]: 1 - p }, confidence: 2 * top - 1, certainty: 2 * top - 1, x_p_max: top, noul: p };
  }
  if (answer && !("x_p_max" in answer) && answer.probabilities) answer.x_p_max = Math.max(...Object.values(answer.probabilities));
  return answer;
}
