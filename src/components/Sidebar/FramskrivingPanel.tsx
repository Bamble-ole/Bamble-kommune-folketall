import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useSSB } from '../../hooks/useSSB';
import { hentBefolkningsframskriving } from '../../api/ssb';

function Skeleton() {
  return (
    <div className="space-y-3">
      {[80, 220].map((h, i) => (
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

export function FramskrivingPanel() {
  const { data, laster, feil } = useSSB(hentBefolkningsframskriving, 'framskriving');

  if (laster) return <Skeleton />;
  if (feil)   return <Feil melding={feil} />;

  if (!data || data.length === 0) return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
      Framskrivingsdata ikke tilgjengelig.
    </div>
  );

  const basisaar = data[0];
  const siste    = data[data.length - 1];
  const endring  = siste.befolkning - basisaar.befolkning;
  const pct      = ((endring / basisaar.befolkning) * 100).toFixed(1);

  // Finn topp
  const topp = data.reduce((best, r) => r.befolkning > best.befolkning ? r : best, data[0]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Befolkningsframskriving</h3>

      {/* Nøkkeltall */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">I dag ({basisaar.aar})</p>
          <p className="text-lg font-bold text-gray-800">
            {basisaar.befolkning.toLocaleString('nb-NO')}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Topp ({topp.aar})</p>
          <p className="text-lg font-bold text-gray-800">
            {topp.befolkning.toLocaleString('nb-NO')}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">2050</p>
          <p className={`text-lg font-bold ${endring >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {endring >= 0 ? '+' : ''}{pct} %
          </p>
          <p className="text-[10px] text-gray-400">
            {endring >= 0 ? '+' : ''}{endring.toLocaleString('nb-NO')} pers.
          </p>
        </div>
      </div>

      {/* Linjediagram */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          Forventet befolkning {basisaar.aar}–{siste.aar} (MMMM-alternativet)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="aar" tick={{ fontSize: 9 }} interval={3} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={v => (v as number).toLocaleString('nb-NO')}
              width={52}
              domain={['dataMin - 100', 'dataMax + 100']}
            />
            <Tooltip
              formatter={(val: unknown) => [
                `${(val as number).toLocaleString('nb-NO')} pers.`,
              ]}
            />
            <ReferenceLine
              x={basisaar.aar}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              label={{ value: 'I dag', position: 'insideTopRight', fontSize: 9, fill: '#9ca3af' }}
            />
            <Line
              type="monotone"
              dataKey="befolkning"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Befolkning"
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-gray-400 mt-1">
          Kilde: SSB tabell 14288, MMMM-alternativet (middels nasjonal vekst).
        </p>
      </div>
    </div>
  );
}
