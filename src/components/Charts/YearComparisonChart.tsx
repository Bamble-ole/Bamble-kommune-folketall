import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Cell,
} from 'recharts';
import { AGE_GROUPS } from '../../types';
import type { GrunnkretsProperties } from '../../types';
import { useMapStore, BASE_YEAR } from '../../store/mapStore';

interface Props {
  properties: GrunnkretsProperties;
}

export function YearComparisonChart({ properties }: Props) {
  const { allYearData, activeYear } = useMapStore();

  const baseKey = String(BASE_YEAR);
  const activeKey = String(activeYear);

  const propsBase = allYearData[BASE_YEAR]?.features.find(
    f => f.properties.grunnkretsnavn === properties.grunnkretsnavn
  )?.properties;

  if (!propsBase || activeYear === BASE_YEAR) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 flex items-center justify-center h-20 text-xs text-gray-400">
        Ingen sammenligningsdata — velg et annet år i glideren
      </div>
    );
  }

  const data = AGE_GROUPS.map(g => {
    const vActive = properties.ageGroups[g] ?? 0;
    const vBase = propsBase.ageGroups[g] ?? 0;
    return { name: g, [baseKey]: vBase, [activeKey]: vActive, endring: vActive - vBase };
  });

  const totalChange = (properties.totalBefolkning || 0) - (propsBase.totalBefolkning || 0);

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <h3 className="text-sm font-semibold text-gray-700">Endring {BASE_YEAR}–{activeYear}</h3>
        <span className={`text-sm font-bold ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {totalChange > 0 ? '+' : ''}{totalChange} pers.
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={44} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(val: unknown, name: unknown) => [
              name === 'endring' ? `${Number(val) > 0 ? '+' : ''}${val} pers.` : `${val} pers.`,
              name === 'endring' ? 'Endring' : String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine yAxisId="right" y={0} stroke="#888" strokeDasharray="3 3" />
          <Bar yAxisId="left" dataKey={baseKey} fill="#94a3b8" radius={[2, 2, 0, 0]} opacity={0.7} />
          <Bar yAxisId="left" dataKey={activeKey} fill="#3b82f6" radius={[2, 2, 0, 0]} opacity={0.85} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="endring"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
          >
            {data.map(d => (
              <Cell
                key={d.name}
                fill={d.endring >= 0 ? '#10b981' : '#ef4444'}
              />
            ))}
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
