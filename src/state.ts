import { signal, computed } from '@preact/signals';
import { put, setSetting, type Keyword, type Criterion, type WishItem, type AuditRec, type CachedSearch } from './services/store';
import { MASTER } from './data/master';

export const tab = signal<'radar'|'gate'|'folio'|'audit'|'codex'|'intel'|'settings'>('radar');
export const keywords = signal<Keyword[]>([]);
export const criteria = signal<Criterion[]>([]);
export const wishlist = signal<WishItem[]>([]);
export const audits = signal<AuditRec[]>([]);
export const unifiedData = computed(() => {
  // MASTER already contains older entries. We want to prepend the new IndexedDB audits that aren't in MASTER yet.
  // We can loosely check by date or just prepend them all if they are purely "new" (which they are, as long as export hasn't been merged).
  // For simplicity, we just merge. If an audit is exported and eventually merged into MASTER, 
  // the user usually clears local data, or we could deduplicate by a heuristic (Cafe + Date).
  const local = audits.value.map((a, i) => {
    return {
      ...a,
      n: 1000 + i,
      dateISO: a.Date,
      cafe: a.Cafe_Name,
      priceSGD: parseFloat(a.Price_SGD) || null,
      star: a.Gesha_Alert === 'GESHA' ? 1 : 0
    } as any;
  });
  
  const masterSet = new Set(MASTER.map(m => `${m.Date || m.dateISO}|${m.Cafe_Name || m.cafe}|${m.Coffee_Name || m.coffee}`));
  const uniqueLocal = local.filter((l: any) => !masterSet.has(`${l.Date}|${l.Cafe_Name}|${l.Coffee_Name}`));
  
  return [...uniqueLocal, ...MASTER] as typeof MASTER;
});
export const lastSearch = signal<CachedSearch|null>(null);
export const toastMsg = signal<string>('');
export const auditPrefill = signal<string>('');

let toastTimer: ReturnType<typeof setTimeout>;
export function toast(m: string) { toastMsg.value = m; clearTimeout(toastTimer); toastTimer = setTimeout(() => toastMsg.value = '', 2400); }
export function goAudit(cafe: string) { auditPrefill.value = cafe; tab.value = 'audit'; }

export async function persistKeywords() { for (const k of keywords.value) await put('keywords', k); }
export async function persistWishlist(w: WishItem) { await put('wishlist', w); }

/* ---- Appearance / theme (§ theme switcher) ---- */
export type ThemeChoice = 'dark'|'light'|'system';
const THEME_COLOR: Record<'dark'|'light', string> = { dark: '#15171a', light: '#fafbfc' };

function systemPrefersLight(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}
function resolveTheme(t: ThemeChoice): 'dark'|'light' { return t === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : t; }
function readInitialTheme(): ThemeChoice {
  try { const v = localStorage.getItem('gk_theme'); if (v === 'dark' || v === 'light' || v === 'system') return v; } catch {}
  return 'dark';
}

export const theme = signal<ThemeChoice>(readInitialTheme());

export function applyTheme() {
  const resolved = resolveTheme(theme.value);
  try {
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
  } catch { /* SSR / no DOM — ignore */ }
}

export async function setTheme(t: ThemeChoice) {
  theme.value = t;
  try { localStorage.setItem('gk_theme', t); } catch {}
  applyTheme();
  await setSetting('theme', t);
}

if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (theme.value === 'system') applyTheme(); });
}

applyTheme();
