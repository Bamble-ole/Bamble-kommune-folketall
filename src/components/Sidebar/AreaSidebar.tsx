import { useMapStore, BASE_YEAR } from '../../store/mapStore';
import { AgeDistributionChart } from '../Charts/AgeDistributionChart';
import { YearComparisonChart } from '../Charts/YearComparisonChart';
import { ForecastChart } from '../Charts/ForecastChart';
import { StatusDashboard } from './StatusDashboard';
import { ComparisonView } from './ComparisonView';
import { OkonomiPanel } from './OkonomiPanel';
import { TjenesterPanel } from './TjenesterPanel';
import { NaeringsPanel } from './NaeringsPanel';

export function AreaSidebar() {
  const {
    selectedArea, setSelectedArea,
    activeYear, sidebarTab, setSidebarTab,
    catchmentAnalysis, geoData,
    compareArea, compareMode, toggleCompareMode, setCompareArea,
  } = useMapStore();

  if (!selectedArea && catchmentAnalysis.length === 0) return null;

  // Look up live properties from current year's geoData so stats update with the slider
  const p = selectedArea
    ? (geoData?.features.find(
        f => f.properties.grunnkretsnavn === selectedArea.grunnkretsnavn
      )?.properties ?? selectedArea.properties)
    : undefined;

  const isChartsActive    = sidebarTab === 'charts';
  const isDashActive      = sidebarTab === 'dashboard';
  const isOkonomiActive   = sidebarTab === 'okonomi';
  const isTjenesterActive = sidebarTab === 'tjenester';
  const isNaeringActive   = sidebarTab === 'naering';

  return (
    <aside className="flex flex-col bg-white border-l border-gray-200 shadow-xl overflow-hidden h-full">
      {/* Accent stripe */}
      <div className="h-1 bg-gradient-to-r from-blue-600 to-blue-400 flex-shrink-0" />

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <button
          onClick={() => setSidebarTab('dashboard')}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            isDashActive
              ? 'text-blue-700 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bamble
        </button>
        <button
          onClick={() => { if (selectedArea) setSidebarTab('charts'); }}
          disabled={!selectedArea}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            isChartsActive
              ? 'text-blue-700 border-b-2 border-blue-600 bg-white'
              : selectedArea
                ? 'text-gray-500 hover:text-gray-700'
                : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          Grunnkrets
        </button>
        <button
          onClick={() => setSidebarTab('okonomi')}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            isOkonomiActive
              ? 'text-blue-700 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Økonomi
        </button>
        <button
          onClick={() => setSidebarTab('tjenester')}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            isTjenesterActive
              ? 'text-blue-700 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Tjenester
        </button>
        <button
          onClick={() => setSidebarTab('naering')}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            isNaeringActive
              ? 'text-blue-700 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Næring
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isNaeringActive ? (
          <NaeringsPanel />
        ) : isTjenesterActive ? (
          <TjenesterPanel />
        ) : isOkonomiActive ? (
          <OkonomiPanel />
        ) : isDashActive ? (
          <StatusDashboard />
        ) : (
          isChartsActive && selectedArea && p && (
            <>
              {/* Area header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-gray-800">{p.grunnkretsnavn}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Grunnkrets · Bamble kommune</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Compare button */}
                  <button
                    onClick={() => {
                      if (compareMode) {
                        // setCompareArea already resets compareMode to false;
                        // if no compareArea was selected yet, toggle manually.
                        if (compareArea) {
                          setCompareArea(null);
                        } else {
                          toggleCompareMode();
                        }
                      } else {
                        toggleCompareMode();
                      }
                    }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      compareMode
                        ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                        : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {compareMode ? 'Avbryt' : 'Sammenlign ▼'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedArea(null);
                      // setCompareArea resets compareMode; if compareMode is on
                      // but no compareArea set yet, toggle it off manually
                      if (compareMode) {
                        if (compareArea) {
                          setCompareArea(null);
                        } else {
                          toggleCompareMode();
                        }
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none p-0.5"
                    title="Lukk"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Compare mode banner when no compareArea yet */}
              {compareMode && !compareArea && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                  <span>🗺️</span>
                  <span>Klikk på et område i kartet for å sammenligne</span>
                </div>
              )}

              {/* Either ComparisonView or normal area charts */}
              {compareArea ? (
                <ComparisonView />
              ) : (
                <>
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard
                      label={`Innbyggere ${activeYear}`}
                      value={p.totalBefolkning.toString()}
                      sub=""
                      accent="border-blue-400"
                    />
                    <StatCard
                      label={`Endring ${BASE_YEAR}–${activeYear}`}
                      value={p.endring != null
                        ? `${p.endring > 0 ? '+' : ''}${p.endring}`
                        : '—'}
                      valueColor={p.endring != null
                        ? p.endring > 0 ? 'text-green-600' : p.endring < 0 ? 'text-red-600' : 'text-gray-700'
                        : 'text-gray-400'}
                      sub="personer"
                      accent={p.endring == null ? 'border-gray-300' : p.endring >= 0 ? 'border-green-400' : 'border-red-400'}
                    />
                    <StatCard
                      label="Andel eldre (60+)"
                      value={`${(p.andelEldre * 100).toFixed(1)}%`}
                      sub={`${p.antallEldre} pers.`}
                      accent="border-orange-400"
                    />
                    <StatCard
                      label="Andel unge (0–19)"
                      value={`${(p.andelYngre * 100).toFixed(1)}%`}
                      sub={`${p.antallYngre} pers.`}
                      accent="border-emerald-400"
                    />
                  </div>

                  <AgeDistributionChart properties={p} year={activeYear} />

                  <YearComparisonChart properties={p} />

                  <ForecastChart properties={p} />
                </>
              )}
            </>
          )
        )}
      </div>
    </aside>
  );
}

function StatCard({
  label, value, sub = '', valueColor = 'text-gray-800', accent = 'border-blue-400',
}: {
  label: string; value: string; sub?: string; valueColor?: string; accent?: string;
}) {
  return (
    <div className={`bg-gray-50 rounded-lg p-3 border-l-4 ${accent}`}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
