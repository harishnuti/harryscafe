import { render } from 'preact';
import './theme.css';
import { migrateV2, getAll, getSetting, put, uid, type Keyword, type Criterion, type WishItem, type AuditRec, type CachedSearch } from './services/store';
import { DEFAULT_KEYWORDS, DEFAULT_CRITERIA, SEED_WISHLIST } from './data/defaults';
import { tab, keywords, criteria, wishlist, audits, lastSearch, toastMsg, theme, applyTheme, type ThemeChoice } from './state';
import { Radar } from './modules/radar';
import { Gate } from './modules/gate';
import { Folio } from './modules/folio';
import { Audit } from './modules/audit';
import { Codex } from './modules/codex';
import { Intel } from './modules/intel';
import { Settings } from './modules/settings';

async function boot() {
  await migrateV2();
  const savedTheme = await getSetting<ThemeChoice>('theme', theme.value);
  if (savedTheme !== theme.value) { theme.value = savedTheme; try { localStorage.setItem('gk_theme', savedTheme); } catch {} }
  applyTheme();
  let kws = await getAll<Keyword>('keywords');
  if (!kws.length) { kws = DEFAULT_KEYWORDS.map(k => ({ id: uid(), ...k })); for (const k of kws) await put('keywords', k); }
  keywords.value = kws;
  let crs = await getAll<Criterion>('criteria');
  if (!crs.length) { crs = DEFAULT_CRITERIA.map(c => ({ id: uid(), ...c })); for (const c of crs) await put('criteria', c); }
  criteria.value = crs;
  let wl = await getAll<WishItem>('wishlist');
  if (!wl.length) { wl = SEED_WISHLIST.map(w => ({ id: uid(), note: w.note, name: w.name, area: w.area, priority: w.priority, added: w.added })); for (const w of wl) await put('wishlist', w); }
  wishlist.value = wl.sort((a, b) => a.priority.localeCompare(b.priority) || b.added.localeCompare(a.added));
  audits.value = (await getAll<AuditRec>('audits')).sort((a, b) => (b.capturedAt||'').localeCompare(a.capturedAt||''));
  const searches = await getAll<CachedSearch>('searches');
  if (searches.length) lastSearch.value = searches.sort((a, b) => b.ts - a.ts)[0];
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const TABS = [
  ['radar','📡','Radar'], ['gate','🚪','Gate'], ['folio','🏛️','Folio'],
  ['audit','☕','Audit'], ['codex','📖','Codex'], ['intel','🧠','Intel'], ['settings','⚙︎','Set'],
] as const;

function App() {
  return (
    <>
      <header id="hdr"><h1>Gatekeeper</h1><span>Connoisseur Field Kit · v8.0</span></header>
      <main>
        {tab.value === 'radar' && <Radar />}
        {tab.value === 'gate' && <Gate />}
        {tab.value === 'folio' && <Folio />}
        {tab.value === 'audit' && <Audit />}
        {tab.value === 'codex' && <Codex />}
        {tab.value === 'intel' && <Intel />}
        {tab.value === 'settings' && <Settings />}
      </main>
      <nav id="tabs">
        {TABS.map(([id, ico, lbl]) => (
          <button class={'tab' + (tab.value === id ? ' on' : '')} onClick={() => { tab.value = id; scrollTo(0, 0); }}>
            <span class="ico">{ico}</span><span class="lbl">{lbl}</span>
          </button>
        ))}
      </nav>
      {toastMsg.value && <div class="toast">{toastMsg.value}</div>}
    </>
  );
}

boot().then(() => render(<App />, document.getElementById('app')!));
