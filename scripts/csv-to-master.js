import fs from 'fs';
import path from 'path';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const data = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char === '"' && row[j + 1] === '"') {
        current += '"';
        j++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        data.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    data.push(current);
    
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = data[idx]?.trim() ?? '';
    });
    results.push(obj);
  }
  return results;
}

const csvPath = process.argv[2];
const outPath = process.argv[3];

if (!csvPath || !outPath) {
  console.error("Usage: node csv-to-master.js <input.csv> <output.ts>");
  process.exit(1);
}

const csvText = fs.readFileSync(csvPath, 'utf-8');
const records = parseCSV(csvText);

const entries = records.map((r, i) => {
  const isGesha = r['Gesha_Alert'] && r['Gesha_Alert'].includes('GESHA');
  const star = isGesha ? 1 : 0; 

  // Map Brew_Method to geom
  const brewLower = r['Brew_Method']?.toLowerCase() || '';
  let geom = 'unknown';
  if (brewLower.includes('flat') || brewLower.includes('alpha') || brewLower.includes('orea') || brewLower.includes('april') || brewLower.includes('xbloom')) geom = 'flat';
  else if (brewLower.includes('conical') || brewLower.includes('v60') || brewLower.includes('origami')) geom = 'conical';
  else if (brewLower.includes('immersion') || brewLower.includes('switch')) geom = 'immersion';
  else if (brewLower.includes('espresso') || brewLower.includes('piccolo') || brewLower.includes('flat white') || brewLower.includes('cortado') || brewLower.includes('magic')) geom = 'milk';
  else if (brewLower.includes('pour') || brewLower.includes('filter')) geom = 'pour';

  let ratioValue = null;
  const ratioRaw = r['Ratio'];
  if (ratioRaw && ratioRaw.includes(':')) {
    const parts = ratioRaw.split(':');
    ratioValue = parseFloat(parts[1]);
  }

  return {
    ...r, // <--- Crucial fix: preserve exact CSV schema mapping for Folio/Intel
    n: i + 1,
    geom,
    ratioValue: isNaN(ratioValue) ? null : ratioValue,
    star
  };
});

const fileContent = `// GENERATED from ${path.basename(csvPath)} — do not hand-edit.
export interface MasterEntry{ [key: string]: any; n:number; geom:string; ratioValue:number|null; star:number }
export const MASTER:MasterEntry[]=${JSON.stringify(entries)};
`;

fs.writeFileSync(outPath, fileContent);
console.log(`Wrote ${entries.length} entries to ${outPath}`);
