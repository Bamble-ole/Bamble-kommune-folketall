import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-gray-50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-100 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M8 10.94 1.53 4.47l1.06-1.06L8 8.81l5.41-5.4 1.06 1.06z" />
        </svg>
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}
