import { useMapStore } from '../../store/mapStore';
import { type VisualMode } from '../../types';
import { getModeName } from '../../utils/colors';

const MAIN_MODES: { mode: VisualMode; label: string }[] = [
  { mode: 'befolkning', label: 'Befolkning' },
  { mode: 'eldre',      label: 'Eldre (60+)' },
  { mode: 'yngre',      label: 'Unge (0–19)' },
  { mode: 'endring',    label: 'Endring' },
];

const AGE_MODES: VisualMode[] = [
  '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
  '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74',
  '75-79', '80-84', '85-89', '90+',
];

export function ModeSelector() {
  const { visualMode, setVisualMode } = useMapStore();
  const isAgeMode = (AGE_MODES as string[]).includes(visualMode);

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">Visningsmodus</p>
      <div className="grid grid-cols-2 gap-1 mb-1.5">
        {MAIN_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => setVisualMode(mode)}
            className={`text-xs py-1.5 px-1 rounded-md font-medium transition-colors text-center leading-tight ${
              visualMode === mode
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <select
        value={isAgeMode ? visualMode : ''}
        onChange={e => { if (e.target.value) setVisualMode(e.target.value as VisualMode); }}
        className={`w-full text-xs rounded-md px-2 py-1.5 border cursor-pointer transition-colors outline-none ${
          isAgeMode
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
        }`}
      >
        <option value="">Aldersgruppe...</option>
        {AGE_MODES.map(m => (
          <option key={m} value={m}>{getModeName(m)}</option>
        ))}
      </select>
    </div>
  );
}
