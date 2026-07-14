import { signal } from '@preact/signals';
import { toast, goAudit, tab, unifiedData } from '../state';
import { fmtDist, gmapsLink, amapsLink } from '../services/places';
import { getSetting } from '../services/store';
import { liveAreaSearch, PlacesError, upgradeT1, extractDna, type LiveResult } from '../services/livesearch';
import { gateCandidate } from './gate';

const radiusM = signal(3000);
const customArea = signal('');
const customKeywords = signal('specialty coffee, pour over, single origin');
const customResults = signal<LiveResult[] | null>(null);
const customSearching = signal(false);
const customErr = signal('');
const customOpenId = signal('');
const debugOpenId = signal('');
const customFailed = signal<{failed: number, total: number} | null>(null);

function placesErrMsg(e: PlacesError): string {
  return {
    KEY_MISSING: 'No API key configured — add it in Settings.',
    KEY_INVALID: 'The API key was rejected by Google. Verify it in Settings (test button).',
    KEY_REFERRER: 'Google refused the key for this origin. Add your deployed URL to the key’s website restrictions.',
    QUOTA: 'Places quota exceeded for this period.',
    NET: 'Network failure mid-search.',
  }[e.kind];
}

async function runCustomSearch() {
  const area = customArea.value.trim();
  if (!area) { customErr.value = 'Type an area to search.'; return; }
  const kws = customKeywords.value.split(',').map(k => k.trim()).filter(Boolean);
  if (!kws.length) { customErr.value = 'Add at least one keyword.'; return; }
  customErr.value = ''; customResults.value = null; customFailed.value = null;
  const apiKey = await getSetting('apiKey', '');
  if (!apiKey) { customErr.value = 'No API key configured — add it in Settings.'; return; }
  customSearching.value = true;
  try {
    const outcome = await liveAreaSearch({ apiKey, areaText: area, radiusM: radiusM.value, keywords: kws, lat: null, lng: null, filterCoffeeRequired: true, archive: unifiedData.value as any });
    customResults.value = outcome.results;
    if (outcome.failedKeywords && outcome.failedKeywords.length > 0 && outcome.results.length > 0) {
      customFailed.value = { failed: outcome.failedKeywords.length, total: kws.length };
    }
    if (!outcome.results.length) customErr.value = 'No live results found — try different keywords or a wider radius.';
    
    // Asynchronous T1 Menu Scanning
    if (outcome.results.length > 0) {
      upgradeT1(outcome.results).then(upgraded => {
        customResults.value = upgraded;
      });
    }

  } catch (e) {
    customErr.value = e instanceof PlacesError ? placesErrMsg(e) : 'Unexpected failure: ' + String(e).slice(0, 120);
  } finally { customSearching.value = false; }
}

function HighlightedReview({ text, kws }: { text: string, kws: string[] }) {
  const validKws = kws.filter(k => k !== "Master Audit Log" && k !== "Roastery Category");
  if (!validKws.length) return <span>{text}</span>;
  
  const safeKws = validKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${safeKws.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong style="color: var(--pass); background: rgba(0,255,0,0.1); padding: 0 2px; border-radius: 2px;">{part}</strong>;
        }
        return <span>{part}</span>;
      })}
    </span>
  );
}

export function Radar() {
  const dna = extractDna(unifiedData.value as any);

  return (
    <div class="pane">
      <div class="sec-lbl">Live Radar Search</div>
      
      <p class="hint">Live search directly against Google Places — type any area, anywhere. The app will fetch Google reviews in the background to transparently verify if the place serves serious pour-over/filter coffee.</p>
      
      {dna.length > 0 && (
        <div style="background:var(--bg2); padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;">
          <div style="font-size: .85rem; color: var(--faint); margin-bottom: .5rem; font-weight: bold; text-transform: uppercase;">🧬 Your Palate DNA Active</div>
          <div style="font-size: .9rem; line-height: 1.6;">
            Searching with your profile: {dna.map(d => <span style="display:inline-block; margin-right:.4rem; padding: 0 .4rem; background:rgba(255,255,255,0.05); border-radius:4px;">{d}</span>)}
          </div>
        </div>
      )}

      <label class="f"><b>Area</b>
        <input type="text" placeholder="e.g. Serangoon, or a street / mall name" value={customArea.value}
          onInput={e => customArea.value = (e.target as HTMLInputElement).value} /></label>
      <label class="f"><b>Keywords (comma-separated)</b>
        <input type="text" placeholder="specialty coffee, pour over, V60" value={customKeywords.value}
          onInput={e => customKeywords.value = (e.target as HTMLInputElement).value} /></label>
      <label class="f"><b>Radius</b>
        <select value={String(radiusM.value)} onChange={e => radiusM.value = +(e.target as HTMLSelectElement).value}>
          {[1000, 2000, 3000, 5000, 10000, 25000].map(r => <option value={String(r)}>{r / 1000} km</option>)}
        </select></label>
      <button class="btn" disabled={customSearching.value} onClick={runCustomSearch}>
        {customSearching.value ? 'Searching…' : '◈ Search Live'}
      </button>

      {customErr.value && <><div style="height:.8rem" /><div class="warnstrip">{customErr.value}</div></>}
      {customFailed.value && !customErr.value && <><div style="height:.8rem" /><div class="warnstrip" style="background:var(--warn);color:#000;">{customFailed.value.failed} of {customFailed.value.total} queries failed (API error or timeout). Results may be incomplete.</div></>}
      {customSearching.value && <><div class="progress">Querying Google Places and scanning live reviews…</div><div class="skel" /><div class="skel" /></>}

      {customResults.value !== null && !customSearching.value && <>
        <div class="sec-lbl">Live Results — {customResults.value.length} found</div>
        {customResults.value.map((v, i, arr) => {
          const showDivider = i > 0 && arr[i-1].tier !== 'UNVERIFIED' && v.tier === 'UNVERIFIED';
          return (
          <div key={v.placeId}>
            {showDivider && <div style="margin: 1.5rem 0; text-align: center; color: var(--faint); font-size: 0.9rem;">— Unverified (no review evidence) —</div>}
            <div class={'res' + (customOpenId.value === v.placeId ? ' open' : '')}>
            <div onClick={() => customOpenId.value = customOpenId.value === v.placeId ? '' : v.placeId}>
              <div class="res-top">
                <div>
                  <div class="res-name">{v.name}</div>
                  <div class="res-meta">
                    <span>📍 {fmtDist(v.distanceM)} from area center</span>
                    {v.rating !== null && <span>★ {v.rating.toFixed(1)} ({v.reviews})</span>}
                    {v.openNow === true && <span style="color:var(--pass)">OPEN</span>}
                    {v.openNow === false && <span style="color:var(--fail)">CLOSED</span>}
                  </div>
                </div>
                <div class="res-score" onClick={(e) => { e.stopPropagation(); debugOpenId.value = debugOpenId.value === v.placeId ? '' : v.placeId; }} style="cursor:help" title="Click to view score breakdown">
                  <b>{v.score}%</b><span>MATCH</span>
                </div>
              </div>

              {debugOpenId.value === v.placeId && (
                <div class="debug-drawer" style="margin-top: .8rem; padding: .8rem; background: var(--bg2); border-radius: 6px; font-size: .85rem; color: var(--faint);" onClick={e => e.stopPropagation()}>
                  <div style="font-weight:bold; margin-bottom:.4rem; color:var(--text)">1. Distance & Center Origin</div>
                  <div style="margin-bottom: .8rem;">
                    {v.distanceM} meters from the calculated center of your Area search.<br/>
                    Center Coordinates: <a href={`https://maps.google.com/?q=${v.originLat},${v.originLng}`} target="_blank" style="color:var(--pass);text-decoration:underline;">{v.originLat?.toFixed(5)}, {v.originLng?.toFixed(5)}</a>
                  </div>

                  <div style="font-weight:bold; margin-bottom:.4rem; color:var(--text)">2. Google Queries Matched</div>
                  <div style="margin-bottom: .8rem;">{v.matched.join(', ')}</div>

                  <div style="font-weight:bold; margin-bottom:.4rem; color:var(--text)">3. Base Score Breakdown</div>
                  <div style="display:grid; grid-template-columns: 1fr auto; gap: .2rem; margin-bottom: .8rem;">
                    <span>Base (Query match)</span><span>+{((v.scoreBreakdown?.base ?? 0) * 100).toFixed(1)}%</span>
                    <span>Gem Lexicon Alignment</span><span>{(v.scoreBreakdown?.lexiconScore ?? 0) >= 0 ? '+' : ''}{((v.scoreBreakdown?.lexiconScore ?? 0) * 100).toFixed(1)}%</span>
                    <span>Bayesian Rating Bonus</span><span>{((v.scoreBreakdown?.ratingBonus ?? 0) + (v.scoreBreakdown?.depthBonus ?? 0)) >= 0 ? '+' : ''}{(((v.scoreBreakdown?.ratingBonus ?? 0) + (v.scoreBreakdown?.depthBonus ?? 0)) * 100).toFixed(1)}%</span>
                    <span>Type Score (Coffee vs Food/Bar)</span><span>{(v.scoreBreakdown?.typeScore ?? 0) > 0 ? '+' : ''}{((v.scoreBreakdown?.typeScore ?? 0) * 100).toFixed(1)}%</span>
                    <span>Coffee-Mention Ratio</span><span>{(v.scoreBreakdown?.coffeeMention ?? 0) > 0 ? '+' : ''}{((v.scoreBreakdown?.coffeeMention ?? 0) * 100).toFixed(1)}%</span>
                    <span>Name Signal</span><span>{(v.scoreBreakdown?.nameBonus ?? 0) > 0 ? '+' : ''}{((v.scoreBreakdown?.nameBonus ?? 0) * 100).toFixed(1)}%</span>
                  </div>

                  <div style="font-weight:bold; margin-bottom:.4rem; color:var(--text)">4. Specialty Keyword Evidence</div>
                  {v.scoreBreakdown?.matchedKeywords?.length === 0 ? (
                    <div style="margin-bottom: .8rem; font-style: italic; color: var(--fail);">No specialty coffee keywords found.</div>
                  ) : (
                    <div style="display:grid; grid-template-columns: 1fr auto; gap: .2rem; margin-bottom: .8rem;">
                      {v.scoreBreakdown?.matchedKeywords?.map((mk) => (
                        <span style="color:var(--pass)">"{mk.word}"</span>
                      ))}
                      <div style="grid-column: 1 / -1; border-top: 1px solid var(--line2); margin-top: .2rem; padding-top: .2rem; display:flex; justify-content:space-between;">
                        <span>Total Evidence Bonus</span>
                        <span>+{((v.scoreBreakdown?.evidenceScore ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  <div style="display:flex; justify-content:space-between; border-top: 1px solid var(--line2); margin-bottom: 1rem; padding-top: .4rem; font-weight: bold; color:var(--text);">
                    <span>Uncapped Total Score</span>
                    <span>{((v.scoreBreakdown?.totalBeforeCap ?? 0) * 100).toFixed(1)}%</span>
                  </div>

                  <div style="font-weight:bold; margin-bottom:.4rem; color:var(--text)">5. Unfiltered Raw Reviews ({v.rawReviews.length})</div>
                  {v.rawReviews.length === 0 ? <div>No text reviews provided by Google API.</div> : v.rawReviews.map((r) => (
                    <div style="margin-bottom: .4rem; padding-left: .5rem; border-left: 2px solid var(--line); font-style: italic; line-height: 1.4;">
                      <HighlightedReview text={r} kws={v.scoreBreakdown?.matchedKeywords?.map(m => m.word) ?? []} />
                    </div>
                  ))}
                </div>
              )}

              <div class="badges" style="margin-top: .8rem;">
                <span class="badge" style={`border-color:${v.tier !== 'UNVERIFIED' ? 'var(--pass)' : 'var(--fail)'};color:${v.tier !== 'UNVERIFIED' ? 'var(--pass)' : 'var(--fail)'}`}>{v.tierBadge}</span>
                {v.scoreBreakdown?.typeScore === -0.25 && <span class="badge" style="border-color:var(--fail);color:var(--fail)">🍸 Nightlife</span>}
                {v.scoreBreakdown?.typeScore !== -0.25 && v.foodHeavy && <span class="badge" style="border-color:var(--fail);color:var(--fail)">🍔 Food Heavy</span>}
              </div>
            </div>
            <div class="res-detail">
              <div class="res-addr">{v.address}</div>
              {v.tierReason && (
                <div class="fld" style="margin-top: .8rem"><b>Evidence Reason</b>
                  <div style="font-size:.85rem;color:var(--tan);margin-bottom:.3rem; font-style: italic;">{v.tierReason}</div>
                </div>
              )}
              <div class="acts" style="margin-top: 1rem">
                <a class="btn small" href={gmapsLink(v)} target="_blank" rel="noopener">↗ Google Maps</a>
                <a class="btn small ghost" href={amapsLink(v)} target="_blank" rel="noopener">Apple Maps</a>
                {v.websiteUri && <a class="btn small ghost" href={v.websiteUri} target="_blank" rel="noopener">🌐 Website</a>}
                <button class="btn small ghost" onClick={() => { gateCandidate(v.name, v.address); tab.value = 'gate'; }}>Run the Gate</button>
                <button class="btn small ghost" onClick={() => goAudit(v.name)}>Begin Audit</button>
              </div>
            </div>
          </div>
          </div>
        )})}
        {customResults.value.length > 0 && <p class="mono-note" style="text-align:center;margin-top:.6rem">Powered by Google · Radius measured from searched area</p>}
      </>}
    </div>
  );
}
