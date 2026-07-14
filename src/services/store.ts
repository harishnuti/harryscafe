import { openDB, type IDBPDatabase } from 'idb';

export interface Keyword { id: string; text: string; weight: number; armed: boolean; concept: string }
export interface Criterion { id: string; text: string; weight: number }
export interface WishItem { id: string; name: string; area: string; lat?: number; lng?: number; placeId?: string; priority: 'HIGH'|'MEDIUM'|'LOW'; note: string; gateScore?: number; added: string }
export interface AuditRec { id: string; capturedAt: string; [k: string]: string }
export interface Examination { id: string; cafeName: string; placeId?: string; date: string; score: number; verdict: 'pass'|'fail' }
export interface CachedSearch { id: string; ts: number; originLat: number; originLng: number; radius: number; keywords: string[]; results: ScoredPlace[]; areaLabel: string }
export interface ScoredPlace { placeId: string; name: string; address: string; lat: number; lng: number; rating: number|null; reviews: number; openNow: boolean|null; primaryType: string; score: number; matched: string[]; concepts: string[]; distanceM: number; bonuses: string[]; breakdown: string }

const DB = 'gatekeeper'; const V = 2;
let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) dbp = openDB(DB, V, { upgrade(d) {
    for (const s of ['settings','keywords','criteria','wishlist','audits','searches','examinations', 'scans'])
      if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: s==='settings' ? 'key' : 'id' });
  }});
  return dbp;
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function getAll<T>(store: string): Promise<T[]> { try { return await (await db()).getAll(store) as T[]; } catch { return []; } }
export async function put(store: string, val: unknown) { try { await (await db()).put(store, val); } catch {} }
export async function del(store: string, key: string) { try { await (await db()).delete(store, key); } catch {} }
export async function clearStore(store: string) { try { await (await db()).clear(store); } catch {} }

export async function getSetting<T>(key: string, dflt: T): Promise<T> {
  try { const r = await (await db()).get('settings', key); return r ? (r.value as T) : dflt; } catch { return dflt; }
}
export async function setSetting(key: string, value: unknown) { await put('settings', { key, value }); }

export async function getScan(id: string): Promise<{ ts: number, text: string } | null> {
  try { return await (await db()).get('scans', id) ?? null; } catch { return null; }
}
export async function setScan(id: string, text: string) {
  await put('scans', { id, ts: Date.now(), text });
}

/* v2 localStorage migration (Architecture §8.4) */
export async function migrateV2() {
  try {
    if (localStorage.getItem('gk_migrated')) return;
    const kws = JSON.parse(localStorage.getItem('gk_kws') || 'null');
    if (Array.isArray(kws)) for (const k of kws) await put('keywords', { id: uid(), text: k.t, weight: 5, armed: !!k.on, concept: '' });
    const crits = JSON.parse(localStorage.getItem('gk_crits') || 'null');
    if (Array.isArray(crits)) for (const c of crits) await put('criteria', { id: uid(), text: c.t, weight: c.w ?? 5 });
    const hits = JSON.parse(localStorage.getItem('gk_hits') || 'null');
    if (Array.isArray(hits)) for (const h of hits) if (!h.declined) await put('wishlist', { id: uid(), name: h.n, area: h.area || '', priority: /HIGH/i.test(h.prio||'') ? 'HIGH' : 'MEDIUM', note: h.why || '', gateScore: h.score ?? undefined, added: h.d || new Date().toISOString().slice(0,10) });
    const audits = JSON.parse(localStorage.getItem('gk_audits') || 'null');
    if (Array.isArray(audits)) for (const a of audits) await put('audits', { id: uid(), capturedAt: new Date().toISOString(), ...a });
    localStorage.setItem('gk_migrated', '1');
  } catch { /* storage unavailable — fine */ }
}
