import type { AuditRec } from './store';

export const CSV_HEADER = 'Date,City,Cafe_Name,Coffee_Name,Producer_Farm,Origin,Varietal,Process,Roast_Level,Brew_Method,Dose_g,Yield_g,Ratio,Water_Temp_C,Bloom,Grinder,Price_SGD,Official_Notes,Your_Verdict,Technical_Enrichment,Visit_Context,Source,Gesha_Alert,Address';

export function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function auditsToCSV(audits: AuditRec[]): string {
  const cols = CSV_HEADER.split(',');
  return CSV_HEADER + '\n' + audits.map(a => cols.map(c => csvCell(a[c])).join(',')).join('\n');
}
export async function shareText(title: string, text: string): Promise<'shared'|'copied'|'failed'> {
  try { if (navigator.share) { await navigator.share({ title, text }); return 'shared'; } } catch { /* fall through */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
