import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { useSSB } from '../../hooks/useSSB';
import { hentDriftsresultat, hentLaanegjeld, KOMMUNER, KOMMUNER_UTEN_LAND, BAMBLE_ALLE_KODER } from '../../api/ssb';

const AAR = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];

function MetricKort({
  tittel, verdi, sub, ok,
}: {
  tittel: string; verdi: string; sub?: string; ok?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-0.5">{tittel}</p>
      <p className="text-xl font-bold text-gray-800">{verdi}</p>
      {sub && (
        <p className={`text-xs mt-0.5 ${ok === true ? 'text-green-600' : ok === false ? 'text-red-500' : 'text-gray-400'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[96, 220, 160].map((h, i) => (
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

export function OkonomiPanel() {
  const drift = useSSB(hentDriftsresultat, 'driftsresultat-v2');
  const gjeld = useSSB(hentLaanegjeld,    'laanegjeld');

  if (drift.laster || gjeld.laster) return <Skeleton />;
  if (drift.feil) return <Feil melding={drift.feil} />;
  if (gjeld.feil) return <Feil melding={gjeld.feil} />;

  // Tidsserie for linjediagram
  const tidsserie = AAR.map(aar => ({
    aar,
    bamble: drift.data!.find(r => BAMBLE_ALLE_KODER.includes(String(r.KOKkommuneregion0000)) && r.Tid === aar)?.verdi ?? null,
    land:   drift.data!.find(r => r.KOKkommuneregion0000 === 'EAK' && r.Tid === aar)?.verdi ?? null,
  }));

  const sisteBamble = tidsserie.map(r => r.bamble).filter(v => v != null).at(-1) as number;
  const sisteLand   = tidsserie.map(r => r.land).filter(v => v != null).at(-1) as number;
  const bambleGjeld = gjeld.data!.find(r => BAMBLE_ALLE_KODER.includes(String(r.KOKkommuneregion0000)))?.verdi as number;

  // Lånegjeld-søylediagram (alle kommuner utenom "Hele landet")
  const gjeldKommuner = Object.keys(KOMMUNER_UTEN_LAND);
  const gjeldData = gjeldKommuner.map(k => ({
    navn:  KOMMUNER[k],
    verdi: (gjeld.data!.find(r => r.KOKkommuneregion0000 === k)?.verdi ?? 0) as number,
    erBamble: k === '4012',
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Kommuneøkonomi</h3>

      {/* Nøkkeltall-kort */}
      <div className="grid grid-cols-3 gap-2">
        <MetricKort
          tittel="Driftsresultat 2024"
          verdi={`${sisteBamble?.toFixed(1)} %`}
          sub={sisteBamble >= 1.75 ? '▲ Over anbefalt' : '▼ Under anbefalt'}
          ok={sisteBamble >= 1.75}
        />
        <MetricKort
          tittel="Lånegjeld/innb."
          verdi={`${bambleGjeld?.toLocaleString('nb-NO')} kr`}
          sub="2024"
        />
        <MetricKort
          tittel="Landssnitt drift"
          verdi={`${sisteLand?.toFixed(1)} %`}
          sub="2024"
        />
      </div>

      {/* Driftsresultat linjediagram */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-1">Netto driftsresultat 2015–2024 (%)</p>
        <div className="flex gap-4 text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-blue-500" />Bamble
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed border-gray-400" />Landssnitt
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={tidsserie} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="aar" tick={{ fontSize: 9 }} interval={1} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(val: unknown) => [`${(val as number).toFixed(2)} %`]} />
            <ReferenceLine y={1.75} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'anbefalt 1,75 %', position: 'insideTopLeft', fontSize: 9, fill: '#f59e0b' }} />
            <Line type="monotone" dataKey="bamble" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="Bamble" connectNulls />
            <Line type="monotone" dataKey="land"   stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Landssnitt" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Lånegjeld søylediagram */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">Netto lånegjeld per innbygger 2024</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={gjeldData} layout="vertical" margin={{ top: 0, right: 40, left: 4, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${Math.round((v as number) / 1000)}k`} />
            <YAxis type="category" dataKey="navn" tick={{ fontSize: 10 }} width={60} />
            <Tooltip formatter={(val: unknown) => [`${(val as number).toLocaleString('nb-NO')} kr`]} />
            <Bar dataKey="verdi" radius={[0, 4, 4, 0]} name="Lånegjeld">
              {gjeldData.map((entry, i) => (
                <Cell key={i} fill={entry.erBamble ? '#3b82f6' : '#d1d5db'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-gray-400 mt-1">Kilde: KOSTRA / SSB tabell 04617 og 04920.</p>
      </div>
    </div>
  );
}
