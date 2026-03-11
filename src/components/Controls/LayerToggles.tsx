import { useMapStore } from '../../store/mapStore';

export function LayerToggles() {
  const {
    showSchools, showKindergartens, showAreaNames,
    toggleSchools, toggleKindergartens, toggleAreaNames,
  } = useMapStore();

  const rows = [
    { label: 'Skoler', checked: showSchools, toggle: toggleSchools },
    { label: 'Barnehager', checked: showKindergartens, toggle: toggleKindergartens },
    { label: 'Grunnkretsnavn', checked: showAreaNames, toggle: toggleAreaNames },
  ];

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2">Kartlag</p>
      <ul className="space-y-1.5">
        {rows.map(({ label, checked, toggle }) => (
          <li key={label}>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={toggle}
                className="rounded accent-blue-600"
              />
              {label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
