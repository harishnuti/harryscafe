import { unifiedData } from '../state';
import { getClusters } from '../services/flavor';

const uniq = (a: string[]) => [...new Set(a.filter(x => x && x !== 'Unknown' && x !== '—'))];

function Bar({ k, n, max, gold = false }: { k: string, n: number, max: number, gold?: boolean }) {
  const pct = Math.round((n / max) * 100);
  return (
    <div style="display:flex; align-items:center; margin-bottom: 0.5rem;">
      <div style="width: 140px; font-size:0.85rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title={k}>{k}</div>
      <div style="flex:1; height: 8px; background: var(--bg2); border-radius: 4px; overflow:hidden; margin: 0 0.5rem;">
        <div style={`height:100%; width:${pct}%; background: ${gold ? 'var(--pass)' : 'var(--faint)'};`} />
      </div>
      <div style="width: 30px; font-size:0.8rem; text-align:right;">{n}</div>
    </div>
  );
}

export function Intel() {
  const E = unifiedData.value;

  // Process Ratios
  const rvs = E.map(e => {
    if (!e.Ratio || e.Ratio === 'Unknown' || e.Ratio === '—') return null;
    const parts = e.Ratio.split(':');
    return parts.length === 2 ? parseFloat(parts[1]) : null;
  }).filter((r): r is number => r !== null && !isNaN(r));

  const inBand = rvs.filter(r => r >= 15 && r <= 17).length;
  const buckets: Record<string, number> = { '< 1:15': 0, '1:15': 0, '1:16': 0, '1:17': 0, '> 1:17': 0 };
  for (const r of rvs) {
    if (r < 15) buckets['< 1:15']++;
    else if (r >= 15 && r < 16) buckets['1:15']++;
    else if (r >= 16 && r < 17) buckets['1:16']++;
    else if (r >= 17 && r < 18) buckets['1:17']++;
    else buckets['> 1:17']++;
  }
  const rmax = Math.max(...Object.values(buckets), 1);

  // Process Grinders
  const gmap: Record<string, { n: number }> = {};
  for (const e of E) {
    if (e.Grinder && e.Grinder !== 'Unknown' && e.Grinder !== '—') {
      let gType = 'Other';
      if (e.Grinder.toLowerCase().includes('ek43')) gType = 'Mahlkönig EK43';
      else if (e.Grinder.toLowerCase().includes('lagom')) gType = 'Option-O Lagom';
      else if (e.Grinder.toLowerCase().includes('df64') || e.Grinder.toLowerCase().includes('df83')) gType = 'Turin DF Series';
      else if (e.Grinder.toLowerCase().includes('niche')) gType = 'Niche Zero/Duo';
      else gType = e.Grinder;
      
      gmap[gType] = gmap[gType] ?? { n: 0 };
      gmap[gType].n++;
    }
  }
  const league = Object.entries(gmap).sort((a, b) => b[1].n - a[1].n);

  // Process Origins
  const omap: Record<string, number> = {};
  for (const e of E) {
    if (e.Origin && e.Origin !== 'Unknown' && e.Origin !== '—') {
      // Extract country from end of origin string
      const parts = e.Origin.split(',');
      const country = parts[parts.length - 1].trim();
      omap[country] = (omap[country] ?? 0) + 1;
    }
  }
  const origins = Object.entries(omap).sort((a, b) => b[1] - a[1]);
  const omax = origins[0]?.[1] ?? 1;

  // Process Varietals
  const courts: [string, (e: typeof E[0]) => boolean][] = [
    ['Gesha / Geisha', e => /gesha|geisha/i.test(e.Varietal)],
    ['Bourbon family', e => /bourbon/i.test(e.Varietal)],
    ['Kenyan SL / Ruiru', e => /SL28|SL34|Ruiru/i.test(e.Varietal)],
    ['Ethiopian Landrace', e => /heirloom|landrace|741|welicho|kurume|dega|wolisho/i.test(e.Varietal)],
    ['Caturra lineage', e => /caturra/i.test(e.Varietal)],
  ];

  // Process Processes
  const procs: [string, (e: typeof E[0]) => boolean][] = [
    ['Washed (classic)', e => /washed/i.test(e.Process) && !/co-ferment|anaerobic|thermal/i.test(e.Process)],
    ['Natural (classic)', e => /^natural/i.test(e.Process) && !/anaerobic|thermal/i.test(e.Process)],
    ['Anaerobic family', e => /anaerobic/i.test(e.Process)],
    ['Thermal Shock', e => /thermal/i.test(e.Process)],
    ['Honey family', e => /honey/i.test(e.Process)],
  ];
  const parr = procs.map(([n, f]) => [n, E.filter(f).length] as [string, number]).filter(x => x[1] > 0);
  const pmax = Math.max(...parr.map(x => x[1]), 1);

  // Prices & Context
  const prices = E.map(e => parseFloat(e.Price_SGD)).filter(p => !isNaN(p));
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const totalSpend = prices.reduce((a, b) => a + b, 0);

  // Roaster vs Reality Delta (NLP Comparison)
  let exactMatchCount = 0;
  let partialMatchCount = 0;
  let totalComparisons = 0;
  for (const e of E) {
    if (e.Official_Notes && e.Official_Notes !== 'Unknown' && e.Your_Verdict && e.Your_Verdict !== 'Unknown') {
      totalComparisons++;
      const promised = getClusters(e.Official_Notes);
      const tasted = getClusters(e.Your_Verdict);
      
      const overlap = promised.filter(p => tasted.includes(p));
      if (overlap.length > 0 && overlap.length >= promised.length * 0.5) exactMatchCount++;
      else if (overlap.length > 0) partialMatchCount++;
    }
  }
  const exactPercent = totalComparisons > 0 ? Math.round((exactMatchCount / totalComparisons) * 100) : 0;
  const partialPercent = totalComparisons > 0 ? Math.round((partialMatchCount / totalComparisons) * 100) : 0;
  const matchPercent = exactPercent + partialPercent;

  return (
    <div class="pane">
      <div class="sec-lbl">Archive Intelligence Dashboard</div>
      
      <div class="stat-strip" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><b>{E.length}</b><span>Entries</span></div>
        <div class="stat"><b>{uniq(E.map(e => e.Cafe_Name)).length}</b><span>Cafés</span></div>
        <div class="stat"><b>{origins.length}</b><span>Origins</span></div>
      </div>

      <div class="sec-lbl">The "Roaster vs Reality" Delta</div>
      <div class="intel-note" style="margin-top:0.5rem; background: var(--bg2); padding: 1rem; border-radius: 6px; border: 1px solid var(--line);">
        <div style="font-size: 1.5rem; color: var(--pass); font-weight: bold;">{exactPercent}% exact · {partialPercent}% partial</div>
        <div style="font-weight: bold; margin-bottom: 0.5rem; color: var(--text);">Sensory Alignment Score</div>
        <div style="font-size: 0.85rem;">In <b>{matchPercent}%</b> of your audited cups, your personal verdict actively detected the exact or similar tasting notes promised by the roaster's official bag notes. The remaining {100 - matchPercent}% represent extraction failures, false marketing, or terroir mismatches.</div>
      </div>

      <div class="sec-lbl">Process Register</div>
      {parr.map(([k, n]) => <Bar k={k} n={n} max={pmax} gold={k === 'Washed (classic)' || k === 'Thermal Shock'} />)}
      
      <div class="sec-lbl">Ratio Spectrum</div>
      {Object.entries(buckets).map(([k, n]) => <Bar k={k} n={n} max={rmax} gold={k === '1:16'} />)}
      <div class="intel-note"><b>{Math.round((inBand / rvs.length) * 100)}%</b> of your audited cups sit inside the 1:15–1:17 Palate DNA band.</div>

      <div class="sec-lbl">Hardware Dominance</div>
      <table class="league">
        <tr><th>Grinder Family</th><th style="text-align:right">Cups</th></tr>
        {league.map(([g, d], i) => (
          <tr class={i === 0 ? 'top' : ''}><td>{g}</td><td class="num">{d.n}</td></tr>
        ))}
      </table>

      <div class="sec-lbl">Origin Census</div>
      {origins.slice(0, 10).map(([k, n]) => <Bar k={k} n={n} max={omax} gold={['Colombia', 'Ethiopia', 'Panama'].includes(k)} />)}

      <div class="sec-lbl">Varietal Court</div>
      <table class="league">
        <tr><th>Varietal Family</th><th style="text-align:right">Cups</th></tr>
        {courts.map(([name, fn], i) => {
          const es = E.filter(fn);
          return es.length ? <tr class={i === 0 ? 'top' : ''}><td>{name}</td><td class="num">{es.length}</td></tr> : null;
        })}
      </table>

      <div class="sec-lbl">Economic Data</div>
      <div class="stat-strip" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat"><b>S${avg.toFixed(2)}</b><span>Avg cup</span></div>
        <div class="stat"><b>S${Math.min(...prices)}</b><span>Cheapest</span></div>
        <div class="stat"><b>S${Math.max(...prices)}</b><span>Priciest</span></div>
        <div class="stat"><b style="color:var(--pass)">S${totalSpend.toFixed(2)}</b><span>Total Invested</span></div>
      </div>
    </div>
  );
}
