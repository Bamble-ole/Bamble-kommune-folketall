import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { useMapStore } from '../../store/mapStore';

export function SchoolCapacityChart() {
  const { catchmentAnalysis } = useMapStore();

  if (!catchmentAnalysis.length) {
    return <p className="text-sm text-gray-500 italic">Laster skoledata...</p>;
  }

  const isUngdom = (c: typeof catchmentAnalysis[0]) =>
    c.school.properties.trinn_Trinn_lavesteTrinn > 1;

  const data = catchmentAnalysis
    .filter(c => c.school.properties.antallElever > 0)
    .map(c => ({
      name: c.school.properties.skolenavn
        .replace(' barneskole', '')
        .replace(' ungdomsskole', ''),
      elever: c.currentStudents,
      barn: c.childrenInArea,
      ratio: Math.round(c.utilizationRatio * 100),
      type: isUngdom(c) ? 'ungdom' : 'barne',
    }))
    .sort((a, b) => b.elever - a.elever);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Skolekapasitet</h3>
      <p className="text-xs text-gray-500 mb-3">
        Elever vs. barn i skolekrets-alder (grønn bar = elever).
        Barneskoler: barn 6–12 år i nærmeste kretser.
        Ungdomsskoler: barn 13–15 år i hele kommunen.
      </p>

      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 45)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 10, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10 }}
            width={90}
          />
          <Tooltip
            formatter={(val: unknown, name: unknown, item: unknown) => {
              const entry = (item as { payload?: { type?: string } })?.payload;
              const isUngdomRow = entry?.type === 'ungdom';
              if (String(name) === 'elever') return [`${val}`, 'Elever (nå)'];
              return [`${val}`, isUngdomRow ? 'Barn 13–15 år (est.)' : 'Barn 6–12 år (est.)'];
            }}
          />
          <Bar dataKey="barn" name="barn" fill="#94a3b8" radius={[0, 2, 2, 0]} opacity={0.7} />
          <Bar dataKey="elever" name="elever" fill="#3b82f6" radius={[0, 2, 2, 0]}>
            {data.map(d => (
              <Cell
                key={d.name}
                fill={
                  d.ratio > 100 ? '#ef4444' :
                  d.ratio > 75  ? '#f59e0b' :
                  '#10b981'
                }
              />
            ))}
            <LabelList
              dataKey="ratio"
              position="right"
              formatter={(v: unknown) => `${v}%`}
              style={{ fontSize: 10, fill: '#374151' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-green-500" />Under 75%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-yellow-500" />75–100%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-red-500" />Over 100%
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        * Estimert fra SSB 5-årsgrupper. Barneskole: 6–12 år. Ungdomsskole: 13–15 år.
      </p>
    </div>
  );
}
