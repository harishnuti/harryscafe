import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { getSetting, setSetting, getAll, put, clearStore, uid, type AuditRec, type Keyword, type Criterion, type WishItem } from '../services/store';
import { toast, keywords, criteria, wishlist, audits, theme, setTheme, unifiedData, type ThemeChoice } from '../state';
import { shareText, auditsToCSV } from '../services/export';

const key = signal(''); const keyMasked = signal(true);
const radius = signal(3000); const ratingFloor = signal(4.3); const reviewFloor = signal(30);
const scoreFloor = signal(35); const openNow = signal(false); const testResult = signal('');
const loaded = signal(false);

async function load() {
  key.value = await getSetting('apiKey', '');
  radius.value = await getSetting('radiusM', 3000);
  ratingFloor.value = await getSetting('ratingFloor', 4.3);
  reviewFloor.value = await getSetting('reviewFloor', 30);
  scoreFloor.value = await getSetting('scoreFloorPct', 35);
  openNow.value = await getSetting('openNow', false);
  loaded.value = true;
}

async function saveAll() {
  await setSetting('apiKey', key.value.trim());
  await setSetting('radiusM', radius.value);
  await setSetting('ratingFloor', ratingFloor.value);
  await setSetting('reviewFloor', reviewFloor.value);
  await setSetting('scoreFloorPct', scoreFloor.value);
  await setSetting('openNow', openNow.value);
  toast('Settings saved to device');
}

async function testKey() {
  testResult.value = 'Testing…';
  if (!key.value.trim()) { testResult.value = '✗ No key entered.'; return; }
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key.value.trim(), 'X-Goog-FieldMask': 'places.id' },
      body: JSON.stringify({ textQuery: 'specialty coffee singapore', maxResultCount: 1 }),
    });
    if (res.ok) { testResult.value = '✓ Key valid — the Radar is armed.'; return; }
    const t = await res.text();
    if (res.status === 403 && /referer|referrer/i.test(t)) testResult.value = '✗ Referrer blocked — add https://hari-gatekeeper.netlify.app/* to the key’s website restrictions.';
    else if (res.status === 403 || res.status === 400) testResult.value = '✗ Key rejected — confirm Places API (New) is enabled on the Google Cloud project.';
    else if (res.status === 429) testResult.value = '✗ Quota exceeded.';
    else testResult.value = `✗ HTTP ${res.status}.`;
  } catch { testResult.value = '✗ Network failure — are you online?'; }
}

async function backup() {
  const data = {
    schemaVersion: 1, exportedAt: new Date().toISOString(),
    keywords: keywords.value, criteria: criteria.value, wishlist: wishlist.value,
    audits: await getAll<AuditRec>('audits'),
  };
  const r = await shareText('Gatekeeper backup', JSON.stringify(data));
  toast(r === 'shared' ? 'Backup shared' : r === 'copied' ? 'Backup copied to clipboard' : 'Backup failed');
}

async function restore() {
  const raw = prompt('Paste a Gatekeeper backup JSON:');
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    if (d.schemaVersion !== 1) { toast('Unrecognized backup version'); return; }
    if (Array.isArray(d.keywords)) { await clearStore('keywords'); for (const k of d.keywords) await put('keywords', { ...k, id: k.id || uid() }); keywords.value = await getAll<Keyword>('keywords'); }
    if (Array.isArray(d.criteria)) { await clearStore('criteria'); for (const c of d.criteria) await put('criteria', { ...c, id: c.id || uid() }); criteria.value = await getAll<Criterion>('criteria'); }
    if (Array.isArray(d.wishlist)) { await clearStore('wishlist'); for (const w of d.wishlist) await put('wishlist', { ...w, id: w.id || uid() }); wishlist.value = await getAll<WishItem>('wishlist'); }
    if (Array.isArray(d.audits)) { await clearStore('audits'); for (const a of d.audits) await put('audits', { ...a, id: a.id || uid() }); audits.value = await getAll<AuditRec>('audits'); }
    toast('Backup restored');
  } catch { toast('Invalid backup JSON'); }
}

export function Settings() {
  useEffect(() => { load(); }, []);
  if (!loaded.value) return <div class="pane"><div class="empty">Loading…</div></div>;
  return (
    <div class="pane">
      <div class="sec-lbl">Appearance</div>
      <p class="hint">Choose how Gatekeeper looks. "System" follows your device's light/dark setting automatically.</p>
      <div class="seg">
        {(['dark','light','system'] as ThemeChoice[]).map(t => (
          <button class={theme.value === t ? 'on' : ''} onClick={() => setTheme(t)}>
            {t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'System'}
          </button>
        ))}
      </div>

      <div class="sec-lbl">Google Places API Key</div>
      <p class="hint">Stored on this device only — never bundled, never committed, never leaves the phone except inside your own Places requests.</p>
      <div class="addrow">
        <input type={keyMasked.value ? 'password' : 'text'} placeholder="AIza…" value={key.value}
          onInput={e => key.value = (e.target as HTMLInputElement).value} />
        <button class="btn small ghost" onClick={() => keyMasked.value = !keyMasked.value}>{keyMasked.value ? 'Show' : 'Hide'}</button>
      </div>
      <div class="row2">
        <button class="btn small ghost" onClick={testKey}>Test the Key</button>
        <button class="btn small" onClick={saveAll}>Save Settings</button>
      </div>
      {testResult.value && <><div style="height:.6rem" /><div class="intel-note">{testResult.value}</div></>}

      <div class="sec-lbl">Radar Defaults</div>
      <label class="f"><b>Search radius</b>
        <select value={String(radius.value)} onChange={e => radius.value = +(e.target as HTMLSelectElement).value}>
          {[1000, 3000, 5000, 10000, 25000].map(r => <option value={String(r)}>{r / 1000} km</option>)}
        </select></label>
      <div class="row2">
        <label class="f"><b>Min Google rating</b>
          <select value={String(ratingFloor.value)} onChange={e => ratingFloor.value = +(e.target as HTMLSelectElement).value}>
            {[3.5, 4.0, 4.3, 4.5, 4.8].map(r => <option value={String(r)}>★ {r.toFixed(1)}</option>)}
          </select></label>
        <label class="f"><b>Min reviews</b>
          <select value={String(reviewFloor.value)} onChange={e => reviewFloor.value = +(e.target as HTMLSelectElement).value}>
            {[0, 10, 30, 50, 100].map(r => <option value={String(r)}>{r}</option>)}
          </select></label>
      </div>
      <div class="row2">
        <label class="f"><b>Score floor</b>
          <select value={String(scoreFloor.value)} onChange={e => scoreFloor.value = +(e.target as HTMLSelectElement).value}>
            {[20, 25, 30, 35, 40, 50, 60].map(r => <option value={String(r)}>{r}%</option>)}
          </select></label>
        <label class="f"><b>Open now only</b>
          <select value={openNow.value ? '1' : '0'} onChange={e => openNow.value = (e.target as HTMLSelectElement).value === '1'}>
            <option value="0">No</option><option value="1">Yes</option>
          </select></label>
      </div>

      <div class="sec-lbl">Data</div>
      <div class="row2">
        <button class="btn ghost" onClick={backup}>Backup All Data</button>
        <button class="btn ghost" onClick={restore}>Restore Backup</button>
      </div>
      <div style="height:.5rem" />
      <button class="btn ghost" onClick={async () => {
        const all = await getAll<AuditRec>('audits');
        if (!all.length) { toast('No field audits yet'); return; }
        const r = await shareText('Gatekeeper field audits', auditsToCSV(all));
        toast(r === 'copied' ? 'CSV copied' : r === 'shared' ? 'Shared' : 'Failed');
      }}>Export Field Audits CSV</button>

      <div class="sec-lbl">About</div>
      <p class="mono-note">
        GATEKEEPER v8.0.0 · CONNOISSEUR FIELD KIT<br />
        MASTER ARCHIVE: {unifiedData.value.length} ENTRIES · {new Set(unifiedData.value.map(e => e.Cafe_Name)).size} CAFÉS · {unifiedData.value.filter(e => e.star).length} STARRED<br />
        DATA SOURCE: LIVE HYDRATED MASTER + INDEXEDDB<br />
        CLIENT-ONLY · ON-DEVICE STORAGE · POWERED BY GOOGLE (SEARCH)
      </p>
    </div>
  );
}
