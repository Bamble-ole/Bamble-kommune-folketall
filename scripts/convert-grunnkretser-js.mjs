/**
 * convert-grunnkretser-js.mjs
 *
 * Konverterer grunnkretser.js (JS-modul med GeoJSON-data og polygoner)
 * til public/data/grunnkretser.geojson brukt av appen.
 *
 * Kjør med: node scripts/convert-grunnkretser-js.mjs
 *
 * Forutsetter at grunnkretser.js ligger i prosjektmappen (eller oppgis som argument).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Finn grunnkretser.js ──────────────────────────────────────────────────────
const candidates = [
  process.argv[2],                              // valgfritt argument
  join(ROOT, 'grunnkretser.js'),
  join(ROOT, 'scripts', 'grunnkretser.js'),
  join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'grunnkretser.js'),
].filter(Boolean);

let jsPath = null;
for (const p of candidates) {
  if (existsSync(p)) { jsPath = p; break; }
}
if (!jsPath) {
  console.error('Finner ikke grunnkretser.js – legg filen i prosjektmappen eller oppgi sti som argument.');
  process.exit(1);
}
console.log(`Leser: ${jsPath}`);

// ── Hent GeoJSON-objektet fra JS-modulen ─────────────────────────────────────
// Filen bruker "const x = {...}; export default x;" – vi ekstraherer JSON-delen.
let src = readFileSync(jsPath, 'utf8');

// Fjern JS-syntaks: finn første '{' og siste '}'
const start = src.indexOf('{');
const end   = src.lastIndexOf('}');
if (start === -1 || end === -1) {
  console.error('Fant ikke gyldig JSON-objekt i filen.');
  process.exit(1);
}
const jsonStr = src.slice(start, end + 1);
const raw = JSON.parse(jsonStr);

if (!raw.features || !Array.isArray(raw.features)) {
  console.error('Filen har ingen features-array.');
  process.exit(1);
}

// ── Bygg rent GeoJSON med bare geometri + nødvendige properties ───────────────
// Appen matcher på grunnkretsnavn og bruker grunnkretsnummer som ID.
// Population-data hentes fra population-YYYY.json – vi beholder kun ID-felter.

const features = raw.features.map(f => {
  const p = f.properties;
  return {
    type: 'Feature',
    properties: {
      grunnkretsnummer: p.grunnkretsnummer,
      grunnkretsnavn:   p.grunnkretsnavn,
      kommunenummer:    p.kommunenummer,
      kommunenavn:      p.kommunenavn,
    },
    geometry: f.geometry,
  };
});

// Sorter etter grunnkretsnummer for forutsigbar rekkefølge
features.sort((a, b) => a.properties.grunnkretsnummer - b.properties.grunnkretsnummer);

const geojson = {
  type: 'FeatureCollection',
  name: 'Grunnkretser',
  features,
};

// ── Skriv til public/data/grunnkretser.geojson ───────────────────────────────
const outDir = join(ROOT, 'public', 'data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'grunnkretser.geojson');
writeFileSync(outPath, JSON.stringify(geojson, null, 2), 'utf8');

console.log(`✓ Skrev ${features.length} grunnkretser til ${outPath}`);

// ── Valider at alle 25 forventede grunnkretser er med ────────────────────────
const EXPECTED = [
  'Herre','Asdal','Torsdal-Nenset','Findal','Omborsnes','Stein',
  'Stathelle','Krabberødstrand','Krabberød','Eikstrand','Eik','Grasmyr',
  'Vaterland','Sota','Slaattenes','Skarpenord','Fagerheim','Nustad',
  'Rørholt','Dørdal','Bleikelia','Rønholt','Valle','Kjørstad','Brevikstrand',
];
const names = new Set(features.map(f => f.properties.grunnkretsnavn));
const missing = EXPECTED.filter(n => !names.has(n));
if (missing.length > 0) {
  console.warn(`\n⚠ Disse navnene fra population-filene finnes IKKE i geojson (matching vil svikte):`);
  console.warn(missing.map(n => `  - "${n}"`).join('\n'));
  console.warn('\nSjekk at grunnkretsnavn i grunnkretser.js stemmer overens (inkl. norske tegn).');
  console.warn('Navn funnet i filen:', [...names].filter(n => !EXPECTED.includes(n)));
} else {
  console.log('✓ Alle 25 grunnkretsnavn stemmer overens med population-filene.');
}
