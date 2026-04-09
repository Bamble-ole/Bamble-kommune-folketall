import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { useSSB } from '../../hooks/useSSB';
import { hentPendling } from '../../api/ssb';

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

export function PendlingPanel() {
  const { data, laster, feil } = useSSB(hentPendling, 'pendling-2025');

  if (laster) return <Skeleton />;
  if (feil)   return <Feil melding={feil} />;

  if (!data || data.length === 0) return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
      Pendlingsdata ikke tilgjengelig.
    </div>
  );

  const siste = data[data.length - 1];

  // Netto pendling: positivt = netto innpendling
  const nettoPendling = siste.innpendling - siste.utpendling;
  const totaltSysselsatt = siste.selvpendling + siste.innpendling;
  const utpendlingsandel = siste.utpendling > 0
    ? Math.round((siste.utpendling / (siste.selvpendling + siste.utpendling)) * 100)
    : 0;

  // Data for stablet søylediagram
  const stabelData = data.map(r => ({
    aar:          r.aar,
    Selvpendling: r.selvpendling,
    Innpendling:  r.innpendling,
    Utpendling:   r.utpendling,
  }));

  // Netto pendling tidsserie
  const nettoData = data.map(r => ({
    aar:   r.aar,
    netto: r.innpendling - r.utpendling,
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Pendling</h3>

      {/* Nøkkeltall */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Innpendling ({siste.aar})</p>
          <p className="text-xl font-bold text-gray-800">
            {siste.innpendling.toLocaleString('nb-NO')}
          </p>
          <p className="text-[10px] text-gray-400">pers. utenfra</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Utpendling</p>
          <p className="text-xl font-bold text-gray-800">
            {siste.utpendling.toLocaleString('nb-NO')}
          </p>
          <p className="text-[10px] text-gray-400">{utpendlingsandel} % av bosatte</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Netto</p>
          <p className={`text-xl font-bold ${nettoPendling >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {nettoPendling >= 0 ? '+' : ''}{nettoPendling.toLocaleString('nb-NO')}
          </p>
          <p className="text-[10px] text-gray-400">
            {totaltSysselsatt.toLocaleString('nb-NO')} arb.plasser totalt
          </p>
        </div>
      </div>

      {/* Stablet søylediagram */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          Pendlingsstrømmer 2015–{siste.aar}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stabelData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="aar" tick={{ fontSize: 9 }} interval={1} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round((v as number) / 1000)}k`} />
            <Tooltip formatter={(val: unknown, name: unknown) => [
              `${(val as number).toLocaleString('nb-NO')} pers.`, name,
            ]} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="Selvpendling" stackId="a" fill="#93c5fd" />
            <Bar dataKey="Innpendling"  stackId="a" fill="#3b82f6" />
            <Bar dataKey="Utpendling"   fill="#d1d5db" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Netto pendling tidsserie */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-1">
          Netto pendling 2015–{siste.aar}
        </p>
        <p className="text-[10px] text-gray-400 mb-2">
          Positivt = flere pendler inn enn ut
        </p>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={nettoData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="aar" tick={{ fontSize: 9 }} interval={1} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(val: unknown) => [`${(val as number).toLocaleString('nb-NO')} pers.`]} />
            <Line
              type="monotone"
              dataKey="netto"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Netto pendling"
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-gray-400 mt-1">
          Kilde: SSB tabell 03321. 4. kvartal hvert år.
        </p>
      </div>
    </div>
  );
}
