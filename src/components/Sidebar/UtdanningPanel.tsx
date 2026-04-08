import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { useSSB } from '../../hooks/useSSB';
import { hentUtdanningsnivaa } from '../../api/ssb';

const NIVAA_NAVN: Record<string, string> = {
  '01':  'Grunnskole',
  '02a': 'Videregående',
  '03a': 'Uni, 1–4 år',
  '04a': 'Uni, 5+ år',
};

const NIVAA_FARGER: Record<string, string> = {
  '01':  '#d1d5db',
  '02a': '#93c5fd',
  '03a': '#3b82f6',
  '04a': '#1d4ed8',
};

const AAR = ['2010', '2015', '2019', '2020', '2021', '2022', '2023', '2024'];

function Skeleton() {
  return (
    <div className="space-y-3">
      {[80, 220, 160].map((h, i) => (
        <div key={i} className="animate-pulse bg-gray-200 rounded-xl" style={{ height: h }} />
      ))}
    </div>
  );
}

function Feil({ melding }: { melding: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
      Kunne ikke laste data: {melding}
    </div>
  );
}

export function UtdanningPanel() {
  const { data, laster, feil } = useSSB(hentUtdanningsnivaa, 'utdanning-v2');

  if (laster) return <Skeleton />;
  if (feil)   return <Feil melding={feil} />;

  // Finn siste og første år med faktiske data
  const tilgjengeligeAar = [...new Set((data ?? []).map(r => String(r.Tid)))].sort();
  const sisteAar  = tilgjengeligeAar.at(-1) ?? AAR.at(-1)!;
  const forsteAar = tilgjengeligeAar[0] ?? AAR[0];
  const sisteData = (data ?? []).filter(r => r.Tid === sisteAar);

  const hoeyere = sisteData
    .filter(r => r.Nivaa === '03a' || r.Nivaa === '04a')
    .reduce((s, r) => s + (r.verdi as number ?? 0), 0);
  const uniKort = sisteData.find(r => r.Nivaa === '03a')?.verdi as number ?? 0;
  const uniLang = sisteData.find(r => r.Nivaa === '04a')?.verdi as number ?? 0;

  // Stablede søyler per år
  const stapelData = AAR.map(aar => {
    const rader = (data ?? []).filter(r => r.Tid === aar);
    const obj: Record<string, number | string> = { aar };
    Object.keys(NIVAA_NAVN).forEach(kode => {
      obj[kode] = rader.find(r => r.Nivaa === kode)?.verdi as number ?? 0;
    });
    return obj;
  });

  // Tidsserie høyere utdanning
  const tidsserieHoeyere = AAR.map(aar => {
    const rader = (data ?? []).filter(r => r.Tid === aar);
    const h = ['03a', '04a'].reduce(
      (s, k) => s + ((rader.find(r => r.Nivaa === k)?.verdi as number) ?? 0),
      0,
    );
    return { aar, hoeyere: h || null };
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Utdanningsnivå</h3>

      {/* Nøkkeltall */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Høyere utd. ({sisteAar})</p>
          <p className="text-lg font-bold text-gray-800">{hoeyere.toFixed(1)} %</p>
          <p className="text-[10px] text-gray-400">av befolkningen</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Uni, 1–4 år</p>
          <p className="text-lg font-bold text-gray-800">{uniKort.toFixed(1)} %</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Uni, 5+ år</p>
          <p className="text-lg font-bold text-gray-800">{uniLang.toFixed(1)} %</p>
        </div>
      </div>

      {/* Stablede søyler */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          Utdanningsnivå fordeling {forsteAar}–{sisteAar} (%)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stapelData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="aar" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(val: unknown, name: unknown) => [
              `${(val as number).toFixed(1)} %`,
              NIVAA_NAVN[name as string] ?? name,
            ]} />
            <Legend
              formatter={name => NIVAA_NAVN[name] ?? name}
              iconType="square"
              wrapperStyle={{ fontSize: 10 }}
            />
            {Object.entries(NIVAA_NAVN).map(([kode]) => (
              <Bar
                key={kode}
                dataKey={kode}
                stackId="a"
                fill={NIVAA_FARGER[kode]}
                name={kode}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tidsserie høyere utdanning */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          Andel med høyere utdanning {forsteAar}–{sisteAar} (%)
        </p>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={tidsserieHoeyere} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="aar" tick={{ fontSize: 9 }} interval={1} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(val: unknown) => [`${(val as number).toFixed(1)} %`]} />
            <Line
              type="monotone"
              dataKey="hoeyere"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Høyere utdanning"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-gray-400 mt-1">
          Kilde: SSB tabell 09429. Høyere utdanning = universitets- og høgskolenivå.
        </p>
      </div>
    </div>
  );
}
