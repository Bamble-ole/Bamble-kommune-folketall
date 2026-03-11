import { useMapStore } from '../../store/mapStore';

export function YearSlider() {
  const { activeYear, availableYears, setActiveYear } = useMapStore();
  const min = Math.min(...availableYears);
  const max = Math.max(...availableYears);

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-semibold text-gray-600">Årstall</p>
        <span className="text-sm font-bold text-blue-700">{activeYear}</span>
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
