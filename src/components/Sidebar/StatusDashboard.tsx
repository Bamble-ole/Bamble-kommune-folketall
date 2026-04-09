import { useMapStore, BASE_YEAR } from '../../store/mapStore';
import { KpiCard } from '../Shared/KpiCard';
import { SparklineChart } from '../Shared/SparklineChart';

function StatusRow({
  color, label, value,
}: {
  color: 'green' | 'yellow' | 'red';
  label: string;
  value: string;
}) {
  const dotClass =
    color === 'green'  ? 'bg-green-500' :
    color === 'yellow' ? 'bg-yellow-400' :
                         'bg-red-500';
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className={`mt-0.5 flex-shrink-0 w-2.5 h-2.5 rounded-full ${dotClass}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">{label}</p>
        <p className="text-xs text-gray-500">{value}</p>
      </div>
    </div>
  );
}

export function StatusDashboard() {
  const { allYearData, activeYear, catchmentAnalysis, geoData } = useMapStore();

  const currentGeo = geoData;
  const baseGeo    = allYearData[BASE_YEAR];

  if (!currentGeo) return null;

  const features = currentGeo.features;

  const totalPop      = features.reduce((s, f) => s + f.properties.totalBefolkning, 0);
  const totalEldre     = features.reduce((s, f) => s + f.properties.antallEldre,     0);
  const totalYngre     = features.reduce((s, f) => s + f.properties.antallYngre,     0);

  const andelEldre = totalPop > 0 ? (totalEldre / totalPop) * 100 : 0;
  const andelYngre = totalPop > 0 ? (totalYngre / totalPop) * 100 : 0;

  // Total change from BASE_YEAR
  let totalChange: number | null = null;
  if (baseGeo) {
    const basePop = baseGeo.features.reduce((s, f) => s + f.properties.totalBefolkning, 0);
    totalChange = totalPop - basePop;
  }

  // Traffic light statuses
  const popColor: 'green' | 'yellow' | 'red' =
    totalChange == null ? 'yellow' :
    totalChange > 0 ? 'green' :
    totalChange < 0 ? 'red' : 'yellow';

  const eldreColor: 'green' | 'yellow' | 'red' =
    andelEldre < 25 ? 'green' :
    andelEldre <= 35 ? 'yellow' : 'red';

  const eldreLabel =
    andelEldre < 25  ? 'Normalt' :
    andelEldre <= 35 ? 'Moderat' : 'Høyt press på omsorgstjenester';

  // Top growth / decline kretser
  const kretserWithChange = features
    .map(f => ({
      navn:    f.properties.grunnkretsnavn,
      endring: f.properties.endring,
      total:   f.properties.totalBefolkning,
    }))
    .filter(k => k.endring != null && k.total > 50) as {
      navn: string; endring: number; total: number;
    }[];

  const topGrowth   = [...kretserWithChange].sort((a, b) => b.endring - a.endring).slice(0, 3);
  const topDecline  = [...kretserWithChange].sort((a, b) => a.endring - b.endring).slice(0, 3);

  // Sparkline: total population per year in allYearData, sorted by year
  const popSparkData = Object.entries(allYearData)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, geo]) => geo.features.reduce((s, f) => s + f.properties.totalBefolkning, 0));

  return (
    <div className="space-y-5">
      {/* Section 1: Kommunestatistikk */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Bamble kommune</h3>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            label={`Innbyggere ${activeYear}`}
            value={totalPop.toLocaleString('nb-NO')}
            sparkline={popSparkData.length > 1 ? <SparklineChart data={popSparkData} /> : undefined}
          />
          <KpiCard
            label={`Siden ${BASE_YEAR}`}
            value={
              totalChange != null
                ? `${totalChange > 0 ? '+' : ''}${totalChange.toLocaleString('nb-NO')}`
                : '—'
            }
            valueColor={
              totalChange == null ? 'text-gray-400' :
              totalChange > 0 ? 'text-green-600' : 'text-red-600'
            }
            trend={totalChange == null ? undefined : totalChange > 0 ? 'up' : 'down'}
            subLabel="personer"
          />
          <KpiCard
            label="Andel eldre (60+)"
            value={`${andelEldre.toFixed(1)}%`}
            subLabel={`${totalEldre.toLocaleString('nb-NO')} pers.`}
          />
          <KpiCard
            label="Andel unge (0–19)"
            value={`${andelYngre.toFixed(1)}%`}
            subLabel={`${totalYngre.toLocaleString('nb-NO')} pers.`}
          />
        </div>
      </div>

      {/* Section 2: Statusoversikt */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Statusoversikt</h3>
        <div className="bg-white border border-gray-100 rounded-lg px-3 py-1">
          <StatusRow
            color={popColor}
            label="Befolkningsutvikling"
            value={
              totalChange != null
                ? `${totalChange > 0 ? '+' : ''}${totalChange.toLocaleString('nb-NO')} pers. siden ${BASE_YEAR}`
                : `Ingen data`
            }
          />
          <StatusRow
            color={eldreColor}
            label="Eldreandel (60+)"
            value={`${andelEldre.toFixed(1)}% – ${eldreLabel}`}
          />
          {catchmentAnalysis.map(item => {
            const ratio = item.utilizationRatio;
            const schoolColor: 'green' | 'yellow' | 'red' =
              ratio < 0.75 ? 'green' : ratio <= 1.0 ? 'yellow' : 'red';
            return (
              <StatusRow
                key={item.school.properties.skolenavn}
                color={schoolColor}
                label={item.school.properties.skolenavn}
                value={`${(ratio * 100).toFixed(0)}% kapasitet (${item.currentStudents} elever)`}
              />
            );
          })}
        </div>
      </div>

      {/* Section 3: Størst vekst / nedgang */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Størst vekst / Størst nedgang</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Growth */}
          <div>
            <p className="text-xs font-semibold text-green-700 mb-1">Størst vekst</p>
            <ul className="space-y-1">
              {topGrowth.map(k => (
                <li key={k.navn} className="flex justify-between text-xs">
                  <span className="text-gray-700 truncate mr-1">{k.navn}</span>
                  <span className="text-green-600 font-semibold flex-shrink-0">
                    +{k.endring}
                  </span>
                </li>
              ))}
              {topGrowth.length === 0 && (
                <li className="text-xs text-gray-400 italic">Ingen data</li>
              )}
            </ul>
          </div>
          {/* Decline */}
          <div>
            <p className="text-xs font-semibold text-red-700 mb-1">Størst nedgang</p>
            <ul className="space-y-1">
              {topDecline.map(k => (
                <li key={k.navn} className="flex justify-between text-xs">
                  <span className="text-gray-700 truncate mr-1">{k.navn}</span>
                  <span className="text-red-600 font-semibold flex-shrink-0">
                    {k.endring}
                  </span>
                </li>
              ))}
              {topDecline.length === 0 && (
                <li className="text-xs text-gray-400 italic">Ingen data</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
