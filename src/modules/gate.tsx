import { signal } from '@preact/signals';
import { criteria, wishlist, toast, persistWishlist } from '../state';
import { put, del, uid, type Criterion } from '../services/store';

const name = signal(''); const areaS = signal('');
const on = signal<Record<string, boolean>>({});
const thresh = signal(65);
const newC = signal(''); const newW = signal(5);

export function gateCandidate(n: string, area: string) { name.value = n; areaS.value = area; on.value = {}; }

function calc() {
  const tot = criteria.value.reduce((s, c) => s + c.weight, 0) || 1;
  const got = criteria.value.filter(c => on.value[c.id]).reduce((s, c) => s + c.weight, 0);
  return Math.round((got / tot) * 100);
}

async function record(declined: boolean) {
  const n = name.value.trim();
  if (!n) { toast('Name the candidate first'); return; }
  const pct = calc();
  await put('examinations', { id: uid(), cafeName: n, date: new Date().toISOString().slice(0, 10), score: pct, verdict: declined ? 'fail' : 'pass' });
  if (!declined) {
    const w = { id: uid(), name: n, area: areaS.value.trim(), priority: 'MEDIUM' as const,
      note: `Passed the examination at ${pct}%`, gateScore: pct, added: new Date().toISOString().slice(0, 10) };
    await persistWishlist(w); wishlist.value = [w, ...wishlist.value];
    toast('Admitted → Pipeline');
  } else toast(`Declined at ${pct}% — recorded`);
  name.value = ''; areaS.value = ''; on.value = {};
}

export function Gate() {
  const pct = calc();
  const any = criteria.value.some(c => on.value[c.id]);
  const pass = pct >= thresh.value;
  return (
    <div class="pane">
      <div class="sec-lbl">Candidate</div>
      <div class="row2">
        <input type="text" placeholder="Cafe name" value={name.value} onInput={e => name.value = (e.target as HTMLInputElement).value} />
        <input type="text" placeholder="Area / city" value={areaS.value} onInput={e => areaS.value = (e.target as HTMLInputElement).value} />
      </div>
      <div class="sec-lbl">The Examination</div>
      <p class="hint">Toggle what the candidate satisfies. Cafés don't get added to the list — they apply, and most fail.</p>
      {criteria.value.map(c => (
        <div class={'crit' + (on.value[c.id] ? ' yes' : '')}>
          <span class="nm">{c.text}</span><span class="wt">×{c.weight}</span>
          <div class="tgl" onClick={() => { on.value = { ...on.value, [c.id]: !on.value[c.id] }; }} />
          <button class="del" onClick={async () => { criteria.value = criteria.value.filter(x => x.id !== c.id); await del('criteria', c.id); }}>✕</button>
        </div>
      ))}
      <div class="addrow">
        <input type="text" placeholder="new criterion…" value={newC.value} onInput={e => newC.value = (e.target as HTMLInputElement).value} />
        <input type="number" min={1} max={10} value={newW.value} onInput={e => newW.value = +(e.target as HTMLInputElement).value || 5} />
        <button class="btn small" onClick={async () => {
          const t = newC.value.trim(); if (!t) return;
          const c: Criterion = { id: uid(), text: t, weight: Math.min(10, Math.max(1, newW.value)) };
          criteria.value = [...criteria.value, c]; await put('criteria', c); newC.value = '';
        }}>Add</button>
      </div>
      <div class="sec-lbl">Admission Threshold</div>
      <div class="thresh-row">
        <input type="range" min={30} max={95} value={thresh.value} onInput={e => thresh.value = +(e.target as HTMLInputElement).value} />
        <span>{thresh.value}%</span>
      </div>
      <div class={'gate-score ' + (any ? (pass ? 'pass' : 'fail') : '')}>
        <div class="sc">{any ? pct + '%' : '—'}</div>
        <div class="vd">{any ? (pass ? '✓ Worthy of the List' : '✗ Does Not Pass') : 'Awaiting Examination'}</div>
      </div>
      <div class="row2">
        <button class="btn" onClick={() => record(false)}>Admit to Pipeline</button>
        <button class="btn ghost" onClick={() => record(true)}>Log as Declined</button>
      </div>
    </div>
  );
}
