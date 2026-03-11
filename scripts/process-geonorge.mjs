/**
 * Data pipeline script for processing new Geonorge / SSB data.
 *
 * Usage:
 *   node scripts/process-geonorge.mjs \
 *     --geo ./data/raw/grunnkretser-<year>.geojson \
 *     --pop ./data/raw/ssb-befolkning-<year>.csv \
 *     --year 2024 \
 *     --out ./public/data/grunnkretser.geojson
 *
 * The SSB CSV is exported from:
 *   https://www.ssb.no/statbank/table/06913/
 * with rows: Grunnkrets, Age group, Year, Population
 *
 * The Geonorge GeoJSON (grunnkretser boundaries) can be downloaded from:
 *   https://kartkatalog.geonorge.no/ → search "Grunnkretser"
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const geoFile = getArg('--geo');
const popFile = getArg('--pop');
const yearStr = getArg('--year') || '2024';
const outFile = getArg('--out') || join(__dirname, '../public/data/grunnkretser.geojson');
const year = parseInt(yearStr, 10);

if (!geoFile || !popFile) {
  console.error('Usage: node process-geonorge.mjs --geo <file> --pop <file> [--year <year>] [--out <file>]');
  process.exit(1);
}

// ── Read inputs ───────────────────────────────────────────────────────────────
const geo = JSON.parse(readFileSync(geoFile, 'utf-8'));
const csvText = readFileSync(popFile, 'utf-8');

// ── Parse SSB CSV ─────────────────────────────────────────────────────────────
// SSB exports semicolon-separated files with BOM sometimes.
// Expected columns (may vary): grunnkretskode, aldersgruppe, år, personer
function parseSSBCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  const headers = lines[0].split(';').map(h => h.trim().toLowerCase());

  const findCol = (...candidates) => {
    for (const c of candidates) {
      const i = headers.findIndex(h => h.includes(c));
      if (i >= 0) return i;
    }
    return -1;
  };

  const colId   = findCol('grunnkrets', 'kode', 'id');
  const colAge  = findCol('alder', 'age', 'aldersgruppe');
  const colPop  = findCol('person', 'befolkning', 'antall', 'value');
  const colYear = findCol('år', 'year');

  if (colId < 0 || colAge < 0 || colPop < 0) {
    throw new Error(`Cannot find required columns in CSV. Headers found: ${headers.join(', ')}`);
  }

  /** @type {Map<string, Record<string, number>>} grunnkretsId -> ageGroup -> count */
  const byArea = new Map();

  for (const line of lines.slice(1)) {
    const cells = line.split(';');
    const areaId = (cells[colId] || '').trim().replace(/^"/, '').replace(/"$/, '');
    const ageRaw = (cells[colAge] || '').trim();
    const popRaw = parseInt((cells[colPop] || '0').replace(/\s/g, '').trim(), 10);
    const rowYear = colYear >= 0 ? parseInt(cells[colYear], 10) : year;

    if (rowYear !== year || !areaId || isNaN(popRaw)) continue;

    // Normalise age group label to "0-4" format
    const age = ageRaw
      .replace('år', '').replace('år og over', '+')
      .replace(' - ', '-').replace('–', '-').trim();

    if (!byArea.has(areaId)) byArea.set(areaId, {});
    byArea.get(areaId)[age] = (byArea.get(areaId)[age] || 0) + popRaw;
  }

  return byArea;
}

const populationByArea = parseSSBCsv(csvText);
console.log(`Parsed ${populationByArea.size} areas from CSV`);

// ── Merge into GeoJSON ─────────────────────────────────────────────────────────
const AGE_FIELD_MAP = {
  '0-4':   'befolkning0Til04År',
  '5-9':   'befolkning05Til09År',
  '10-14': 'befolkning10Til14År',
  '15-19': 'befolkning15Til19År',
  '20-24': 'befolkning20Til24År',
  '25-29': 'befolkning25Til29År',
  '30-34': 'befolkning30Til34År',
  '35-39': 'befolkning35Til39År',
  '40-44': 'befolkning40Til44År',
  '45-49': 'befolkning45Til49År',
  '50-54': 'befolkning50Til54År',
  '55-59': 'befolkning55Til59År',
  '60-64': 'befolkning60Til64År',
  '65-69': 'befolkning65Til69År',
  '70-74': 'befolkning70Til74År',
  '75-79': 'befolkning75Til79År',
  '80-84': 'befolkning80Til84År',
  '85-89': 'befolkning85Til89År',
  '90+':   'befolkning90ÅrOgOver',
};

let merged = 0;
let notFound = 0;

for (const feature of geo.features) {
  const p = feature.properties;
  // Try common ID field names from Geonorge
  const areaId = p.grunnkretsnummer || p.grunnkretsNummer || p.grunnkretsId ||
                 p.kommunenummer + (p.grunnkretskode || p.grunnkretsnr || '');

  const popData = populationByArea.get(String(areaId));
  if (!popData) { notFound++; continue; }

  let total = 0;
  for (const [age, field] of Object.entries(AGE_FIELD_MAP)) {
    const count = popData[age] || 0;
    p[field] = count;
    total += count;
  }
  p.totalBefolkning = total;
  p.statistikkÅr = year;
  merged++;
}

console.log(`Merged: ${merged} features, not found: ${notFound}`);

// ── Write output ───────────────────────────────────────────────────────────────
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(geo));
console.log(`Written: ${outFile}`);

console.log('\nHow to add a new year:');
console.log('1. Download new grunnkretser GeoJSON from Geonorge');
console.log('2. Download population CSV from SSB (table 06913)');
console.log('3. Run this script with --year <new_year>');
console.log('4. Update availableYears in src/store/mapStore.ts');
