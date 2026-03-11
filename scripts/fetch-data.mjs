#!/usr/bin/env node
/**
 * fetch-data.mjs – Bamble Befolkningsstatistikk
 *
 * GeoNorge WFS returnerer GML for GJELDENDE ÅR (kun siste publiserte).
 * Historiske år må lastes ned manuelt – se instruksjoner nederst.
 *
 * Kjør:  node scripts/fetch-data.mjs
 * Krav:  Node 18+
 *
 * ─── Hva scriptet gjør ───────────────────────────────────────────────────────
 *  1. Henter GML fra GeoNorge WFS (returnerer alle kommuner, ett år)
 *  2. Filtrerer til Bamble sine grunnkretser client-side
 *  3. Lagrer population-YYYY.json og oppdatert grunnkretser.geojson
 *
 * ─── For historiske år (2015–2023) ───────────────────────────────────────────
 *  Last ned GML manuelt fra GeoNorge:
 *    https://nedlasting.geonorge.no/geonorge/Befolkning/BefolkningPaaGrunnkretsniva/GML/
 *  Deretter: node scripts/process-gml.mjs --input <fil.gml> [--year 2020]
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT       = join(__dirname, '..', 'public', 'data');

// Alle Bamble kommunenummer (brukes til client-side filtrering)
const BAMBLE_KNR = new Set(['814', '0814', '3813', '4012']);

const WFS_URL =
  'https://wfs.geonorge.no/skwms1/wfs.befolkningpagrunnkretsniva' +
  '?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature' +
  '&TYPENAMES=app:BefolkningP%C3%A5Grunnkrets' +   // app:BefolkningPåGrunnkrets (URL-kodet)
  '&SRSNAME=urn:ogc:def:crs:EPSG::4326';           // lat/lon for GeoJSON

// ─── GML-tekst-hjelpere ───────────────────────────────────────────────────────

function gmlText(block, tag) {
  const re = new RegExp(`<(?:[^:>]+:)?${tag}>([^<]*)</(?:[^:>]+:)?${tag}>`);
  const m  = re.exec(block);
  return m ? m[1].trim() : null;
}

function gmlNum(block, tag) {
  const v = gmlText(block, tag);
  return v !== null ? (parseFloat(v) || 0) : 0;
}

// ─── GML-geometri → GeoJSON ───────────────────────────────────────────────────
// EPSG:4326 har akserekkefølge lat/lon (Y X) – vi bytter til lon/lat for GeoJSON.

function posListToCoords(str) {
  const nums = str.trim().split(/\s+/).map(Number);
  const out  = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push([nums[i + 1], nums[i]]); // bytt Y X → X Y
  }
  return out;
}

function parseRing(xml) {
  const m = /<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/.exec(xml);
  return m ? posListToCoords(m[1]) : [];
}

function parsePolygon(xml) {
  const rings = [];
  const ext = /<gml:exterior>([\s\S]*?)<\/gml:exterior>/.exec(xml);
  if (ext) rings.push(parseRing(ext[1]));
  const intRe = /<gml:interior>([\s\S]*?)<\/gml:interior>/g;
  let m;
  while ((m = intRe.exec(xml)) !== null) rings.push(parseRing(m[1]));
  return rings;
}

function parseGeometry(xml) {
  if (/<gml:MultiSurface/.test(xml)) {
    const coordinates = [];
    const re = /<gml:surfaceMember>([\s\S]*?)<\/gml:surfaceMember>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const pm = /<gml:Polygon[^>]*>([\s\S]*?)<\/gml:Polygon>/.exec(m[1]);
      if (pm) coordinates.push(parsePolygon(pm[1]));
    }
    return coordinates.length === 1
      ? { type: 'Polygon',      coordinates: coordinates[0] }
      : { type: 'MultiPolygon', coordinates };
  }
  const pm = /<gml:Polygon[^>]*>([\s\S]*?)<\/gml:Polygon>/.exec(xml);
  if (pm) return { type: 'Polygon', coordinates: parsePolygon(pm[1]) };
  return null;
}

// ─── Hoved-GML-parser ─────────────────────────────────────────────────────────

const POP_FIELDS = {
  '0-4':   'befolkning0Til04.r',   // fallback-mønster – matcher både År og Aar
  '5-9':   'befolkning05Til09.r',
  '10-14': 'befolkning10Til14.r',
  '15-19': 'befolkning15Til19.r',
  '20-24': 'befolkning20Til24.r',
  '25-29': 'befolkning25Til29.r',
  '30-34': 'befolkning30Til34.r',
  '35-39': 'befolkning35Til39.r',
  '40-44': 'befolkning40Til44.r',
  '45-49': 'befolkning45Til49.r',
  '50-54': 'befolkning50Til54.r',
  '55-59': 'befolkning55Til59.r',
  '60-64': 'befolkning60Til64.r',
  '65-69': 'befolkning65Til69.r',
  '70-74': 'befolkning70Til74.r',
  '75-79': 'befolkning75Til79.r',
  '80-84': 'befolkning80Til84.r',
  '85-89': 'befolkning85Til89.r',
  '90+':   'befolkning90.rOgOver',
};

// Eksakte GML-feltnavn for aldersgrupper (GeoNorge-format)
const AGE_GML = {
  '0-4':   ['befolkning0Til04År',   'befolkning0Til04Aar'],
  '5-9':   ['befolkning05Til09År',  'befolkning05Til09Aar'],
  '10-14': ['befolkning10Til14År',  'befolkning10Til14Aar'],
  '15-19': ['befolkning15Til19År',  'befolkning15Til19Aar'],
  '20-24': ['befolkning20Til24År',  'befolkning20Til24Aar'],
  '25-29': ['befolkning25Til29År',  'befolkning25Til29Aar'],
  '30-34': ['befolkning30Til34År',  'befolkning30Til34Aar'],
  '35-39': ['befolkning35Til39År',  'befolkning35Til39Aar'],
  '40-44': ['befolkning40Til44År',  'befolkning40Til44Aar'],
  '45-49': ['befolkning45Til49År',  'befolkning45Til49Aar'],
  '50-54': ['befolkning50Til54År',  'befolkning50Til54Aar'],
  '55-59': ['befolkning55Til59År',  'befolkning55Til59Aar'],
  '60-64': ['befolkning60Til64År',  'befolkning60Til64Aar'],
  '65-69': ['befolkning65Til69År',  'befolkning65Til69Aar'],
  '70-74': ['befolkning70Til74År',  'befolkning70Til74Aar'],
  '75-79': ['befolkning75Til79År',  'befolkning75Til79Aar'],
  '80-84': ['befolkning80Til84År',  'befolkning80Til84Aar'],
  '85-89': ['befolkning85Til89År',  'befolkning85Til89Aar'],
  '90+':   ['befolkning90ÅrOgOver', 'befolkning90AarOgOver'],
};

function getAge(block, band) {
  for (const tag of AGE_GML[band]) {
    const v = gmlText(block, tag);
    if (v !== null) return parseFloat(v) || 0;
  }
  return 0;
}

function parseGML(gml) {
  // Matcher feature-elementet uavhengig av namespace-prefiks
  const featureRe = /<[^:>]+:BefolkningP[^\s>]*Grunnkrets\b[^>]*>([\s\S]*?)<\/[^:>]+:BefolkningP[^\s>]*Grunnkrets>/g;

  const allFeatures = [];
  let match;

  while ((match = featureRe.exec(gml)) !== null) {
    const block = match[1];

    const kommunenummer = gmlText(block, 'kommunenummer') ?? '';
    if (!BAMBLE_KNR.has(kommunenummer)) continue; // hopp over alle andre kommuner

    const statistikkÅr   = gmlNum(block, 'statistikk.r') ||
                           gmlNum(block, 'statistikkAar') ||
                           gmlNum(block, 'statistikkÅr');
    const grunnkretsId   = gmlText(block, 'grunnkretsnummer') ?? gmlText(block, 'grunnkretsId') ?? '';
    const grunnkretsnavn = gmlText(block, 'grunnkretsnavn') ?? '';
    const kommunenavn    = gmlText(block, 'kommunenavn') ?? '';
    const totalBef       = gmlNum(block, 'totalBefolkning');
    const antallMenn     = gmlNum(block, 'antallMenn');
    const antallKvinner  = gmlNum(block, 'antallKvinner');

    const befolkningAldersgrupper = {};
    const geoAgeProps = {};
    for (const band of Object.keys(AGE_GML)) {
      const val = getAge(block, band);
      befolkningAldersgrupper[band] = val;
      geoAgeProps[AGE_GML[band][0]] = val; // bruk standard norsk feltnavn
    }

    const geomM    = /<(?:[^:>]+:)?geometry>([\s\S]*?)<\/(?:[^:>]+:)?geometry>/.exec(block);
    const geometry = geomM ? parseGeometry(geomM[1]) : null;

    allFeatures.push({
      statistikkÅr,
      grunnkretsId,
      grunnkretsnavn,
      kommunenummer,
      kommunenavn,
      totalBefolkning: totalBef,
      antallMenn,
      antallKvinner,
      befolkningAldersgrupper,
      // Til GeoJSON
      _geometry: geometry,
      _geoAgeProps: geoAgeProps,
    });
  }

  return allFeatures;
}

// ─── Hjelpere ─────────────────────────────────────────────────────────────────

function save(filename, data) {
  writeFileSync(join(OUT, filename), JSON.stringify(data, null, 2), 'utf-8');
  const kb = (JSON.stringify(data).length / 1024).toFixed(1);
  console.log(`  ✓ ${filename}  (${kb} kB)`);
}

// ─── Hoved-funksjon ───────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Bamble Data Fetcher  –  GeoNorge WFS (GML)      ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('  Henter GML fra GeoNorge (hele Norge, filtreres til Bamble)...');
  console.log(`  URL: ${WFS_URL}\n`);

  let gml;
  try {
    const res = await fetch(WFS_URL, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    gml = await res.text();
  } catch (err) {
    console.error(`\n✗ Klarte ikke hente data: ${err.message}`);
    process.exit(1);
  }

  // Feilsjekk
  if (/<ows:ExceptionReport/.test(gml)) {
    const m = /<ows:ExceptionText[^>]*>([\s\S]*?)<\/ows:ExceptionText>/.exec(gml);
    console.error(`\n✗ WFS ExceptionReport: ${m?.[1]?.trim() ?? 'ukjent feil'}`);
    process.exit(1);
  }

  console.log('  Parser GML og filtrerer til Bamble...');
  const features = parseGML(gml);

  if (!features.length) {
    // Debug: vis GML-start for å finne riktig elementnavn
    console.error('\n✗ Ingen Bamble-grunnkretser funnet i GML-svaret.');
    console.error('  GML-start (første 600 tegn):');
    console.error('  ' + gml.slice(0, 600).replace(/\s+/g, ' '));
    process.exit(1);
  }

  // Grupper per statistikkÅr
  const byYear = new Map();
  for (const f of features) {
    const y = f.statistikkÅr;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(f);
  }

  const sortedYears = [...byYear.keys()].sort();
  console.log(`\n  Fant ${features.length} Bamble-features over år: ${sortedYears.join(', ')}\n`);

  const latestYear = sortedYears.at(-1);

  for (const year of sortedYears) {
    const entries = byYear.get(year);

    // population-YYYY.json (ingen geometri)
    const popEntries = entries.map(f => ({
      statistikkÅr:            f.statistikkÅr,
      grunnkretsId:            f.grunnkretsId,
      grunnkretsnavn:          f.grunnkretsnavn,
      kommunenummer:           f.kommunenummer,
      kommunenavn:             f.kommunenavn,
      totalBefolkning:         f.totalBefolkning,
      antallMenn:              f.antallMenn,
      antallKvinner:           f.antallKvinner,
      befolkningAldersgrupper: f.befolkningAldersgrupper,
    }));
    save(`population-${year}.json`, popEntries);

    // grunnkretser.geojson for siste år (med geometri)
    if (year === latestYear) {
      const geojson = {
        type: 'FeatureCollection',
        name: 'BefolkningPåGrunnkrets',
        features: entries.map(f => ({
          type: 'Feature',
          properties: {
            grunnkretsnummer: parseInt(f.grunnkretsId) || 0,
            grunnkretsnavn:   f.grunnkretsnavn,
            kommunenummer:    parseInt(f.kommunenummer) || 0,
            kommunenavn:      f.kommunenavn,
            totalBefolkning:  f.totalBefolkning,
            antallMenn:       f.antallMenn,
            antallKvinner:    f.antallKvinner,
            statistikkÅr:     f.statistikkÅr,
            ...f._geoAgeProps,
          },
          geometry: f._geometry,
        })),
      };
      save('grunnkretser.geojson', geojson);
    }
  }

  // ─── Manglende år ─────────────────────────────────────────────────────────
  const allWantedYears = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  const missingYears   = allWantedYears.filter(y => !byYear.has(y));

  console.log('\n──────────────────────────────────────────────────────');
  if (missingYears.length === 0) {
    console.log('✅  Alle år hentet!\n');
  } else {
    console.log(`✅  WFS-data lagret for: ${sortedYears.join(', ')}`);
    console.log(`\n⚠  Mangler år: ${missingYears.join(', ')}`);
    console.log(`
   GeoNorge WFS serverer kun gjeldende år (${latestYear}).
   For historiske år – last ned GML-filer manuelt:

   1. Gå til https://kartkatalog.geonorge.no
      Søk: "Befolkning på grunnkretsnivå"
      Velg nedlasting → GML → filtrer på Bamble (knr 0814/3813/4012)
      Last ned én fil per år du mangler.

   2. Behandle filen:
      node scripts/process-gml.mjs --input <fil.gml> --year <årstall>

   (process-gml.mjs lages automatisk neste gang du kjører dette scriptet)
`);
    // Lag process-gml.mjs automatisk hvis den ikke finnes
    await createProcessGmlScript();
  }
}

// ─── Lag process-gml.mjs (behandler manuelt nedlastede GML-filer) ────────────

async function createProcessGmlScript() {
  const { existsSync, readFileSync } = await import('fs');
  const scriptPath = join(__dirname, 'process-gml.mjs');
  if (existsSync(scriptPath)) return; // allerede laget

  writeFileSync(scriptPath, `#!/usr/bin/env node
/**
 * process-gml.mjs – Behandler manuelt nedlastet GML fra GeoNorge
 *
 * Bruk:  node scripts/process-gml.mjs --input <fil.gml> --year <årstall>
 * Eks:   node scripts/process-gml.mjs --input ~/Downloads/bamble-2020.gml --year 2020
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data');

const args     = process.argv.slice(2);
const getArg   = f => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null; };
const inputFile = getArg('--input');
const yearArg  = getArg('--year');

if (!inputFile) {
  console.error('Bruk: node scripts/process-gml.mjs --input <fil.gml> [--year <årstall>]');
  process.exit(1);
}

const BAMBLE_KNR = new Set(['814','0814','3813','4012']);

const AGE_GML = {
  '0-4':   ['befolkning0Til04År','befolkning0Til04Aar'],
  '5-9':   ['befolkning05Til09År','befolkning05Til09Aar'],
  '10-14': ['befolkning10Til14År','befolkning10Til14Aar'],
  '15-19': ['befolkning15Til19År','befolkning15Til19Aar'],
  '20-24': ['befolkning20Til24År','befolkning20Til24Aar'],
  '25-29': ['befolkning25Til29År','befolkning25Til29Aar'],
  '30-34': ['befolkning30Til34År','befolkning30Til34Aar'],
  '35-39': ['befolkning35Til39År','befolkning35Til39Aar'],
  '40-44': ['befolkning40Til44År','befolkning40Til44Aar'],
  '45-49': ['befolkning45Til49År','befolkning45Til49Aar'],
  '50-54': ['befolkning50Til54År','befolkning50Til54Aar'],
  '55-59': ['befolkning55Til59År','befolkning55Til59Aar'],
  '60-64': ['befolkning60Til64År','befolkning60Til64Aar'],
  '65-69': ['befolkning65Til69År','befolkning65Til69Aar'],
  '70-74': ['befolkning70Til74År','befolkning70Til74Aar'],
  '75-79': ['befolkning75Til79År','befolkning75Til79Aar'],
  '80-84': ['befolkning80Til84År','befolkning80Til84Aar'],
  '85-89': ['befolkning85Til89År','befolkning85Til89Aar'],
  '90+':   ['befolkning90ÅrOgOver','befolkning90AarOgOver'],
};

function gmlText(block, tag) {
  const re = new RegExp(\`<(?:[^:>]+:)?\${tag}>([^<]*)</(?:[^:>]+:)?\${tag}>\`);
  const m  = re.exec(block);
  return m ? m[1].trim() : null;
}

function gmlNum(block, tag) { const v = gmlText(block, tag); return v ? parseFloat(v)||0 : 0; }

function getAge(block, band) {
  for (const tag of AGE_GML[band]) {
    const v = gmlText(block, tag);
    if (v !== null) return parseFloat(v)||0;
  }
  return 0;
}

const gml = readFileSync(inputFile, 'utf-8');
const featureRe = /<[^:>]+:BefolkningP[^\\s>]*Grunnkrets\\b[^>]*>([\\s\\S]*?)<\\/[^:>]+:BefolkningP[^\\s>]*Grunnkrets>/g;

const entries = [];
let match;
while ((match = featureRe.exec(gml)) !== null) {
  const block = match[1];
  const knr = gmlText(block, 'kommunenummer') ?? '';
  if (!BAMBLE_KNR.has(knr)) continue;

  const statistikkÅr = parseInt(yearArg) || gmlNum(block, 'statistikkÅr') || gmlNum(block, 'statistikkAar');
  const befolkningAldersgrupper = {};
  for (const band of Object.keys(AGE_GML)) befolkningAldersgrupper[band] = getAge(block, band);

  entries.push({
    statistikkÅr,
    grunnkretsId:   gmlText(block,'grunnkretsnummer') ?? '',
    grunnkretsnavn: gmlText(block,'grunnkretsnavn') ?? '',
    kommunenummer:  knr,
    kommunenavn:    gmlText(block,'kommunenavn') ?? '',
    totalBefolkning: gmlNum(block,'totalBefolkning'),
    antallMenn:     gmlNum(block,'antallMenn'),
    antallKvinner:  gmlNum(block,'antallKvinner'),
    befolkningAldersgrupper,
  });
}

const year = parseInt(yearArg) || entries[0]?.statistikkÅr;
if (!entries.length) { console.error('Ingen Bamble-grunnkretser funnet i filen.'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const outFile = join(OUT, \`population-\${year}.json\`);
writeFileSync(outFile, JSON.stringify(entries, null, 2), 'utf-8');
console.log(\`✓ Lagret \${entries.length} grunnkretser → \${outFile}\`);
`, 'utf-8');

  console.log('  ✓ Lagde scripts/process-gml.mjs for manuell GML-behandling');
}

main().catch(err => { console.error('\n❌ Fatal feil:', err); process.exit(1); });
