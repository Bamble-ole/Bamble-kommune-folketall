import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { AGE_GROUPS } from '../../types';
import type { GrunnkretsProperties } from '../../types';

interface Props {
  properties: GrunnkretsProperties;
  year: number;
}

const COLORS = {
  young: '#3b82f6',   // 0–19
  adult: '#10b981',   // 20–59
  senior: '#f59e0b',  // 60+
};

function barColor(group: string): string {
  const idx = AGE_GROUPS.indexOf(group as typeof AGE_GROUPS[number]);
  if (idx < 4) return COLORS.young;
  if (idx < 12) return COLORS.adult;
  return COLORS.senior;
}

export function AgeDistributionChart({ properties, year }: Props) {
  const data = AGE_GROUPS.map(g => ({
    name: g,
    value: properties.ageGroups[g] ?? 0,
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        Aldersfordeling {year}
      </h3>
      <div className="flex gap-3 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.young }} />0–19 år</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.adult }} />20–59 år</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.senior }} />60+ år</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={40} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(val: unknown) => [`${val} pers.`, 'Antall']}
            labelFormatter={l => `Aldersgruppe: ${l}`}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map(d => (
              <Cell key={d.name} fill={barColor(d.name)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
