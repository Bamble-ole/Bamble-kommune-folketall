import { useMapStore } from '../../store/mapStore';
import { useYearPlayer } from '../../hooks/useYearPlayer';

export function YearSlider() {
  const { activeYear, availableYears, setActiveYear } = useMapStore();
  const min = Math.min(...availableYears);
  const max = Math.max(...availableYears);

  const { playing, toggle } = useYearPlayer({ years: availableYears, activeYear, setActiveYear });

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            title={playing ? 'Stopp' : 'Spill av år for år'}
            className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
              playing
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {playing ? (
              /* Pause icon */
              <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                <rect x="3" y="2" width="3" height="12" rx="1" />
                <rect x="10" y="2" width="3" height="12" rx="1" />
              </svg>
            ) : (
              /* Play icon */
              <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
              </svg>
            )}
          </button>
          <p className="text-xs font-semibold text-gray-600">Årstall</p>
        </div>
        <span className={`text-sm font-bold ${playing ? 'text-blue-600 animate-pulse' : 'text-blue-700'}`}>
          {activeYear}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={activeYear}
        onChange={e => {
          const year = Number(e.target.value);
          if (availableYears.includes(year)) setActiveYear(year);
        }}
        list="year-ticks"
        className="w-full accent-blue-600"
      />
      <datalist id="year-ticks">
        {availableYears.map(y => <option key={y} value={y} />)}
      </datalist>
      <div className="flex justify-between text-xs text-gray-500 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
