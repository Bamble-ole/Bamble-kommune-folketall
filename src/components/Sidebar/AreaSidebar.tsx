import { useMapStore, BASE_YEAR } from '../../store/mapStore';
import { KpiCard } from '../Shared/KpiCard';
import { AgeDistributionChart } from '../Charts/AgeDistributionChart';
import { YearComparisonChart } from '../Charts/YearComparisonChart';
import { ForecastChart } from '../Charts/ForecastChart';
import { StatusDashboard } from './StatusDashboard';
import { ComparisonView } from './ComparisonView';
import { OkonomiPanel } from './OkonomiPanel';
import { TjenesterPanel } from './TjenesterPanel';
import { NaeringsPanel } from './NaeringsPanel';
import { FramskrivingPanel } from './FramskrivingPanel';
import { UtdanningPanel } from './UtdanningPanel';
import { PendlingPanel } from './PendlingPanel';

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

  const isChartsActive      = sidebarTab === 'charts';
  const isDashActive        = sidebarTab === 'dashboard';
  const isOkonomiActive     = sidebarTab === 'okonomi';
  const isTjenesterActive   = sidebarTab === 'tjenester';
  const isNaeringActive     = sidebarTab === 'naering';
  const isFramskrivingActive = sidebarTab === 'framskriving';
  const isUtdanningActive   = sidebarTab === 'utdanning';
  const isPendlingActive    = sidebarTab === 'pendling';

  return (
    <aside className="flex flex-col bg-white border-l border-gray-200 shadow-xl overflow-hidden h-full">
      {/* Accent stripe */}
      <div className="h-1 bg-gradient-to-r from-blue-600 to-blue-400 flex-shrink-0" />

      {/* Kontekstheader */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="min-w-0">
          {selectedArea ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Bamble</span>
              <span className="text-gray-300">›</span>
              <span className="font-semibold text-gray-800 truncate">{selectedArea.grunnkretsnavn}</span>
            </div>
          ) : (
            <p className="text-xs font-semibold text-gray-700">Bamble kommune</p>
          )}
        </div>
        {selectedArea && (
          <button
            type="button"
            aria-label="Lukk grunnkrets"
            onClick={() => {
              setSelectedArea(null);
              if (compareMode) {
                compareArea ? setCompareArea(null) : toggleCompareMode();
              }
            }}
            className="ml-2 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Tab bar — to rader */}
      <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex border-b border-gray-100">
          {(
            [
              { id: 'dashboard',    label: 'Bamble',      guard: false },
              { id: 'charts',       label: 'Grunnkrets',  guard: true  },
              { id: 'okonomi',      label: 'Økonomi',     guard: false },
              { id: 'tjenester',    label: 'Tjenester',   guard: false },
            ] as const
          ).map(({ id, label, guard }) => {
            const active = sidebarTab === id;
            const disabled = guard && !selectedArea;
            return (
              <button
                key={id}
                onClick={() => { if (!disabled) setSidebarTab(id as never); }}
                disabled={disabled}
                title={disabled ? 'Velg en grunnkrets i kartet for å se denne visningen' : undefined}
                className={`flex-1 py-2 text-xs font-semibold tracking-wide transition-colors ${
                  active
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-white'
                    : disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex">
          {(
            [
              { id: 'naering',      label: 'Næring'      },
              { id: 'framskriving', label: 'Framskriving' },
              { id: 'utdanning',    label: 'Utdanning'   },
              { id: 'pendling',     label: 'Pendling'    },
            ] as const
          ).map(({ id, label }) => {
            const active = sidebarTab === id;
            return (
              <button
                key={id}
                onClick={() => setSidebarTab(id as never)}
                className={`flex-1 py-2 text-xs font-semibold tracking-wide transition-colors ${
                  active
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isPendlingActive ? (
          <PendlingPanel />
        ) : isUtdanningActive ? (
          <UtdanningPanel />
        ) : isFramskrivingActive ? (
          <FramskrivingPanel />
        ) : isNaeringActive ? (
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
              {/* Compare button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (compareMode) {
                      compareArea ? setCompareArea(null) : toggleCompareMode();
                    } else {
                      toggleCompareMode();
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    compareMode
                      ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {compareMode ? 'Avbryt sammenligning' : '⊕ Sammenlign'}
                </button>
              </div>

              {/* Compare mode banner when no compareArea yet */}
              {compareMode && !compareArea && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-sm text-blue-700 flex items-center gap-2">
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
                    <KpiCard
                      label={`Innbyggere ${activeYear}`}
                      value={p.totalBefolkning.toLocaleString('nb-NO')}
                      accentColor="border-blue-400"
                    />
                    <KpiCard
                      label={`Endring ${BASE_YEAR}–${activeYear}`}
                      value={p.endring != null ? `${p.endring > 0 ? '+' : ''}${p.endring}` : '—'}
                      valueColor={p.endring != null ? (p.endring > 0 ? 'text-green-600' : p.endring < 0 ? 'text-red-600' : 'text-gray-700') : 'text-gray-400'}
                      trend={p.endring == null ? undefined : p.endring > 0 ? 'up' : p.endring < 0 ? 'down' : 'neutral'}
                      subLabel="personer"
                      accentColor={p.endring == null ? 'border-gray-300' : p.endring >= 0 ? 'border-green-400' : 'border-red-400'}
                    />
                    <KpiCard
                      label="Andel eldre (60+)"
                      value={`${(p.andelEldre * 100).toFixed(1)}%`}
                      subLabel={`${p.antallEldre} pers.`}
                      accentColor="border-orange-400"
                    />
                    <KpiCard
                      label="Andel unge (0–19)"
                      value={`${(p.andelYngre * 100).toFixed(1)}%`}
                      subLabel={`${p.antallYngre} pers.`}
                      accentColor="border-emerald-400"
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

