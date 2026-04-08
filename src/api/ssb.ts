/**
 * ssb.ts — kall SSB PxWebApi v2 direkte fra nettleseren.
 * SSB støtter CORS, ingen proxy nødvendig.
 *
 * OBS: Kommunenummer endres ved kommunesammenslåinger.
 * Bamble: 0814 (t.o.m. 2019) → 3813 (2020–2023) → 4012 (fra 2024)
 * Porsgrunn: 0805 → 3806 → 4001
 * Skien:     0806 → 3807 → 4003
 * Notodden:  0807 → 3808 → 4005  (4005 er fra 2024)
 * Kragerø:   0815 → 3814 → 4014
 */

const SSB_BASE = 'https://data.ssb.no/api/pxwebapi/v2/tables';

// Gjeldende kommunenummer (fra 2024)
export const KOMMUNER: Record<string, string> = {
  '4012': 'Bamble',
  '4001': 'Porsgrunn',
  '4003': 'Skien',
  '4014': 'Kragerø',
  '4005': 'Notodden',
  'EAK':  'Hele landet',
};

// Kommuner uten "Hele landet" — til bruk i sammenlignings-diagram
export const KOMMUNER_UTEN_LAND = Object.fromEntries(
  Object.entries(KOMMUNER).filter(([k]) => k !== 'EAK'),
) as Record<string, string>;

// Historiske kommunekoder per periode (nødvendig for tabeller som ikke har konvertert koder)
// Tabellene 12143 og 12137 (KOSTRA økonomi) bruker KOKkommuneregion0000 som håndterer dette
// automatisk. Andre tabeller (07984, 13563, 06944) krever eksplisitte historiske koder.
export const KOMMUNER_HISTORISKE: Record<string, { pre2020: string; periode2020to2023: string; fra2024: string }> = {
  'Bamble':    { pre2020: '0814', periode2020to2023: '3813', fra2024: '4012' },
  'Porsgrunn': { pre2020: '0805', periode2020to2023: '3806', fra2024: '4001' },
  'Skien':     { pre2020: '0806', periode2020to2023: '3807', fra2024: '4003' },
  'Notodden':  { pre2020: '0807', periode2020to2023: '3808', fra2024: '4005' },
  'Kragerø':   { pre2020: '0815', periode2020to2023: '3814', fra2024: '4014' },
};

// Hjelpefunksjon: returnerer riktig kommunekode for et gitt år
export function kommuneKodeForAar(kommuneNavn: string, aar: string | number): string {
  const hist = KOMMUNER_HISTORISKE[kommuneNavn];
  if (!hist) return String(aar); // fallback
  const y = Number(aar);
  if (y <= 2019) return hist.pre2020;
  if (y <= 2023) return hist.periode2020to2023;
  return hist.fra2024;
}

// ─── Typer ────────────────────────────────────────────────────────────────────

export interface SsbRad {
  [dimensjon: string]: string | number | null;
  verdi: number | null;
}

interface SsbRaadata {
  dimension: Record<string, { category: { index: Record<string, number> } }>;
  value: (number | null)[];
}

// ─── Generisk SSB-henter (PxWebApi v2, GET) ──────────────────────────────────

async function ssbGet(
  tabellId: string,
  utvalg: Record<string, string[]>,
): Promise<SsbRaadata> {
  // SSB krever URL-enkodede brackets: [ → %5B, ] → %5D
  const params = Object.entries(utvalg)
    .map(([key, vals]) => `valuecodes%5B${key}%5D=${vals.join(',')}`)
    .join('&');
  const url = `${SSB_BASE}/${tabellId}/data?outputFormat=json-stat2&${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SSB tabell ${tabellId}: ${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Parser: SSB JSON-stat2 → flat array ─────────────────────────────────────

export function parseSsb(data: SsbRaadata): SsbRad[] {
  const dims      = data.dimension;
  const dimKeys   = Object.keys(dims);
  const dimSizes  = dimKeys.map(k => Object.keys(dims[k].category.index).length);
  const dimLabels = dimKeys.map(k => {
    const map: Record<number, string> = {};
    Object.entries(dims[k].category.index).forEach(([label, pos]) => {
      map[pos] = label;
    });
    return map;
  });

  return data.value.map((verdi, i) => {
    const row: SsbRad = { verdi };
    let idx = i;
    for (let j = dimKeys.length - 1; j >= 0; j--) {
      const pos = idx % dimSizes[j];
      row[dimKeys[j]] = dimLabels[j][pos];
      idx = Math.floor(idx / dimSizes[j]);
    }
    return row;
  });
}

// Bamble historiske kommunekoder — brukes i KOSTRA-tabeller der
// KOKkommuneregion0000 ikke normaliserer automatisk.
export const BAMBLE_ALLE_KODER = ['0814', '3813', '4012'];

// ─── Økonomi: netto driftsresultat i % (tabell 12143) ────────────────────────
// Tabell: "Finansielle nøkkeltall i prosent av brutto driftsinntekter, kommunekonsern"
// KOKartkap0000=AGD23 → Netto driftsresultat
// ContentsCode=KOSbelopbrinv0000 → Andel av brutto driftsinntekter (prosent)
// OBS: KOKkommuneregion0000 bruker historiske koder — Bamble er 0814/3813/4012.
// EAK = Hele landet (landssnitt)

export async function hentDriftsresultat(
  kommuner = [...BAMBLE_ALLE_KODER, 'EAK'],
  aar = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
): Promise<SsbRad[]> {
  const data = await ssbGet('12143', {
    KOKkommuneregion0000: kommuner,
    KOKartkap0000:        ['AGD23'],
    ContentsCode:         ['KOSbelopbrinv0000'],
    Tid:                  aar,
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Økonomi: netto lånegjeld per innbygger (tabell 12137) ───────────────────
// Tabell: "Finansielle nøkkeltall i kroner per innbygger, kommunekonsern"
// KOKartkap0000=KG31 → Netto lånegjeld
// ContentsCode=KOSbelopprinnb0000 → Beløp per innbygger (kr)

export async function hentLaanegjeld(
  kommuner = Object.keys(KOMMUNER_UTEN_LAND),
): Promise<SsbRad[]> {
  const data = await ssbGet('12137', {
    KOKkommuneregion0000: kommuner,
    KOKartkap0000:        ['KG31'],
    ContentsCode:         ['KOSbelopprinnb0000'],
    Tid:                  ['2025'],
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Tjenester: KOSTRA-nøkkeltall barnehager (tabell 13502) ──────────────────
// Dimensjoner: KOKkommuneregion0000, ContentsCode, Tid
// KOSandel150000 → Andel barn 1-5 år i barnehage (prosent)
// KOSbarnaav0000 → Barn per årsverk grunnbemanning (antall)
// KOSutg020000   → Netto driftsutgifter per innbygger 1-5 år (kr)
// Bruker KOKkommuneregion0000 — historiske koder håndteres automatisk.

export async function hentBarnehageNokkel(
  kommuner = Object.keys(KOMMUNER),
  aar = '2025',
): Promise<SsbRad[]> {
  const data = await ssbGet('13502', {
    KOKkommuneregion0000: kommuner,
    ContentsCode: [
      'KOSandel150000',   // Andel barn 1-5 år i barnehage (prosent)
      'KOSbarnaav0000',   // Barn per årsverk grunnbemanning (antall)
      'KOSutg020000',     // Netto driftsutgifter per innbygger 1-5 år (kr)
    ],
    Tid: [aar],
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Tjenester: KOSTRA-nøkkeltall grunnskole (tabell 12255) ──────────────────
// Dimensjoner: KOKkommuneregion0000, ContentsCode, Tid
// KOSgrstr20000        → Gruppestørrelse 2 (antall elever per gruppe)
// KOSregnind20000      → Netto driftsutgifter per innbygger 6-15 år (kr)
// KOSgrunnskolepoe0000 → Gjennomsnittlig grunnskolepoeng (antall)

export async function hentSkoleNokkel(
  kommuner = Object.keys(KOMMUNER),
  aar = '2024',
): Promise<SsbRad[]> {
  const data = await ssbGet('12255', {
    KOKkommuneregion0000: kommuner,
    ContentsCode: [
      'KOSgrstr20000',        // Gruppestørrelse 2 (antall)
      'KOSregnind20000',      // Netto driftsutgifter per innbygger 6-15 år (kr)
      'KOSgrunnskolepoe0000', // Gjennomsnittlig grunnskolepoeng (antall)
    ],
    Tid: [aar],
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Tjenester: KOSTRA-nøkkeltall omsorgstjenester (tabell 12293) ────────────
// Dimensjoner: KOKkommuneregion0000, ContentsCode, Tid
// KOSlangtid80aaro0001 → Andel innbyggere 80+ med langtidsopphold i sykehjem (prosent)
// KOSlegetimperbeb0000 → Legetimer per uke per beboer i sykehjem (timer)
// KOSbeleggomsorgs0000 → Andel beboere i institusjon av antall plasser (belegg, prosent)

export async function hentOmsorgNokkel(
  kommuner = Object.keys(KOMMUNER),
  aar = '2024',
): Promise<SsbRad[]> {
  const data = await ssbGet('12293', {
    KOKkommuneregion0000: kommuner,
    ContentsCode: [
      'KOSlangtid80aaro0001', // Andel innbyggere 80+ med langtidsopphold i sykehjem (prosent)
      'KOSlegetimperbeb0000', // Legetimer per uke per beboer i sykehjem (timer)
      'KOSbeleggomsorgs0000', // Andel beboere i institusjon av antall plasser (prosent)
    ],
    Tid: [aar],
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Næring: sysselsetting per næring (tabell 07984) ─────────────────────────
// Korrekt tabell for registerbasert sysselsetting per næring per kommune.
// Tabell 13471 er FEIL — den handler om treningsaktiviteter, ikke næring.
// Dimensjoner: Region, NACE2007, Kjonn, Alder, ContentsCode, Tid
// Region bruker historiske kommunekoder (0814/3813/4012 for Bamble).
// NACE2007-koder (17 grupper fra tabellen):
//   00-99=Alle næringer, 01-03=Jordbruk/skogbruk/fiske, 05-09=Bergverksdrift,
//   10-33=Industri, 35-39=Elektrisitet/vann/renovasjon, 41-43=Bygge/anlegg,
//   45-47=Varehandel/motorvogner, 49-53=Transport/lagring,
//   55-56=Overnatting/servering, 58-63=Informasjon/kommunikasjon,
//   64-66=Finansiering/forsikring, 68-75=Teknisk tjenesteyting/eiendom,
//   77-82=Forretningsmessig tjenesteyting, 84=Off.adm./forsvar,
//   85=Undervisning, 86-88=Helse/sosial, 90-99=Personlig tjenesteyting
// Kjonn: 0=Begge, 1=Menn, 2=Kvinner
// Alder: 15-74, 15-19, 20-24, 25-39, 40-54, 55-66, 67-74
// ContentsCode: Sysselsatte (antall), SysselsatteArb (lønnstakere)

export async function hentSysselsettingNaering(
  kommunenummer = '4012',
  aar = '2025',
): Promise<SsbRad[]> {
  const data = await ssbGet('07984', {
    Region:       [kommunenummer],
    NACE2007:     ['00-99', '01-03', '10-33', '35-39', '41-43', '45-47',
                   '49-53', '55-56', '58-63', '64-66', '68-75', '77-82',
                   '86-88', '90-99', '84', '85'],
    Kjonn:        ['0'],           // 0=Begge kjønn
    Alder:        ['15-74'],
    ContentsCode: ['Sysselsatte'],
    Tid:          [aar],
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Næring: arbeidsledighet (tabell 13563) ───────────────────────────────────
// Tabell 10540 er avsluttet (discontinued 2020) og skal IKKE brukes.
// Tabell 13563 "Kommunefordelt prioritert arbeidsstyrkestatus for 15 år og eldre (K)"
// gir antall registrerte arbeidsledige per kommune, oppdatert tom. 2024.
// Dimensjoner: Region, HovArbStyrkStatus, Alder, InnvandrKat, ContentsCode, Tid
// HovArbStyrkStatus=A.09 → Registrerte arbeidsledige (andre koder: A.01=Sysselsatte, A=Arbeidsstyrken)
// Alder: 15-74, 15+, 30-61, 62+, 15-29, 20-66
// InnvandrKat: A-G=I alt, A_C-G=Eks. innvandrere, B=Innvandrere
// ContentsCode: Bosatte (antall — eneste tilgjengelige kode)
// Region: historiske kommunekoder kreves — se KOMMUNER_HISTORISKE
//   Bamble: 0814 (t.o.m. 2019), 3813 (2020–2023), 4012 (fra 2024)
//
// MERK: Verdier kan være null for små kommuner i enkeltår (personvern/avrunding til 0 eller 3).

export async function hentArbeidsledighet(
  kommuner = Object.keys(KOMMUNER_UTEN_LAND),
  aar = ['2019', '2020', '2021', '2022', '2023', '2024'],
): Promise<SsbRad[]> {
  // Kommuner som bruker kommunenummer direkte (4012 osv. for nyeste data)
  // For historiske år må kaller sende inn de riktige historiske kodene.
  const data = await ssbGet('13563', {
    Region:            kommuner,
    HovArbStyrkStatus: ['A.09'],    // Registrerte arbeidsledige
    Alder:             ['15-74'],
    InnvandrKat:       ['A-G'],     // I alt
    ContentsCode:      ['Bosatte'], // Antall
    Tid:               aar,
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Næring: medianinntekt (tabell 06944) ─────────────────────────────────────
// Tabell 05852 eksisterer IKKE (returnerer 404) og skal IKKE brukes.
// Tabell 06944 "Inntekt for husholdninger, etter husholdningstype. Delområder (K)(B)"
// Dimensjoner: Region, HusholdType, ContentsCode, Tid
// HusholdType: 0000=Alle, 0001=Aleneboende, 0002=Par uten barn,
//              0003=Par med barn 0-17 år, 0004=Enslig mor/far med barn 0-17 år
// ContentsCode: SamletInntekt (median samlet inntekt, kr),
//               InntSkatt (median inntekt etter skatt, kr), AntallHushold
// Region: historiske kommunekoder kreves:
//   Bamble: 0814 (t.o.m. 2019), 3813 (2020–2023), 4012 (fra 2024)
//
// MERK: Data kan mangle for små kommuner i enkeltår (personvern).
// Tilgjengelige år med data for Bamble: 2019 (0814), 2020 og 2021 (3813), 2024 (4012).
// For tidsserie: send inn kombinasjoner av historiske koder og år.

export async function hentMedianinntekt(
  kommuner = Object.keys(KOMMUNER_UTEN_LAND),
): Promise<SsbRad[]> {
  const data = await ssbGet('06944', {
    Region:       kommuner,
    HusholdType:  ['0000'],       // Alle husholdninger
    ContentsCode: ['InntSkatt'],  // Inntekt etter skatt, median (kr)
    Tid:          ['2024'],
  });
  return parseSsb(data).filter(r => r.verdi !== null);
}

// ─── Næring: medianinntekt tidsserie — håndterer historiske kommunekoder ──────
// Bruker tre separate kall (ett per kommunekodeperiode) og slår sammen resultatet.

export async function hentMedianinntektTidsserie(
  kommunNavn: Array<keyof typeof KOMMUNER_HISTORISKE> = ['Bamble', 'Porsgrunn', 'Skien', 'Kragerø', 'Notodden'],
): Promise<SsbRad[]> {
  async function hentPeriode(kodeNokkel: 'pre2020' | 'periode2020to2023' | 'fra2024', aar: string[]) {
    const koder = kommunNavn.map(n => KOMMUNER_HISTORISKE[n][kodeNokkel]);
    const data = await ssbGet('06944', {
      Region:       koder,
      HusholdType:  ['0000'],
      ContentsCode: ['InntSkatt'],
      Tid:          aar,
    });
    return parseSsb(data).filter(r => r.verdi !== null);
  }

  const [pre, mid, ny] = await Promise.all([
    hentPeriode('pre2020',           ['2015', '2016', '2017', '2018', '2019']),
    hentPeriode('periode2020to2023', ['2020', '2021', '2022', '2023']),
    hentPeriode('fra2024',           ['2024']),
  ]);

  // Normaliser Region-koden til gjeldende kommunenummer (fra2024)
  const kodeMap: Record<string, string> = {};
  kommunNavn.forEach(n => {
    const h = KOMMUNER_HISTORISKE[n];
    kodeMap[h.pre2020]           = h.fra2024;
    kodeMap[h.periode2020to2023] = h.fra2024;
    kodeMap[h.fra2024]           = h.fra2024;
  });
  const normaliser = (rader: SsbRad[]) =>
    rader.map(r => ({ ...r, Region: kodeMap[r.Region as string] ?? r.Region }));

  return [...normaliser(pre), ...normaliser(mid), ...normaliser(ny)];
}

// ─── POST-henter for tabeller som krever det (f.eks. pendling med wildcard) ───

async function ssbPost(
  tabellId: string,
  selection: Array<{ variableCode: string; valueCodes: string[] }>,
): Promise<SsbRaadata> {
  const url = `${SSB_BASE}/${tabellId}/data?outputFormat=json-stat2`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ selection }),
  });
  if (!res.ok) throw new Error(`SSB tabell ${tabellId}: ${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Befolkningsframskriving (tabell 14288, MMMM-alternativet) ────────────────
// Kun kode '4012' finnes — tabellen bruker ikke historiske kommunekoder.
// Ingen "i alt"-alder: alle 106 alderskoder summeres klient-side.
// ContentsCode=Personer → MMMM (middels nasjonal vekst)

const ALLE_ALDER_KODER = [
  ...Array.from({ length: 105 }, (_, i) => String(i).padStart(3, '0')), // 000–104
  '105%2B', // 105+ URL-enkodert
];

export async function hentBefolkningsframskriving(
  aar = ['2024', '2025', '2026', '2027', '2028', '2029', '2030',
         '2032', '2034', '2036', '2038', '2040', '2045', '2050'],
): Promise<{ aar: string; befolkning: number }[]> {
  const data = await ssbGet('14288', {
    Region:       ['4012'],
    Kjonn:        ['1', '2'],
    Alder:        ALLE_ALDER_KODER,
    ContentsCode: ['Personer'], // MMMM
    Tid:          aar,
  });
  const rader = parseSsb(data);

  // Summer alle alder × kjønn per år
  const summer: Record<string, number> = {};
  for (const r of rader) {
    if (r.verdi == null) continue;
    const t = String(r.Tid);
    summer[t] = (summer[t] ?? 0) + (r.verdi as number);
  }
  return aar.map(a => ({ aar: a, befolkning: summer[a] ?? 0 }))
            .filter(r => r.befolkning > 0);
}

// ─── Utdanningsnivå (tabell 09429) ───────────────────────────────────────────
// Region=0814 gir komplett tidsserie 2000–2024 (eneste kode med ubrutt serie).
// Nivaa-koder: 01=Grunnskole, 02a=Videregående, 03a=Uni kort, 04a=Uni lang
// ContentsCode=PersonerProsent → prosentandel

export async function hentUtdanningsnivaa(): Promise<SsbRad[]> {
  const felles = {
    Nivaa:        ['01', '02a', '03a', '04a'],
    Kjonn:        ['0'],
    ContentsCode: ['PersonerProsent'],
  };
  const [pre, mid, ny] = await Promise.all([
    ssbGet('09429', { Region: ['0814'], ...felles, Tid: ['2010', '2015', '2016', '2017', '2018', '2019'] }),
    ssbGet('09429', { Region: ['3813'], ...felles, Tid: ['2020', '2021', '2022', '2023'] }),
    ssbGet('09429', { Region: ['4012'], ...felles, Tid: ['2024'] }),
  ]);
  // Normaliser Region til '4012' så panelet bare trenger å filtrere på én kode
  const normaliser = (rader: SsbRad[]) =>
    rader.map(r => ({ ...r, Region: '4012' }));
  return [
    ...normaliser(parseSsb(pre).filter(r => r.verdi !== null)),
    ...normaliser(parseSsb(mid).filter(r => r.verdi !== null)),
    ...normaliser(parseSsb(ny).filter(r => r.verdi !== null)),
  ];
}

// ─── Pendling (tabell 03321) ──────────────────────────────────────────────────
// Krever POST med wildcard '*' — GET-URL blir for lang med 853 kommuner.
// Historiske koder: 0814 (t.o.m. 2019), 3813 (2020–2023), 4012 (2024+)
// Returnerer: selvpendling, innpendling, utpendling per år

export interface PendlingRad {
  aar:            string;
  selvpendling:   number; // bor og jobber i Bamble
  innpendling:    number; // jobber i Bamble, bor utenfor
  utpendling:     number; // bor i Bamble, jobber utenfor
}

async function hentPendlingPeriode(
  bambleKode: string,
  aar: string[],
): Promise<PendlingRad[]> {
  // Hent alle som jobber i Bamble (innpendling + selvpendling)
  const innData = await ssbPost('03321', [
    { variableCode: 'ArbstedKomm', valueCodes: [bambleKode] },
    { variableCode: 'Bokommuen',   valueCodes: ['*'] },
    { variableCode: 'ContentsCode', valueCodes: ['Sysselsatte'] },
    { variableCode: 'Tid',         valueCodes: aar },
  ]);

  // Hent alle som bor i Bamble (utpendling + selvpendling)
  const utData = await ssbPost('03321', [
    { variableCode: 'ArbstedKomm', valueCodes: ['*'] },
    { variableCode: 'Bokommuen',   valueCodes: [bambleKode] },
    { variableCode: 'ContentsCode', valueCodes: ['Sysselsatte'] },
    { variableCode: 'Tid',         valueCodes: aar },
  ]);

  const innRader = parseSsb(innData);
  const utRader  = parseSsb(utData);

  return aar.map(a => {
    const innTotal = innRader
      .filter(r => r.Tid === a && r.verdi != null)
      .reduce((s, r) => s + (r.verdi as number), 0);
    const utTotal = utRader
      .filter(r => r.Tid === a && r.verdi != null)
      .reduce((s, r) => s + (r.verdi as number), 0);
    const selvp = innRader
      .find(r => r.Tid === a && r.Bokommuen === bambleKode)
      ?.verdi as number ?? 0;

    return {
      aar:          a,
      selvpendling: selvp,
      innpendling:  innTotal - selvp,
      utpendling:   utTotal  - selvp,
    };
  }).filter(r => r.selvpendling + r.innpendling + r.utpendling > 0);
}

export async function hentPendling(): Promise<PendlingRad[]> {
  const [pre, mid, ny] = await Promise.all([
    hentPendlingPeriode('0814', ['2015', '2016', '2017', '2018', '2019']),
    hentPendlingPeriode('3813', ['2020', '2021', '2022', '2023']),
    hentPendlingPeriode('4012', ['2024', '2025']),
  ]);
  return [...pre, ...mid, ...ny];
}
