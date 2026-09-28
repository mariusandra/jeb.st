// Recordings ("rides") and text asks, kept in this browser's IndexedDB. Nothing leaves the browser unless you export it.
const DB = "jebst"; const VERSION = 1;
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("rides")) { const s = db.createObjectStore("rides", { keyPath: "id" }); s.createIndex("game", "game"); s.createIndex("created_at", "created_at"); }
      if (!db.objectStoreNames.contains("asks")) db.createObjectStore("asks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("runs")) db.createObjectStore("runs", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
const tx = async (store, mode, fn) => { const db = await open(); return new Promise((resolve, reject) => { const t = db.transaction(store, mode); const r = fn(t.objectStore(store)); t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : r); t.onerror = () => reject(t.error); }); };
const all = async store => { const db = await open(); return new Promise((resolve, reject) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); };

export const putRide = ride => tx("rides", "readwrite", s => s.put(ride));
export const getRide = async id => { const db = await open(); return new Promise((resolve, reject) => { const r = db.transaction("rides").objectStore("rides").get(id); r.onsuccess = () => resolve(r.result || null); r.onerror = () => reject(r.error); }); };
export const deleteRide = id => tx("rides", "readwrite", s => s.delete(id));
export const listRides = async () => (await all("rides")).map(r => ({ ...r, frames: undefined, frameCount: r.frames ? r.frames.length : 0 }));
export const putAsk = ask => tx("asks", "readwrite", s => s.put(ask));
export const listAsks = async () => (await all("asks")).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
export const putRun = run => tx("runs", "readwrite", s => s.put(run));
export const listRuns = async () => (await all("runs")).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
export const deleteRun = id => tx("runs", "readwrite", s => s.delete(id));

export function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
