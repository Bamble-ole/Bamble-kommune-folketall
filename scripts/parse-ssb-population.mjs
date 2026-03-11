/**
 * parse-ssb-population.mjs
 *
 * Parser for SSB PX-JSON data (2015-2025.json).
 * Genererer population-YYYY.json for hvert år i public/data/.
 *
 * Kjør med: node scripts/parse-ssb-population.mjs
 *
 * Dimensjoner i SSB-filen:
 *   id: ["Region", "Kjonn", "ContentsCode", "Tid", "Alder"]
 *   size: [75, 2, 1, 11, 11]
 *
 * Aldersgrupper fra SSB (11 stk):
 *   0: 00-05  (0–5 år,  6 alderstrinn)
 *   1: 06-15  (6–15 år, 10 alderstrinn)
 *   2: 16-19  (16–19 år, 4 alderstrinn)
 *   3: 20-24
 *   4: 25-29
 *   5: 30-49  (20 alderstrinn)
 *   6: 50-59  (10 alderstrinn)
 *   7: 60-66  (7 alderstrinn)
 *   8: 67-69  (3 alderstrinn)
 *   9: 70-79  (10 alderstrinn)
 *  10: 080+
 *
 * Kommunekoder over tid:
 *   2015–2019: 0814xxxx  (gammel Telemark-kode)
 *   2020–2023: 3813xxxx  (Vestfold og Telemark)
 *   2024–2025: 4012xxxx  (ny Telemark) + 04121104 for Stein
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Last SSB-data ─────────────────────────────────────────────────────────────
// Prøv først i prosjektrot, deretter i Downloads
const ssbPath = (() => {
  const candidates = [
    join(ROOT, '2015-2025.json'),
    join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', '2015-2025.json'),
  ];
  for (const p of candidates) {
    try { readFileSync(p); return p; } catch { /* prøv neste */ }
  }
  throw new Error('Finner ikke 2015-2025.json – legg den i prosjektmappen eller Downloads');
})();
const ssb = JSON.parse(readFileSync(ssbPath, 'utf8'));

const nKjonn  = 2;   // Kvinner=0, Menn=1
const nTid    = 11;  // 2015–2025
const nAlder  = 11;  // 11 SSB-aldersgrupper
const values  = ssb.value;

const regionIndex = ssb.dimension.Region.category.index;   // {kode: posisjon}
const tidIndex    = ssb.dimension.Tid.category.index;       // {"2015": 0, ...}

/** Hent enkeltverdi fra flat array */
function val(regionIdx, kjonnIdx, tidIdx, alderIdx) {
  const i = regionIdx * (nKjonn * nTid * nAlder)
          + kjonnIdx  * (nTid * nAlder)
          + tidIdx    * nAlder
          + alderIdx;
  return values[i] || 0;
}

/** Sum begge kjønn, én SSB-aldersgruppe */
function ageVal(regionIdx, tidIdx, alderIdx) {
  return val(regionIdx, 0, tidIdx, alderIdx)   // Kvinner
       + val(regionIdx, 1, tidIdx, alderIdx);  // Menn
}

/** Sum begge kjønn, alle SSB-aldersgrupper → totalbefolkning */
function totalPop(regionIdx, tidIdx) {
  let t = 0;
  for (let a = 0; a < nAlder; a++) t += ageVal(regionIdx, tidIdx, a);
  return t;
}

function mennPop(regionIdx, tidIdx) {
  let t = 0;
  for (let a = 0; a < nAlder; a++) t += val(regionIdx, 1, tidIdx, a);
  return t;
}

function kvinnerPop(regionIdx, tidIdx) {
  let t = 0;
  for (let a = 0; a < nAlder; a++) t += val(regionIdx, 0, tidIdx, a);
  return t;
}

/**
 * Fordel SSB-aldersgrupper (11 stk) til app-aldersgrupper (19 stk, 5-årig).
 *
 * SSB → App-mapping (proporsjonalt):
 *  00-05 (6 år):  5/6 → 0-4,  1/6 → 5-9
 *  06-15 (10 år): 4/10 → 5-9,  5/10 → 10-14,  1/10 → 15-19
 *  16-19 (4 år):  alle → 15-19
 *  20-24: alle → 20-24
 *  25-29: alle → 25-29
 *  30-49 (20 år): ¼ til hvert av 30-34, 35-39, 40-44, 45-49
 *  50-59 (10 år): ½ → 50-54, ½ → 55-59
 *  60-66 (7 år):  5/7 → 60-64, 2/7 → (del av) 65-69
 *  67-69 (3 år):  alle → 65-69 (kombinert med del fra 60-66)
 *  70-79 (10 år): ½ → 70-74, ½ → 75-79
 *  080+:          45% → 80-84, 33% → 85-89, resten → 90+
 */
function mapAgeGroups(regionIdx, tidIdx) {
  const s = Array.from({ length: nAlder }, (_, a) => ageVal(regionIdx, tidIdx, a));

  // ── 0–15-grupper ─────────────────────────────────────────────────────────
  const a0_4  = Math.round(s[0] * 5 / 6);
  const a5_9  = s[0] - a0_4 + Math.round(s[1] * 4 / 10);   // rest av 00-05 + 4/10 av 06-15
  const a10_14 = Math.round(s[1] * 5 / 10);
  const a15_19 = s[1] - Math.round(s[1] * 4 / 10) - a10_14  // rest av 06-15 (alder 15)
               + s[2];                                        // + alle 16-19

  // ── 20–29 ─────────────────────────────────────────────────────────────────
  const a20_24 = s[3];
  const a25_29 = s[4];

  // ── 30–49 (fordel jevnt på 4 grupper) ────────────────────────────────────
  const q30 = Math.floor(s[5] / 4);
  const r30 = s[5] - q30 * 4;
  const a30_34 = q30 + (r30 > 0 ? 1 : 0);
  const a35_39 = q30 + (r30 > 1 ? 1 : 0);
  const a40_44 = q30 + (r30 > 2 ? 1 : 0);
  const a45_49 = q30;

  // ── 50–59 ─────────────────────────────────────────────────────────────────
  const a50_54 = Math.round(s[6] / 2);
  const a55_59 = s[6] - a50_54;

  // ── 60–69 ─────────────────────────────────────────────────────────────────
  const a60_64 = Math.round(s[7] * 5 / 7);
  const a65_69 = (s[7] - a60_64) + s[8];  // rest av 60-66 (alder 65-66) + alle 67-69

  // ── 70–79 ─────────────────────────────────────────────────────────────────
  const a70_74 = Math.round(s[9] / 2);
  const a75_79 = s[9] - a70_74;

  // ── 80+ ───────────────────────────────────────────────────────────────────
  const a80_84 = Math.round(s[10] * 0.45);
  const a85_89 = Math.round(s[10] * 0.33);
  const a90p   = s[10] - a80_84 - a85_89;

  return {
    '0-4':   a0_4,
    '5-9':   Math.max(0, a5_9),
    '10-14': Math.max(0, a10_14),
    '15-19': Math.max(0, a15_19),
    '20-24': a20_24,
    '25-29': a25_29,
    '30-34': a30_34,
    '35-39': a35_39,
    '40-44': a40_44,
    '45-49': a45_49,
    '50-54': a50_54,
    '55-59': a55_59,
    '60-64': a60_64,
    '65-69': Math.max(0, a65_69),
    '70-74': a70_74,
    '75-79': a75_79,
    '80-84': Math.max(0, a80_84),
    '85-89': Math.max(0, a85_89),
    '90+':   Math.max(0, a90p),
  };
}

// ── Grunnkrets-kart: nåværende kode → navn ────────────────────────────────────
// Navn er lik som i grunnkretser.geojson (brukes til matching i appen)
const GRUNNKRETSER = {
  '40120101': 'Herre',
  '40120201': 'Asdal',
  '40120202': 'Torsdal-Nenset',
  '40120203': 'Findal',
  '40120204': 'Omborsnes',
  '40120205': 'Stein',
  '40120301': 'Stathelle',
  '40120302': 'Krabberødstrand',
  '40120303': 'Krabberød',
  '40120304': 'Eikstrand',
  '40120305': 'Eik',
  '40120306': 'Grasmyr',
  '40120401': 'Vaterland',
  '40120402': 'Sota',
  '40120403': 'Slaattenes',
  '40120404': 'Skarpenord',
  '40120405': 'Fagerheim',
  '40120406': 'Nustad',
  '40120501': 'Rørholt',
  '40120502': 'Dørdal',
  '40120503': 'Bleikelia',
  '40120504': 'Rønholt',
  '40120505': 'Valle',
  '40120506': 'Kjørstad',
  '40120507': 'Brevikstrand',
};

/**
 * Finn SSB-regionkoden med faktisk data for dette året.
 *
 * Bamble har hatt tre kommunekoder over tid:
 *   0814xxxx  (gammel Telemark, gyldig t.o.m. 2019)
 *   3813xxxx  (Vestfold og Telemark, gyldig 2020-2023)
 *   4012xxxx  (ny Telemark, gyldig fra 2024)
 *
 * Stein (40120205) finnes ikke i 4012-serien – bruker 04121104 / 3813 / 0814.
 *
 * Strategi: prøv ALLE kjente koder for dette grunnkretset og dette året,
 * velg den med størst totalbefolkning (> 0). Kun én kode vil ha tall per år.
 * Returnerer { regionIdx, fallbackYear } der fallbackYear er null ved direkte treff.
 */
function getRegionIdx(currentCode, year) {
  // Bygg liste over alle mulige SSB-koder for dette grunnkretset
  const candidates =
    currentCode === '40120205'
      ? ['40120205', '38130205', '08140205', '04121104']  // Stein
      : ['4012' + currentCode.slice(4),
         '3813' + currentCode.slice(4),
         '0814' + currentCode.slice(4)];

  const tidIdx = tidIndex[String(year)];

  // 1. Finn koden som faktisk har data for dette året
  let bestIdx = null;
  let bestTotal = -1;
  for (const code of candidates) {
    if (!(code in regionIndex)) continue;
    const rIdx = regionIndex[code];
    const t = totalPop(rIdx, tidIdx);
    if (t > bestTotal) { bestTotal = t; bestIdx = rIdx; }
  }

  if (bestTotal > 0) return { regionIdx: bestIdx, fallbackYear: null };

  // 2. Ingen kode har data for dette året (f.eks. Stein 2024-2025 i SSB).
  //    Bruk nærmeste foregående år som fallback.
  for (let fy = year - 1; fy >= 2015; fy--) {
    const ftidIdx = tidIndex[String(fy)];
    let fbBest = null, fbTotal = -1;
    for (const code of candidates) {
      if (!(code in regionIndex)) continue;
      const rIdx = regionIndex[code];
      const t = totalPop(rIdx, ftidIdx);
      if (t > fbTotal) { fbTotal = t; fbBest = rIdx; }
    }
    if (fbTotal > 0) return { regionIdx: fbBest, fallbackYear: fy };
  }

  return { regionIdx: null, fallbackYear: null };
}

// ── Generer én fil per år ─────────────────────────────────────────────────────
const outDir = join(ROOT, 'public', 'data');
mkdirSync(outDir, { recursive: true });

const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

for (const year of years) {
  const tidIdx = tidIndex[String(year)];
  const entries = [];

  for (const [currentCode, name] of Object.entries(GRUNNKRETSER)) {
    const { regionIdx, fallbackYear } = getRegionIdx(currentCode, year);

    if (regionIdx === null) {
      console.warn(`  ⚠ Ingen SSB-kode funnet for ${currentCode} (${name}) år ${year}`);
      continue;
    }

    // Bruk fallback-år hvis det nåværende året mangler data (f.eks. Stein 2024-2025)
    const usedTidIdx = fallbackYear !== null ? tidIndex[String(fallbackYear)] : tidIdx;
    if (fallbackYear !== null) {
      console.log(`  ℹ ${name} (${year}): ingen SSB-data, bruker ${fallbackYear}-tall som tilnærming`);
    }

    const totalBefolkning = totalPop(regionIdx, usedTidIdx);
    const antallMenn      = mennPop(regionIdx, usedTidIdx);
    const antallKvinner   = kvinnerPop(regionIdx, usedTidIdx);
    const befolkningAldersgrupper = mapAgeGroups(regionIdx, usedTidIdx);

    entries.push({
      statistikkÅr: year,
      grunnkretsId: currentCode,
      grunnkretsnavn: name,
      kommunenummer: '4012',
      kommunenavn: 'Bamble',
      totalBefolkning,
      antallMenn,
      antallKvinner,
      befolkningAldersgrupper,
    });
  }

  const totalSum = entries.reduce((s, e) => s + e.totalBefolkning, 0);
  const outPath = join(outDir, `population-${year}.json`);
  writeFileSync(outPath, JSON.stringify(entries, null, 2), 'utf8');
  console.log(`✓ population-${year}.json  (${entries.length} grunnkretser, ${totalSum} innbyggere totalt)`);
}

console.log('\nFerdig! Filer skrevet til public/data/');
