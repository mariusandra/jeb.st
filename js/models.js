// The garage: the cars you can drive. A car is a /v1/systemone server (decider, imajev, jevk5, any TypeSafe-compatible
// endpoint) or TypeSafe's hosted Jev with your own key. Cars live in this browser's localStorage only.
const KEY = "jebst-cars";
const CURRENT = "jebst-car";

export const DEFAULT_CARS = [
  { id: "local-8001", name: "local car on :8001", kind: "systemone", url: "http://127.0.0.1:8001", note: "a decider / jevk5 / imajev server on this machine" },
  { id: "typesafe", name: "TypeSafe Jev (your key)", kind: "typesafe", url: "https://api.typesafe.ai", model: "jev-latest", apiKey: "", note: "the real thing; paid per request" },
];

export function loadCars() {
  try { const cars = JSON.parse(localStorage.getItem(KEY) || "null"); if (Array.isArray(cars) && cars.length) return cars; } catch {}
  return DEFAULT_CARS.map(c => ({ ...c }));
}
export function saveCars(cars) { try { localStorage.setItem(KEY, JSON.stringify(cars)); } catch {} }
export function currentCarId() { try { return localStorage.getItem(CURRENT) || ""; } catch { return ""; } }
export function setCurrentCar(id) { try { localStorage.setItem(CURRENT, id); } catch {} }
export const carById = (cars, id) => cars.find(c => c.id === id) || null;
export const newCarId = () => `car-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

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
      const r = await fetch(`${car.url}/v1/models`, { headers: headers(car), signal: ctrl.signal });
      info.ready = r.ok; info.modelName = car.model || "jev-latest"; info.device = "cloud";
      if (!r.ok) info.error = `HTTP ${r.status}`;
      return info;
    }
    let health = null;
    try { const r = await fetch(`${car.url}/health`, { signal: ctrl.signal }); if (r.ok) health = await r.json(); } catch (e) { if (e.name === "AbortError") throw e; }
    if (health) { info.ready = !!health.ok; info.device = health.device; info.temperature = health.temperature; info.checkpoint = String(health.model || "").split("/").pop() || null; }
    const r = await fetch(`${car.url}/v1/models`, { signal: ctrl.signal });
    if (r.ok) {
      const listed = await r.json(); const models = Array.isArray(listed) ? listed : (listed.models || []);
      if (models.length && typeof models[0] === "object") info.modelName = models[0].name || models[0].id;
      else if (typeof listed.model === "string") info.modelName = listed.model;   // imajev's playground answers one object
      if (!health) info.ready = true;
    } else if (!health) info.error = `HTTP ${r.status}`;
    if (!info.modelName) info.modelName = info.checkpoint || car.name;
    return info;
  } catch (e) {
    info.error = e.name === "AbortError" ? "timeout" : (e.name === "TypeError" ? "unreachable or blocked by CORS" : `${e.name}: ${e.message}`);
    return info;
  } finally { clearTimeout(t); }
}

// One request: a state and typed questions -> {model, answers, usage}. latencyMs is measured here.
export async function ask(car, state, questions, { signal } = {}) {
  const body = { state, questions };
  if (car.kind === "typesafe" || car.model) body.model = car.model || "jev-latest";
  const started = performance.now();
  let r;
  try { r = await fetch(`${car.url}/v1/systemone`, { method: "POST", headers: headers(car), body: JSON.stringify(body), signal }); }
  catch (e) { if (e.name === "AbortError") throw e; throw new Error(`${car.name}: unreachable or blocked by CORS (${e.message})`); }
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
