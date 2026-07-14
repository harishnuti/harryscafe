import { signal, effect } from '@preact/signals';
import { useState, useEffect } from 'preact/hooks';
import { audits, toast, auditPrefill, unifiedData } from '../state';
import { put, uid, getAll, type AuditRec } from '../services/store';
import { auditsToCSV, shareText } from '../services/export';
import { DL } from '../data/defaults';

const f = {
  date: signal(new Date().toISOString().slice(0, 10)), cafe: signal(''), city: signal('Singapore'),
  coffee: signal(''), origin: signal(''), farm: signal(''), varietal: signal(''), process: signal(''),
  roast: signal('Light'), brewer: signal(''), grinder: signal(''), ratio: signal('1:15'),
  dose: signal(''), yieldG: signal(''), temp: signal(''), price: signal(''), bloom: signal(''),
  notes: signal(''), hot: signal(''), mid: signal(''), cool: signal(''), verdict: signal(''), context: signal(''),
};

effect(() => { if (auditPrefill.value) { f.cafe.value = auditPrefill.value; auditPrefill.value = ''; } });

const cafeOptions = () => [...new Set(unifiedData.value.map(e => e.Cafe_Name))].sort();

function In({ s, b, list, type = 'text', ph = '' }: { s: { value: string }; b: string; list?: string; type?: string; ph?: string }) {
  return (
    <label class="f"><b>{b}</b>
      <input type={type} list={list} placeholder={ph} value={s.value}
        inputMode={type === 'number' ? 'decimal' : undefined}
        onInput={e => s.value = (e.target as HTMLInputElement).value} />
    </label>
  );
}

async function save() {
  if (!f.coffee.value.trim() || !f.cafe.value.trim()) { toast('Coffee and cafe are required'); return; }
  const phased = [
    f.hot.value.trim() && 'HOT: ' + f.hot.value.trim(),
    f.mid.value.trim() && 'MID-COOL: ' + f.mid.value.trim(),
    f.cool.value.trim() && 'COOL: ' + f.cool.value.trim(),
    f.verdict.value.trim(),
  ].filter(Boolean).join(' | ');
  const rec: AuditRec = {
    id: uid(), capturedAt: new Date().toISOString(),
    Date: f.date.value, City: f.city.value.trim(), Cafe_Name: f.cafe.value.trim(), Coffee_Name: f.coffee.value.trim(),
    Producer_Farm: f.farm.value.trim() || 'Unknown', Origin: f.origin.value.trim() || 'Unknown',
    Varietal: f.varietal.value.trim() || 'Unknown', Process: f.process.value.trim() || 'Unknown',
    Roast_Level: f.roast.value, Brew_Method: f.brewer.value.trim() || 'Unknown',
    Dose_g: f.dose.value.trim() || 'Unknown', Yield_g: f.yieldG.value.trim() || 'Unknown',
    Ratio: f.ratio.value, Water_Temp_C: f.temp.value.trim() || 'Unknown', Bloom: f.bloom.value.trim() || 'Unknown',
    Grinder: f.grinder.value.trim() || 'Unknown', Price_SGD: f.price.value.trim() || 'Unknown',
    Official_Notes: f.notes.value.trim() || 'Unknown', Your_Verdict: phased || 'Unknown',
    Technical_Enrichment: 'Pending Claude enrichment',
    Visit_Context: f.context.value.trim() || 'Field audit via Gatekeeper', Source: 'Gatekeeper Field Kit',
    Gesha_Alert: 'Unknown', Address: 'Unknown'
  };
  await put('audits', rec);
  audits.value = [rec, ...audits.value];
  for (const k of Object.values(f)) if (k !== f.city && k !== f.date && k !== f.roast && k !== f.ratio) k.value = '';
  toast(`Saved — ${audits.value.length} field entr${audits.value.length === 1 ? 'y' : 'ies'} on device`);
}

async function exportCSV() {
  const all = await getAll<AuditRec>('audits');
  if (!all.length) { toast('No field audits yet'); return; }
  const r = await shareText('Gatekeeper field audits', auditsToCSV(all));
  toast(r === 'shared' ? 'Shared' : r === 'copied' ? 'CSV copied — paste to Claude' : 'Export failed');
}

export function Audit() {
  const [liveSync, setLiveSync] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      interval = setInterval(() => { setSeconds(s => s + 1); }, 1000);
    } else if (!timerActive && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, seconds]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPhase = (sec: number) => {
    if (sec < 180) return { name: 'HOT', desc: 'Volatiles & Aromatics', color: '#ff4d4d', box: f.hot };
    if (sec < 600) return { name: 'MID-COOL', desc: 'Sugars & Malic Acidity', color: '#f39c12', box: f.mid };
    return { name: 'COOL', desc: 'Finish & Defect Check', color: '#3498db', box: f.cool };
  };

  const currentPhase = getPhase(seconds);

  return (
    <div class="pane">
      <div class="sec-lbl">Field Audit — New Entry</div>
      <In s={f.date} b="Date" type="date" />
      <div class="row2">
        <In s={f.cafe} b="Cafe" list="dl-cafes" ph="type or pick a proven café" />
        <In s={f.city} b="City" />
      </div>
      <In s={f.coffee} b="Coffee Name" ph="e.g. Finca Villarazo Pink Bourbon" />
      <div class="row2">
        <In s={f.origin} b="Origin" list="dl-origins" ph="Country, region" />
        <In s={f.farm} b="Producer / Farm" ph="Farm or producer" />
      </div>
      <div class="row2">
        <In s={f.varietal} b="Varietal" list="dl-varietals" ph="type or pick" />
        <In s={f.process} b="Process" list="dl-processes" ph="type or pick" />
      </div>
      <div class="row2">
        <label class="f"><b>Roast Level</b>
          <select value={f.roast.value} onChange={e => f.roast.value = (e.target as HTMLSelectElement).value}>
            {DL.roasts.map(r => <option>{r}</option>)}
          </select></label>
        <In s={f.brewer} b="Brewer" list="dl-brewers" ph="type or pick" />
      </div>
      <div class="row2">
        <In s={f.grinder} b="Grinder" list="dl-grinders" ph="type or pick" />
        <label class="f"><b>Ratio</b>
          <select value={f.ratio.value} onChange={e => f.ratio.value = (e.target as HTMLSelectElement).value}>
            {DL.ratios.map(r => <option>{r}</option>)}
          </select></label>
      </div>
      <div class="row2">
        <In s={f.dose} b="Dose (g)" type="number" ph="15" />
        <In s={f.yieldG} b="Yield (g)" type="number" ph="225" />
      </div>
      <div class="row2">
        <In s={f.temp} b="Water Temp °C" list="dl-temps" ph="92, or 70 → 90 → 70" />
        <In s={f.price} b="Price (SGD)" type="number" ph="9.00" />
      </div>
      <In s={f.bloom} b="Bloom" ph="e.g. 45g / 30s" />
      <In s={f.notes} b="Official Roaster Notes" ph="From the bean card" />
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 2rem;">
        <div class="sec-lbl" style="margin:0;">Three-Phase Read</div>
        <button class="btn small" style="background:var(--pass); border:none; padding: 0.4rem 0.8rem; font-weight:bold; cursor:pointer;" onClick={() => setLiveSync(!liveSync)}>
          {liveSync ? 'Disable Live Sync' : 'Activate Live Sync ⏱️'}
        </button>
      </div>

      {liveSync ? (
        <div style="margin-top: 1rem; padding: 1.5rem; background: var(--bg2); border-radius: 8px; border: 2px solid var(--line); text-align: center;">
          <div style={`font-size: 3rem; font-weight: bold; font-family: monospace; color: ${currentPhase.color}; transition: color 0.3s ease;`}>
            {formatTime(seconds)}
          </div>
          <div style={`font-size: 1.2rem; font-weight: bold; color: ${currentPhase.color}; margin-bottom: 0.5rem;`}>
            PHASE: {currentPhase.name}
          </div>
          <div style="font-size: 0.9rem; color: var(--faint); margin-bottom: 1.5rem;">
            Targeting: {currentPhase.desc}
          </div>
          
          <textarea 
            placeholder={`Log ${currentPhase.name} notes here...`} 
            value={currentPhase.box.value} 
            onInput={e => currentPhase.box.value = (e.target as HTMLTextAreaElement).value} 
            style={`width:100%; min-height:80px; margin-bottom: 1.5rem; border: 1px solid ${currentPhase.color};`}
          />

          <div>
            <button class="btn" style="margin-right: 0.5rem;" onClick={() => setTimerActive(!timerActive)}>
              {timerActive ? 'Pause' : (seconds === 0 ? 'Start Tasting' : 'Resume')}
            </button>
            <button class="btn ghost" onClick={() => { setTimerActive(false); setSeconds(0); }}>Reset</button>
          </div>
        </div>
      ) : (
        <>
          <div class="phase hot"><b>Hot — Volatiles First (0-3m)</b>
            <textarea placeholder="What arrives immediately…" value={f.hot.value} onInput={e => f.hot.value = (e.target as HTMLTextAreaElement).value} /></div>
          <div class="phase mid"><b>Mid-Cool — Sugars Emerge (3-10m)</b>
            <textarea placeholder="What changes as it settles…" value={f.mid.value} onInput={e => f.mid.value = (e.target as HTMLTextAreaElement).value} /></div>
          <div class="phase cool"><b>Cool — The Truth (10m+)</b>
            <textarea placeholder="What lingers at the finish…" value={f.cool.value} onInput={e => f.cool.value = (e.target as HTMLTextAreaElement).value} /></div>
        </>
      )}

      <label class="f"><b>Verdict</b>
        <textarea placeholder="The honest call" value={f.verdict.value} onInput={e => f.verdict.value = (e.target as HTMLTextAreaElement).value} /></label>
      <In s={f.context} b="Visit Context" ph="Solo lunch audit / with Aanya / …" />
      <button class="btn" onClick={save} style="margin-top: 1rem;">Save to Device</button>
      <div style="height:.5rem" />
      <button class="btn ghost" onClick={exportCSV}>Export CSV Rows (master schema)</button>

      <datalist id="dl-cafes">{cafeOptions().map(c => <option>{c}</option>)}</datalist>
      <datalist id="dl-grinders">{DL.grinders.map(g => <option>{g}</option>)}</datalist>
      <datalist id="dl-brewers">{DL.brewers.map(b => <option>{b}</option>)}</datalist>
      <datalist id="dl-varietals">{DL.varietals.map(v => <option>{v}</option>)}</datalist>
      <datalist id="dl-processes">{DL.processes.map(p => <option>{p}</option>)}</datalist>
      <datalist id="dl-origins">{DL.origins.map(o => <option>{o}</option>)}</datalist>
      <datalist id="dl-temps">{DL.temps.map(t => <option>{t}</option>)}</datalist>
    </div>
  );
}
