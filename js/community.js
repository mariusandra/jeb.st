// The submissions API: rides and runs other people drove, and yours once you submit them.
let status = null;
export async function available() {
  if (status !== null) return status;
  try { const j = await (await fetch("api/health")).json(); status = !!j.submissions; } catch { status = false; }
  return status;
}
const get = async (path) => { const r = await fetch(path); if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`); return r.json(); };
const post = async (path, body) => { const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`); return j; };

export const listRides = async (params = {}) => (await get(`api/rides?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}`)).rides;
export const getRide = id => get(`api/rides/${encodeURIComponent(id)}`);
export const listRuns = async (params = {}) => (await get(`api/runs?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}`)).runs;
export const getRun = id => get(`api/runs/${encodeURIComponent(id)}`);
export const models = async () => (await get("api/models")).models;
export const submitRide = (ride, driver, note) => post("api/rides", { ride: { ...ride, frames: ride.frames }, driver, note });
export const submitRun = (run, rides, driver, note) => post("api/runs", { run, rides, driver, note });

export const driver = { get() { try { return localStorage.getItem("jebst-driver") || ""; } catch { return ""; } }, set(v) { try { localStorage.setItem("jebst-driver", v); } catch {} } };
