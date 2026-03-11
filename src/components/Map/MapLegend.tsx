import { useMapStore } from '../../store/mapStore';
import { getLegendEntries, getModeName } from '../../utils/colors';

export function MapLegend() {
  const { visualMode, activeYear } = useMapStore();
  const entries = getLegendEntries(visualMode);
  const yearLabel = ` (${activeYear})`;

  return (
    <div className="map-overlay p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-gray-700 mb-2">
        {getModeName(visualMode)}{yearLabel}
      </p>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.label} className="flex items-center gap-2 text-xs text-gray-600">
            <span
              className="inline-block w-4 h-4 rounded-sm flex-shrink-0"
              style={{ backgroundColor: e.color, opacity: 0.85 }}
            />
            {e.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
