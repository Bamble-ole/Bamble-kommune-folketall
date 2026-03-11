import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { AGE_GROUPS } from '../../types';
import { useMapStore, BASE_YEAR } from '../../store/mapStore';

export function ComparisonView() {
  const {
    selectedArea,
    compareArea,
    setSelectedArea,
    setCompareArea,
    geoData,
    activeYear,
  } = useMapStore();

  if (!selectedArea) return null;

  // Look up live properties from current geoData
  const propsA = selectedArea
    ? (geoData?.features.find(
        f => f.properties.grunnkretsnavn === selectedArea.grunnkretsnavn
      )?.properties ?? selectedArea.properties)
    : null;

  const propsB = compareArea
    ? (geoData?.features.find(
        f => f.properties.grunnkretsnavn === compareArea.grunnkretsnavn
      )?.properties ?? compareArea.properties)
    : null;

  if (!compareArea || !propsB) {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
        <span className="text-lg">🗺️</span>
        <span>Klikk på et område i kartet for å sammenligne</span>
      </div>
    );
  }

  if (!propsA) return null;

  // Age distribution chart data
  const ageData = AGE_GROUPS.map(g => ({
    name: g,
    areaA: propsA.ageGroups[g] ?? 0,
    areaB: propsB.ageGroups[g] ?? 0,
  }));

  const nameA = propsA.grunnkretsnavn;
  const nameB = propsB.grunnkretsnavn;

  function changeColor(val: number | null) {
    if (val == null) return 'text-gray-400';
    if (val > 0) return 'text-green-600';
    if (val < 0) return 'text-red-600';
    return 'text-gray-700';
  }

  function fmt(val: number | null) {
    if (val == null) return '—';
    return `${val > 0 ? '+' : ''}${val}`;
  }

  return (
    <div className="space-y-4">
      {/* Area headers */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 rounded-lg p-2 flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-blue-800 truncate">{nameA}</p>
            <p className="text-xs text-blue-600">Område A</p>
          </div>
          <button
            onClick={() => setSelectedArea(null)}
            className="text-blue-400 hover:text-blue-600 text-sm leading-none"
            title="Fjern A"
          >
            ×
          </button>
        </div>
        <div className="bg-orange-50 rounded-lg p-2 flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-orange-800 truncate">{nameB}</p>
            <p className="text-xs text-orange-600">Område B</p>
          </div>
          <button
            onClick={() => setCompareArea(null)}
            className="text-orange-400 hover:text-orange-600 text-sm leading-none"
            title="Fjern B"
          >
            ×
          </button>
        </div>
      </div>

      {/* Comparison stats table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
        <div className="grid grid-cols-3 bg-gray-50 font-semibold text-gray-600">
          <div className="px-3 py-2">Statistikk</div>
          <div className="px-3 py-2 text-blue-700 truncate">{nameA}</div>
          <div className="px-3 py-2 text-orange-700 truncate">{nameB}</div>
        </div>
        {/* Innbyggere */}
        <div className="grid grid-cols-3 border-t border-gray-100">
          <div className="px-3 py-2 text-gray-600">Innbyggere</div>
          <div className="px-3 py-2 font-semibold text-gray-800">
            {propsA.totalBefolkning.toLocaleString('nb-NO')}
          </div>
          <div className="px-3 py-2 font-semibold text-gray-800">
            {propsB.totalBefolkning.toLocaleString('nb-NO')}
          </div>
        </div>
        {/* Endring */}
        <div className="grid grid-cols-3 border-t border-gray-100 bg-gray-50/50">
          <div className="px-3 py-2 text-gray-600">Endring f. {BASE_YEAR}</div>
          <div className={`px-3 py-2 font-semibold ${changeColor(propsA.endring)}`}>
            {fmt(propsA.endring)}
          </div>
          <div className={`px-3 py-2 font-semibold ${changeColor(propsB.endring)}`}>
            {fmt(propsB.endring)}
          </div>
        </div>
        {/* Andel eldre */}
        <div className="grid grid-cols-3 border-t border-gray-100">
          <div className="px-3 py-2 text-gray-600">Andel eldre</div>
          <div className="px-3 py-2 font-semibold text-gray-800">
            {(propsA.andelEldre * 100).toFixed(1)}%
          </div>
          <div className="px-3 py-2 font-semibold text-gray-800">
            {(propsB.andelEldre * 100).toFixed(1)}%
          </div>
        </div>
        {/* Andel unge */}
        <div className="grid grid-cols-3 border-t border-gray-100 bg-gray-50/50">
          <div className="px-3 py-2 text-gray-600">Andel unge</div>
          <div className="px-3 py-2 font-semibold text-gray-800">
            {(propsA.andelYngre * 100).toFixed(1)}%
          </div>
          <div className="px-3 py-2 font-semibold text-gray-800">
            {(propsB.andelYngre * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Combined age distribution chart */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Aldersfordeling {activeYear}
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={ageData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 8 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={40}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(val: unknown, name: unknown) => [
                `${val} pers.`,
                name === 'areaA' ? nameA : nameB,
              ]}
              labelFormatter={l => `Aldersgruppe: ${l}`}
            />
            <Legend
              formatter={(value) => value === 'areaA' ? nameA : nameB}
              wrapperStyle={{ fontSize: 10 }}
            />
            <Bar dataKey="areaA" fill="#3b82f6" radius={[2, 2, 0, 0]} opacity={0.85} />
            <Bar dataKey="areaB" fill="#f97316" radius={[2, 2, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
