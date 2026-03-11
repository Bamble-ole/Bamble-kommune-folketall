#!/usr/bin/env node
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
  const re = new RegExp(`<(?:[^:>]+:)?${tag}>([^<]*)</(?:[^:>]+:)?${tag}>`);
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
const featureRe = /<[^:>]+:BefolkningP[^\s>]*Grunnkrets\b[^>]*>([\s\S]*?)<\/[^:>]+:BefolkningP[^\s>]*Grunnkrets>/g;

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
const outFile = join(OUT, `population-${year}.json`);
writeFileSync(outFile, JSON.stringify(entries, null, 2), 'utf-8');
console.log(`✓ Lagret ${entries.length} grunnkretser → ${outFile}`);
