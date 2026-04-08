import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useSSB } from '../../hooks/useSSB';
import {
  hentSysselsettingNaering,
  hentArbeidsledighet,
  hentMedianinntektTidsserie,
  KOMMUNER,
  KOMMUNER_HISTORISKE,
} from '../../api/ssb';

const NACE_NAVN: Record<string, string> = {
  '10-33': 'Industri',
  '86-88': 'Helse/sosial',
  '45-47': 'Varehandel',
  '41-43': 'Bygg/anlegg',
  '85':    'Undervisning',
  '49-53': 'Transport',
  '84':    'Off.adm.',
  '68-75': 'Tekn. tjenester',
  '77-82': 'Forretningstj.',
  '58-63': 'Info/komm.',
  '64-66': 'Finans',
  '55-56': 'Overnatting',
  '35-39': 'Energi/vann',
  '01-03': 'Jordbruk',
  '90-99': 'Personlig tj.',
};

// Kommuner i riktig rekkefølge for sammenligning
const NABOER = Object.keys(KOMMUNER_HISTORISKE) as Array<keyof typeof KOMMUNER_HISTORISKE>;
const NABOER_KODER_2024 = NABOER.map(n => KOMMUNER_HISTORISKE[n].fra2024);

function MetricKort({
  tittel, verdi, sub,
}: {
  tittel: string; verdi: string; sub?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-0.5">{tittel}</p>
      <p className="text-xl font-bold text-gray-800">{verdi}</p>
      {sub && <p className="text-xs mt-0.5 text-gray-400">{sub}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[80, 240, 140].map((h, i) => (
        <div key={i} className="animate-pulse bg-gray-200 rounded-xl" style={{ height: h }} />
      ))}
    </div>
  );
}

export function NaeringsPanel() {
  const syss     = useSSB(hentSysselsettingNaering,    'sysselsetting-2025');
  const ledighet = useSSB(hentArbeidsledighet,         'ledighet');
  const inntekt  = useSSB(hentMedianinntektTidsserie,  'inntekt-tidsserie');

  if (syss.laster || ledighet.laster || inntekt.laster) return <Skeleton />;

  // ─── Sysselsetting ────────────────────────────────────────────────────────
  const syssAar = (syss.data ?? []).find(r => r.Tid)?.Tid as string | undefined;

  const totalSyss = (syss.data ?? []).find(r => r.NACE2007 === '00-99')?.verdi as number | undefined;

  const syssRader = (syss.data ?? [])
    .filter(r => r.NACE2007 !== '00-99' && NACE_NAVN[String(r.NACE2007)])
    .map(r => ({
      navn:   NACE_NAVN[String(r.NACE2007)],
      antall: r.verdi as number,
      pct:    totalSyss && r.verdi
        ? Math.round(((r.verdi as number) / totalSyss) * 1000) / 10
        : 0,
    }))
    .filter(r => r.antall > 0)
    .sort((a, b) => b.antall - a.antall);

  // ─── Arbeidsledighet ──────────────────────────────────────────────────────
  const bambleLedigRader = (ledighet.data ?? [])
    .filter(r => r.Region === '4012')
    .sort((a, b) => String(b.Tid).localeCompare(String(a.Tid)));

  const bambleLedigSiste = bambleLedigRader[0];
  const ledigAar = bambleLedigSiste?.Tid as string | undefined;

  // ─── Medianinntekt ────────────────────────────────────────────────────────
  // hentMedianinntektTidsserie normaliserer alle Region-koder til fra2024-koder
  // Finn siste år Bamble har data
  const bambleInntektRader = (inntekt.data ?? [])
    .filter(r => r.Region === '4012' && r.verdi != null)
    .sort((a, b) => String(b.Tid).localeCompare(String(a.Tid)));

  const bambleInntektSiste = bambleInntektRader[0];
  const inntektAar = bambleInntektSiste?.Tid as string | undefined;
  const bambleInntekt = bambleInntektSiste?.verdi as number | undefined;

  // Sammenligning for siste år med Bamble-data
  const inntektData = NABOER_KODER_2024.map(kode => ({
    navn:     KOMMUNER[kode] ?? kode,
    verdi:    (inntekt.data?.find(r => r.Region === kode && r.Tid === inntektAar)?.verdi ?? 0) as number,
    erBamble: kode === '4012',
  })).filter(d => d.verdi > 0);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Næringsliv</h3>

      {/* Nøkkeltall */}
      <div className="grid grid-cols-2 gap-2">
        <MetricKort
          tittel="Medianinntekt (hushold.)"
          verdi={bambleInntekt ? bambleInntekt.toLocaleString('nb-NO') + ' kr' : '—'}
          sub={inntektAar ? `Inntekt etter skatt, ${inntektAar}` : 'Data ikke tilgjengelig'}
        />
        <MetricKort
          tittel="Registrert arbeidsledige"
          verdi={bambleLedigSiste?.verdi != null
            ? (bambleLedigSiste.verdi as number).toLocaleString('nb-NO') + ' pers.'
            : '—'}
          sub={ledigAar ?? 'Data ikke tilgjengelig'}
        />
      </div>

      {/* Sysselsetting per næring */}
      {syssRader.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-600 mb-0.5">
            Sysselsetting per næring{syssAar ? ` (${syssAar})` : ''}
          </p>
          {totalSyss && (
            <p className="text-[10px] text-gray-400 mb-2">
              Totalt {totalSyss.toLocaleString('nb-NO')} sysselsatte
            </p>
          )}
          <ResponsiveContainer width="100%" height={Math.max(200, syssRader.length * 22)}>
            <BarChart
              data={syssRader}
              layout="vertical"
              margin={{ top: 0, right: 45, left: 4, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="navn" tick={{ fontSize: 10 }} width={90} />
              <Tooltip
                formatter={(val: unknown, _name: unknown, props: { payload?: { antall?: number } }) => [
                  `${(val as number).toFixed(1)} %  (${props.payload?.antall?.toLocaleString('nb-NO') ?? ''} pers.)`,
                ]}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="Andel" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 mt-1">Kilde: SSB tabell 07984.</p>
        </div>
      )}

      {/* Medianinntekt kommunesammenligning */}
      {inntektData.length > 1 && (
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            Medianinntekt per hushold.{inntektAar ? ` ${inntektAar}` : ''} (kr)
          </p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={inntektData}
              layout="vertical"
              margin={{ top: 0, right: 50, left: 4, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 9 }}
                tickFormatter={v => `${Math.round((v as number) / 1000)}k`}
              />
              <YAxis type="category" dataKey="navn" tick={{ fontSize: 10 }} width={65} />
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <Tooltip formatter={(val: unknown) => [`${(val as number).toLocaleString('nb-NO')} kr`]} />
              <Bar dataKey="verdi" radius={[0, 4, 4, 0]} name="Medianinntekt">
                {inntektData.map((entry, i) => (
                  <Cell key={i} fill={entry.erBamble ? '#3b82f6' : '#d1d5db'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 mt-1">Kilde: SSB tabell 06944.</p>
        </div>
      )}
    </div>
  );
}
