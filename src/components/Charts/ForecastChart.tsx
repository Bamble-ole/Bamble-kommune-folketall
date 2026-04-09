import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { GrunnkretsProperties } from '../../types';
import { useMapStore } from '../../store/mapStore';

interface Props {
  properties: GrunnkretsProperties;
}

const FORECAST_END = 2035;

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope     = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return (x: number) => Math.max(0, Math.round(slope * x + intercept));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const historisk = payload.find((p: any) => p.dataKey === 'historisk');
  const prognose  = payload.find((p: any) => p.dataKey === 'prognose');
  const val  = historisk?.value ?? prognose?.value;
  const isF  = !historisk?.value && prognose?.value != null;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm px-2 py-1 text-xs">
      <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
      {val != null && (
        <p className={isF ? 'text-orange-600' : 'text-blue-700'}>
          {isF ? 'Prognose' : 'Historisk'}: {val} pers.
        </p>
      )}
    </div>
  );
}

export function ForecastChart({ properties }: Props) {
  const { allYearData } = useMapStore();

  // Build historical time series
  const historical: { year: number; pop: number }[] = [];
  for (const [yearStr, fc] of Object.entries(allYearData)) {
    const year = Number(yearStr);
    const feat = fc.features.find(
      f => f.properties.grunnkretsnavn === properties.grunnkretsnavn
    );
    if (feat && feat.properties.totalBefolkning > 0) {
      historical.push({ year, pop: feat.properties.totalBefolkning });
    }
  }
  historical.sort((a, b) => a.year - b.year);

  if (historical.length < 3) return (
    <div className="rounded-lg border border-dashed border-gray-200 flex items-center justify-center h-24 text-xs text-gray-400">
      Ikke nok historiske data for prognose
    </div>
  );

  const lastHistoricalYear = historical[historical.length - 1].year;

  // Use last 5 data points for regression
  const regressionPoints = historical.slice(-5).map(d => ({ x: d.year, y: d.pop }));
  const predict = linearRegression(regressionPoints);

  // Build chart data: all historical years + forecast years
  const allYears: number[] = [];
  for (const d of historical) allYears.push(d.year);
  for (let y = lastHistoricalYear + 1; y <= FORECAST_END; y++) allYears.push(y);

  const histMap = new Map(historical.map(d => [d.year, d.pop]));

  const chartData = allYears.map(year => {
    const isForecast = year > lastHistoricalYear;
    const isLastHistorical = year === lastHistoricalYear;
    return {
      year,
      historisk: isForecast ? null : histMap.get(year) ?? null,
      // Last historical point also gets a prognose value so the line connects
      prognose:  (isForecast || isLastHistorical) ? predict(year) : null,
    };
  });

  return (
    <div>
      <div className="flex justify-between items-baseline mb-0.5">
        <h3 className="text-sm font-semibold text-gray-700">Befolkningsprognose</h3>
      </div>
      <p className="text-xs text-gray-500 mb-2">Estimert trend til 2035 *</p>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 9 }}
            interval={1}
            angle={-45}
            textAnchor="end"
            height={36}
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={lastHistoricalYear}
            stroke="#6b7280"
            strokeDasharray="4 2"
            label={{ value: 'Nå', position: 'top', fontSize: 10, fill: '#6b7280' }}
          />
          <Bar
            dataKey="historisk"
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
            opacity={0.85}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="prognose"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 italic mt-1">
        * Lineær trend basert på siste 5 år. Ikke offisiell prognose.
      </p>
    </div>
  );
}
