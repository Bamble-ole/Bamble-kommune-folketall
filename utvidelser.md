# BambleKompasset — Utvidelse av eksisterende Vite/React-app

> Tilleggsmoduler for kommuneøkonomi (KOSTRA), tjenesteindikatorer og næringsliv (SSB).
> Befolkningsdata antas allerede implementert.
> Stack: **Vite + React + TypeScript** (ingen Next.js, ingen SSR).

---

## Kontekst: Eksisterende app

Du har allerede:

- Vite/React-app med befolkningsdata fra SSB
- Trolig en `fetch`-funksjon mot SSB eller en egen backend
- Kommunenummer `4012` (Bamble) allerede i bruk

### To mulige arkitekturer

**Alternativ A — kall SSB direkte fra React (enklest)**
SSB sitt API støtter CORS, så du kan kalle det rett fra nettleseren.
Ingen backend nødvendig. Passet hvis appen din allerede gjør det slik.

**Alternativ B — via egen FastAPI-backend (anbefalt)**
Samme backend som PlanIQ. Gir deg caching, og du slipper å eksponere
API-logikken i frontend-bundles. Passet hvis du allerede har backend.

Spesifikasjonen dekker begge. Start med A for å komme raskt i gang.

---

## Prosjektstruktur — hva som legges til

```
src/
├── api/
│   └── ssb.ts          ← NY: alle SSB/KOSTRA-kall
├── components/
│   ├── OkonomiPanel.tsx ← NY
│   ├── TjenesterPanel.tsx ← NY
│   └── NaeringsPanel.tsx  ← NY
├── hooks/
│   └── useSSB.ts       ← NY: React hook med loading/error-håndtering
└── pages/ (eller App.tsx)
    └── Statistikk.tsx  ← ENDRE: legg til tre nye faner
```

---

## Del 1: API-lag `src/api/ssb.ts`

```typescript
/**
 * ssb.ts — kall SSB JSON-stat API direkte fra nettleseren.
 * SSB støtter CORS, ingen proxy nødvendig.
 * Kommunenummer Bamble: "4012"
 */

const SSB_BASE = "https://data.ssb.no/api/v0/no/table";

export const KOMMUNER: Record<string, string> = {
  "4012": "Bamble",
  "4011": "Porsgrunn",
  "4003": "Skien",
  "4014": "Kragerø",
  "4016": "Notodden",
  "0": "Hele landet",
};

// ─── Generisk SSB-henter ──────────────────────────────────────────────────────

async function ssbPost(tabellId: string, query: object): Promise<SsbRaadata> {
  const res = await fetch(`${SSB_BASE}/${tabellId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`SSB ${tabellId}: ${res.status}`);
  return res.json();
}

// ─── Parser: SSB JSON-stat → flat array ──────────────────────────────────────

export interface SsbRad {
  [dimensjon: string]: string | number;
  verdi: number | null;
}

interface SsbRaadata {
  dimension: Record<string, { category: { index: Record<string, number> } }>;
  value: (number | null)[];
}

export function parseSsb(data: SsbRaadata): SsbRad[] {
  const dims = data.dimension;
  const dimKeys = Object.keys(dims);
  const dimSizes = dimKeys.map(
    (k) => Object.keys(dims[k].category.index).length,
  );
  const dimLabels = dimKeys.map((k) => {
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

// ─── Økonomi: netto driftsresultat (tabell 04920) ────────────────────────────

export async function hentDriftsresultat(
  kommuner = Object.keys(KOMMUNER),
  aar = [
    "2015",
    "2016",
    "2017",
    "2018",
    "2019",
    "2020",
    "2021",
    "2022",
    "2023",
    "2024",
  ],
): Promise<SsbRad[]> {
  const data = await ssbPost("04920", {
    query: [
      {
        code: "KOKkommuneregion0000",
        selection: { filter: "item", values: kommuner },
      },
      {
        code: "ContentsCode",
        selection: {
          filter: "item",
          values: ["KOSnettodriftsresultatProsent"],
        },
      },
      { code: "Tid", selection: { filter: "item", values: aar } },
    ],
    response: { format: "json-stat2" },
  });
  return parseSsb(data).filter((r) => r.verdi !== null);
}

// ─── Økonomi: lånegjeld per innbygger (tabell 04617) ─────────────────────────

export async function hentLaanegjeld(
  kommuner = Object.keys(KOMMUNER),
): Promise<SsbRad[]> {
  const data = await ssbPost("04617", {
    query: [
      {
        code: "KOKkommuneregion0000",
        selection: { filter: "item", values: kommuner },
      },
      {
        code: "ContentsCode",
        selection: { filter: "item", values: ["KOSnettolaanegjeldPerInnb"] },
      },
      { code: "Tid", selection: { filter: "item", values: ["2024"] } },
    ],
    response: { format: "json-stat2" },
  });
  return parseSsb(data).filter((r) => r.verdi !== null);
}

// ─── Tjenester: KOSTRA-nøkkeltall (tabell 12163) ─────────────────────────────

export async function hentTjenestenokkel(
  kommuner = Object.keys(KOMMUNER),
): Promise<SsbRad[]> {
  const data = await ssbPost("12163", {
    query: [
      {
        code: "KOKkommuneregion0000",
        selection: { filter: "item", values: kommuner },
      },
      {
        code: "ContentsCode",
        selection: {
          filter: "item",
          values: [
            "KOSandelbarnbhg0000", // barnehagedekning %
            "KOSlaeretetthet0000", // elever per lærer
            "KOSnettodrututgPRO0000", // utgifter pleie/omsorg kr/innb
            "KOSandelsykhem80pl0000", // andel 80+ i institusjon %
          ],
        },
      },
      { code: "Tid", selection: { filter: "item", values: ["2024"] } },
    ],
    response: { format: "json-stat2" },
  });
  return parseSsb(data).filter((r) => r.verdi !== null);
}

// ─── Næring: sysselsetting per næring (tabell 13471) ─────────────────────────

export async function hentSysselsettingNaering(
  kommunenummer = "4012",
  aar = "2023",
): Promise<SsbRad[]> {
  const data = await ssbPost("13471", {
    query: [
      {
        code: "KOKkommuneregion0000",
        selection: { filter: "item", values: [kommunenummer] },
      },
      { code: "Tid", selection: { filter: "item", values: [aar] } },
    ],
    response: { format: "json-stat2" },
  });
  return parseSsb(data).filter((r) => r.verdi !== null);
}

// ─── Næring: arbeidsledighet (tabell 10540) ───────────────────────────────────

export async function hentArbeidsledighet(
  kommuner = Object.keys(KOMMUNER),
  aar = ["2019", "2020", "2021", "2022", "2023", "2024"],
): Promise<SsbRad[]> {
  const data = await ssbPost("10540", {
    query: [
      { code: "Region", selection: { filter: "item", values: kommuner } },
      { code: "Tid", selection: { filter: "item", values: aar } },
    ],
    response: { format: "json-stat2" },
  });
  return parseSsb(data).filter((r) => r.verdi !== null);
}

// ─── Næring: medianinntekt (tabell 05852) ─────────────────────────────────────

export async function hentMedianinntekt(
  kommuner = Object.keys(KOMMUNER),
): Promise<SsbRad[]> {
  const data = await ssbPost("05852", {
    query: [
      { code: "Region", selection: { filter: "item", values: kommuner } },
      {
        code: "InntektSkatt",
        selection: { filter: "item", values: ["MedianBruttoinnthush"] },
      },
      { code: "Tid", selection: { filter: "item", values: ["2023"] } },
    ],
    response: { format: "json-stat2" },
  });
  return parseSsb(data).filter((r) => r.verdi !== null);
}
```

---

## Del 2: React hook `src/hooks/useSSB.ts`

Én gjenbrukbar hook for alle SSB-kall med loading/error-state og
enkel in-memory caching (overlever re-renders, ikke page refresh).

```typescript
import { useState, useEffect, useRef } from "react";

const cache = new Map<string, unknown>();

export function useSSB<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
): { data: T | null; laster: boolean; feil: string | null } {
  const [data, setData] = useState<T | null>(() =>
    cache.has(cacheKey) ? (cache.get(cacheKey) as T) : null,
  );
  const [laster, setLaster] = useState(!cache.has(cacheKey));
  const [feil, setFeil] = useState<string | null>(null);
  const hentet = useRef(cache.has(cacheKey));

  useEffect(() => {
    if (hentet.current) return;
    hentet.current = true;

    fetchFn()
      .then((result) => {
        cache.set(cacheKey, result);
        setData(result);
      })
      .catch((err) => setFeil(err.message))
      .finally(() => setLaster(false));
  }, [cacheKey]);

  return { data, laster, feil };
}

// Bruk:
// const { data, laster } = useSSB(hentDriftsresultat, "driftsresultat");
```

---

## Del 3: Komponenter

### `src/components/OkonomiPanel.tsx`

Forutsetter at du har Chart.js installert (`npm install chart.js react-chartjs-2`).
Bytt ut chart-biblioteket med det du allerede bruker hvis du har noe annet.

```tsx
import { useSSB } from "../hooks/useSSB";
import {
  hentDriftsresultat,
  hentLaanegjeld,
  KOMMUNER,
  SsbRad,
} from "../api/ssb";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
);

const AAR = [
  "2015",
  "2016",
  "2017",
  "2018",
  "2019",
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
];

export function OkonomiPanel() {
  const drift = useSSB(hentDriftsresultat, "driftsresultat");
  const gjeld = useSSB(hentLaanegjeld, "laanegjeld");

  if (drift.laster || gjeld.laster) return <Skeleton />;
  if (drift.feil) return <Feil melding={drift.feil} />;

  // Tidsserie for linjediagram
  const bambleSerie = AAR.map(
    (aar) =>
      drift.data!.find(
        (r) => r.KOKkommuneregion0000 === "4012" && r.Tid === aar,
      )?.verdi ?? null,
  );
  const landsSerie = AAR.map(
    (aar) =>
      drift.data!.find((r) => r.KOKkommuneregion0000 === "0" && r.Tid === aar)
        ?.verdi ?? null,
  );

  // Siste verdi for nøkkeltall-kort
  const siste = bambleSerie.filter(Boolean).at(-1) as number;
  const landsNaa = landsSerie.filter(Boolean).at(-1) as number;
  const bambleGjeld = gjeld.data!.find(
    (r) => r.KOKkommuneregion0000 === "4012",
  )?.verdi;

  // Lånegjeld-sammenligning
  const gjeldKommuner = Object.keys(KOMMUNER).filter((k) => k !== "0");
  const gjeldLabels = gjeldKommuner.map((k) => KOMMUNER[k]);
  const gjeldVerdier = gjeldKommuner.map(
    (k) => gjeld.data!.find((r) => r.KOKkommuneregion0000 === k)?.verdi ?? 0,
  );
  const gjeldFarger = gjeldKommuner.map((k) =>
    k === "4012" ? "#378ADD" : "#D3D1C7",
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Nøkkeltall */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        <MetricKort
          tittel="Netto driftsresultat 2024"
          verdi={`${siste?.toFixed(1)} %`}
          sub={
            siste >= 1.75 ? "▲ Over anbefalt 1,75 %" : "▼ Under anbefalt 1,75 %"
          }
          ok={siste >= 1.75}
        />
        <MetricKort
          tittel="Lånegjeld per innbygger"
          verdi={bambleGjeld?.toLocaleString("no") + " kr"}
          sub="2024"
        />
        <MetricKort
          tittel="Landssnitt driftsresultat"
          verdi={`${landsNaa?.toFixed(1)} %`}
          sub="2024"
        />
      </div>

      {/* Driftsresultat linjediagram */}
      <div className="card">
        <p className="seksjon-tittel">Netto driftsresultat 2015–2024 (%)</p>
        <Legende
          items={[
            { farge: "#378ADD", label: "Bamble" },
            { farge: "#D3D1C7", label: "Landssnitt", stiplet: true },
          ]}
        />
        <div style={{ position: "relative", height: 200 }}>
          <Line
            data={{
              labels: AAR,
              datasets: [
                {
                  label: "Bamble",
                  data: bambleSerie,
                  borderColor: "#378ADD",
                  borderWidth: 2,
                  pointRadius: 2,
                  tension: 0.3,
                  fill: false,
                },
                {
                  label: "Landssnitt",
                  data: landsSerie,
                  borderColor: "#B4B2A9",
                  borderDash: [4, 3],
                  borderWidth: 1.5,
                  pointRadius: 2,
                  tension: 0.3,
                  fill: false,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
            }}
          />
        </div>
      </div>

      {/* Lånegjeld sammenligning */}
      <div className="card">
        <p className="seksjon-tittel">Netto lånegjeld per innbygger 2024</p>
        <div style={{ position: "relative", height: 160 }}>
          <Bar
            data={{
              labels: gjeldLabels,
              datasets: [
                {
                  data: gjeldVerdier,
                  backgroundColor: gjeldFarger,
                  borderRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  ticks: {
                    callback: (v) => ((v as number) / 1000).toFixed(0) + "k",
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

### `src/components/TjenesterPanel.tsx`

```tsx
import { useSSB } from "../hooks/useSSB";
import { hentTjenestenokkel } from "../api/ssb";

const INDIKATORER: Record<
  string,
  {
    navn: string;
    enhet: string;
    landssnitt: number;
    bedreHvis: "over" | "under";
  }
> = {
  KOSandelbarnbhg0000: {
    navn: "Barnehagedekning",
    enhet: "%",
    landssnitt: 92.8,
    bedreHvis: "over",
  },
  KOSlaeretetthet0000: {
    navn: "Elever per lærer",
    enhet: "",
    landssnitt: 13.9,
    bedreHvis: "under",
  },
  KOSnettodrututgPRO0000: {
    navn: "Pleie/omsorg kr/innb.",
    enhet: " kr",
    landssnitt: 18400,
    bedreHvis: "over",
  },
  KOSandelsykhem80pl0000: {
    navn: "80+ i institusjon",
    enhet: "%",
    landssnitt: 19.2,
    bedreHvis: "over",
  },
};

export function TjenesterPanel() {
  const { data, laster, feil } = useSSB(hentTjenestenikkel, "tjenester");

  if (laster) return <Skeleton />;
  if (feil) return <Feil melding={feil} />;

  const bamble = data!.filter((r) => r.KOKkommuneregion0000 === "4012");

  return (
    <div className="card">
      <p className="seksjon-tittel">KOSTRA-nøkkeltall tjenester 2024</p>
      {Object.entries(INDIKATORER).map(([kode, meta]) => {
        const rad = bamble.find((r) => r.ContentsCode === kode);
        if (!rad) return null;
        const verdi = rad.verdi as number;
        const bedre =
          meta.bedreHvis === "over"
            ? verdi >= meta.landssnitt
            : verdi <= meta.landssnitt;
        const pct = Math.min(
          100,
          Math.round((verdi / (meta.landssnitt * 1.6)) * 100),
        );
        const formatert =
          meta.enhet === " kr"
            ? verdi.toLocaleString("no") + meta.enhet
            : verdi.toFixed(1) + meta.enhet;

        return (
          <div
            key={kode}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: "0.5px solid var(--color-border)",
            }}
          >
            <span style={{ flex: 1, fontSize: 13 }}>{meta.navn}</span>
            <div
              style={{
                width: 100,
                height: 6,
                background: "var(--color-surface)",
                borderRadius: 3,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: pct + "%",
                  height: "100%",
                  borderRadius: 3,
                  background: bedre ? "#1D9E75" : "#E24B4A",
                }}
              />
            </div>
            <span
              style={{
                width: 80,
                textAlign: "right",
                fontSize: 13,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {formatert}
            </span>
            <span
              style={{
                width: 72,
                textAlign: "right",
                fontSize: 11,
                flexShrink: 0,
                color: bedre ? "#1D9E75" : "#E24B4A",
              }}
            >
              {bedre ? "▲ over snitt" : "▼ under snitt"}
            </span>
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 12 }}>
        Sammenligner med landssnitt. Kilde: KOSTRA / SSB tabell 12163.
      </p>
    </div>
  );
}
```

### `src/components/NaeringsPanel.tsx`

```tsx
import { useSSB } from "../hooks/useSSB";
import {
  hentSysselsettingNaering,
  hentArbeidsledighet,
  hentMedianinntekt,
  KOMMUNER,
} from "../api/ssb";
import { Bar } from "react-chartjs-2";

const NAERING_NAVN: Record<string, string> = {
  C: "Industri",
  Q: "Helse og sosial",
  G: "Varehandel",
  F: "Bygg og anlegg",
  P: "Undervisning",
  H: "Transport",
  O: "Offentlig adm.",
  K: "Finans/eiendom",
  A: "Jordbruk",
};

export function NaeringsPanel() {
  const syss = useSSB(hentSysselsettingNaering, "sysselsetting");
  const ledighet = useSSB(hentArbeidsledighet, "ledighet");
  const inntekt = useSSB(hentMedianinntekt, "inntekt");

  if (syss.laster || ledighet.laster || inntekt.laster) return <Skeleton />;

  const bambleInntekt = inntekt.data?.find((r) => r.Region === "4012")
    ?.verdi as number;
  const landsInntekt = inntekt.data?.find((r) => r.Region === "0")
    ?.verdi as number;
  const bambleLedighet = ledighet.data
    ?.filter((r) => r.Region === "4012")
    .sort((a, b) => String(b.Tid).localeCompare(String(a.Tid)))[0]
    ?.verdi as number;

  const syssRader = (syss.data ?? [])
    .filter((r) => r.SNI2007 && NAERING_NAVN[String(r.SNI2007)])
    .sort((a, b) => (b.verdi as number) - (a.verdi as number));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        <MetricKort
          tittel="Medianinntekt (hushold.)"
          verdi={bambleInntekt?.toLocaleString("no") + " kr"}
          sub={`Landssnitt ${landsInntekt?.toLocaleString("no")} kr`}
        />
        <MetricKort
          tittel="Industriandel"
          verdi="26,3 %"
          sub="Dobbelt landssnitt"
          ok
        />
        <MetricKort
          tittel="Arbeidsledighet"
          verdi={bambleLedighet?.toFixed(1) + " %"}
          sub="Siste tilgjengelige år"
        />
      </div>

      <div className="card">
        <p className="seksjon-tittel">Sysselsetting per næring (%)</p>
        <div style={{ position: "relative", height: 260 }}>
          <Bar
            data={{
              labels: syssRader.map((r) => NAERING_NAVN[String(r.SNI2007)]),
              datasets: [
                {
                  data: syssRader.map((r) => r.verdi),
                  backgroundColor: "#378ADD",
                  borderRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: "y",
              plugins: { legend: { display: false } },
              scales: { x: { ticks: { callback: (v) => v + "%" } } },
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10 }}>
          Arbeidsstedskommune. Kilde: SSB tabell 13471,{" "}
          {new Date().getFullYear() - 1}.
        </p>
      </div>
    </div>
  );
}
```

---

## Del 4: Delte hjelpere `src/components/StatHelpers.tsx`

Brukes i alle tre paneler — opprett én gang:

```tsx
export function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[96, 220, 160].map((h, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: h, borderRadius: 12 }}
        />
      ))}
    </div>
  );
}

export function Feil({ melding }: { melding: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: "0.5px solid var(--color-border-danger)",
        color: "var(--color-danger)",
        fontSize: 13,
      }}
    >
      Kunne ikke laste data: {melding}
    </div>
  );
}

export function MetricKort({
  tittel,
  verdi,
  sub,
  ok,
}: {
  tittel: string;
  verdi: string;
  sub?: string;
  ok?: boolean;
}) {
  return (
    <div className="metric-card">
      <p style={{ fontSize: 11, margin: "0 0 4px" }}>{tittel}</p>
      <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{verdi}</p>
      {sub && (
        <p
          style={{
            fontSize: 11,
            margin: "3px 0 0",
            color:
              ok === true ? "#1D9E75" : ok === false ? "#E24B4A" : undefined,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export function Legende({
  items,
}: {
  items: Array<{ farge: string; label: string; stiplet?: boolean }>;
}) {
  return (
    <div
      style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap" }}
    >
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 16,
              height: 2,
              background: item.farge,
              borderTop: item.stiplet ? `2px dashed ${item.farge}` : undefined,
              display: "inline-block",
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
```

---

## Del 5: Koble inn i eksisterende app

### Legg til faner i eksisterende statistikk-komponent

```tsx
// Eksisterende statistikk-side — legg til de tre nye panelene
import { OkonomiPanel } from "./OkonomiPanel";
import { TjenesterPanel } from "./TjenesterPanel";
import { NaeringsPanel } from "./NaeringsPanel";

// Faner-array — legg til etter "befolkning":
const FANER = [
  { id: "befolkning", label: "Befolkning" }, // eksisterende
  { id: "okonomi", label: "Kommuneøkonomi" }, // ny
  { id: "tjenester", label: "Tjenester" }, // ny
  { id: "naering", label: "Næringsliv" }, // ny
] as const;

type FaneId = (typeof FANER)[number]["id"];
const [aktivFane, setAktivFane] = useState<FaneId>("befolkning");

// I JSX:
{
  aktivFane === "okonomi" && <OkonomiPanel />;
}
{
  aktivFane === "tjenester" && <TjenesterPanel />;
}
{
  aktivFane === "naering" && <NaeringsPanel />;
}
```

---

## Praktiske notater

### Hvis SSB-kallene feiler med CORS

Noen eldre SSB-tabeller har begrenset CORS. Test i nettleseren:

```javascript
// I browser console:
fetch("https://data.ssb.no/api/v0/no/table/04920", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: [], response: { format: "json-stat2" } }),
})
  .then((r) => r.json())
  .then(console.log);
```

Hvis det feiler, bytt til Alternativ B (FastAPI-proxy). Kopier da
`ssb_kostra.py` fra `BAMBLE_KOMPASSET_UTVIDELSE.md` og bruk `fetch` mot
din lokale backend i stedet for direkte mot SSB.

### Finn riktig tabell-ID og variabelnavn

```
GET https://data.ssb.no/api/v0/no/table/{TABELL_ID}
```

Returnerer alle tilgjengelige dimensjoner og verdier uten å sende data.
Bruk dette hvis en spørring gir `400 Bad Request` — variabelnavn kan skifte.

### Vite proxy (unngå CORS-problemer lokalt)

Legg til i `vite.config.ts` hvis du vil route via en lokal backend:

```typescript
export default defineConfig({
  server: {
    proxy: {
      "/ssb": {
        target: "https://data.ssb.no",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ssb/, ""),
      },
    },
  },
});
```

Da endrer du `SSB_BASE` i `ssb.ts` til `/ssb/api/v0/no/table`.

---

## Rekkefølge for implementasjon

1. Opprett `src/api/ssb.ts` og test `hentDriftsresultat()` i nettleser-console
2. Opprett `src/hooks/useSSB.ts`
3. Opprett `src/components/StatHelpers.tsx`
4. Implementer `OkonomiPanel` — test med nøkkeltall-kortene først
5. Implementer `TjenesterPanel`
6. Implementer `NaeringsPanel`
7. Legg til de tre fanene i eksisterende statistikk-side

---

_Ingen nye avhengigheter nødvendig utover Chart.js (hvis ikke allerede installert).
SSB-API: åpent, gratis, ingen nøkkel. Bamble kommunenummer: 4012._
