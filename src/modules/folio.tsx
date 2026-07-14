import { useState, useMemo } from 'preact/hooks';
import { unifiedData } from '../state';
import { signal } from '@preact/signals';

const openCafe = signal<string>('');

export function Folio() {
  const [q, setQ] = useState('');
  
  const cafes = useMemo(() => {
    const query = q.trim().toLowerCase();
    const map = new Map<string, typeof unifiedData.value>();
    
    for (const row of unifiedData.value) {
      if (!row.Cafe_Name) continue;
      
      if (query) {
        const allText = Object.values(row).join(' ').toLowerCase();
        if (!allText.includes(query)) continue;
      }
      
      const existing = map.get(row.Cafe_Name) || [];
      existing.push(row);
      map.set(row.Cafe_Name, existing);
    }
    
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [q, unifiedData.value]);

  return (
    <div class="pane">
      <div class="sec-lbl">Omni-Search Cafe Archive</div>
      <p class="hint">Search any keyword across your entire master audit archive (e.g. "EK43", "Gesha", "Lactic", "Phosphoric").</p>
      
      <input 
        type="text" 
        placeholder="⌕ Search beans, origins, grinders, tasting notes..." 
        value={q} 
        onInput={e => setQ((e.target as HTMLInputElement).value)} 
        style="margin-bottom: 1rem; width: 100%; font-size: 1.1rem; padding: 0.8rem;"
      />
      
      {cafes.map(([cafeName, visits]) => (
        <div class={'res' + (openCafe.value === cafeName ? ' open' : '')}>
          <div onClick={() => openCafe.value = openCafe.value === cafeName ? '' : cafeName}>
            <div class="res-top">
              <div>
                <div class="res-name">{cafeName}</div>
                <div class="res-meta">
                  <span>📍 {visits[0].City}</span>
                  <span>☕ {visits.length} Visit{visits.length > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            
            {openCafe.value === cafeName && (
              <div class="debug-drawer" style="margin-top: 1rem; padding: 0; background: transparent;" onClick={e => e.stopPropagation()}>
                {visits.sort((a,b) => b.Date.localeCompare(a.Date)).map(v => (
                  <div class="card" style="margin-bottom: 1rem; border-left: 4px solid var(--pass); background: var(--bg2);">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--line); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                      <h3 style="margin:0; font-size: 1.1rem; color: var(--text);">{v.Coffee_Name}</h3>
                      <span style="font-size: 0.85rem; color: var(--faint);">{v.Date}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.8rem; font-size: 0.9rem;">
                      <div><b>Origin:</b> {v.Origin} {v.Producer_Farm !== 'Unknown' ? `(${v.Producer_Farm})` : ''}</div>
                      <div><b>Process:</b> {v.Process}</div>
                      <div><b>Varietal:</b> {v.Varietal}</div>
                      <div><b>Hardware:</b> {v.Grinder} / {v.Brew_Method}</div>
                      <div><b>Ratio/Dose:</b> {v.Ratio} ({v.Dose_g}g in ➔ {v.Yield_g}g out)</div>
                      <div><b>Temp:</b> {v.Water_Temp_C}</div>
                    </div>
                    
                    {v.Official_Notes !== 'Unknown' && (
                      <div style="margin-bottom: 0.5rem; font-size: 0.9rem;">
                        <b>Official Notes:</b> {v.Official_Notes}
                      </div>
                    )}
                    
                    {v.Your_Verdict && (
                      <div style="margin-bottom: 0.5rem; font-size: 0.9rem; padding: 0.5rem; background: rgba(0,255,0,0.05); border-radius: 4px;">
                        <b style="color: var(--pass)">Verdict:</b> {v.Your_Verdict}
                      </div>
                    )}
                    
                    <div style="font-size: 0.85rem; color: var(--faint); font-style: italic; border-top: 1px dashed var(--line); padding-top: 0.5rem; margin-top: 0.5rem; display: grid; grid-template-columns: 1fr; gap: 0.3rem;">
                      {v.Technical_Enrichment && <div><b>Technical Enrichment:</b> {v.Technical_Enrichment}</div>}
                      {v.Visit_Context && v.Visit_Context !== 'Unknown' && <div><b>Context:</b> {v.Visit_Context}</div>}
                      {v.Price_SGD && v.Price_SGD !== 'Unknown' && <div><b>Price:</b> S${v.Price_SGD}</div>}
                      {v.Address && v.Address !== 'Unknown' && (
                        <div>
                          <b>Address:</b> <a href={`https://maps.google.com/?q=${encodeURIComponent(v.Cafe_Name + ' ' + v.Address)}`} target="_blank" style="color: var(--pass); text-decoration: underline;">{v.Address}</a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      
      {cafes.length === 0 && <div class="empty">No cafes match your search.</div>}
    </div>
  );
}
