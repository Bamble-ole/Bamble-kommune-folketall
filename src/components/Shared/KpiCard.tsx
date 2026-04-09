import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  subLabel?: string;
  subLabelColor?: 'default' | 'success' | 'danger';
  accentColor?: string;      // Tailwind border-color class, e.g. 'border-blue-400'
  valueColor?: string;       // Tailwind text-color class, e.g. 'text-green-600'
  trend?: 'up' | 'down' | 'neutral';
  sparkline?: ReactNode;     // slot for SparklineChart
}

const SUB_COLORS = {
  default: 'text-gray-400',
  success: 'text-green-600',
  danger:  'text-red-500',
};

export function KpiCard({
  label,
  value,
  subLabel,
  subLabelColor = 'default',
  accentColor,
  valueColor = 'text-gray-800',
  trend,
  sparkline,
}: KpiCardProps) {
  return (
    <div className={`bg-gray-50 rounded-lg p-3 ${accentColor ? `border-l-4 ${accentColor}` : ''}`}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <div className="flex items-end justify-between gap-1">
        <div className="min-w-0">
          <p className={`text-2xl font-bold leading-tight ${valueColor}`}>
            {trend === 'up'   && <span className="text-green-500 text-lg mr-0.5">↑</span>}
            {trend === 'down' && <span className="text-red-500 text-lg mr-0.5">↓</span>}
            {value}
          </p>
          {subLabel && (
            <p className={`text-xs mt-0.5 ${SUB_COLORS[subLabelColor]}`}>{subLabel}</p>
          )}
        </div>
        {sparkline && (
          <div className="flex-shrink-0">{sparkline}</div>
        )}
      </div>
    </div>
  );
}
