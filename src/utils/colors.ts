import type { ExpressionSpecification } from 'maplibre-gl';
import type { VisualMode } from '../types';
import { ageGroupKey } from './dataUtils';

export interface LegendEntry {
  color: string;
  label: string;
}

function steps(prop: string, stops: [number, string][], defaultColor: string): ExpressionSpecification {
  const expr: ExpressionSpecification = ['step', ['get', prop], defaultColor];
  for (const [val, color] of stops) {
    (expr as unknown[]).push(val, color);
  }
  return expr;
}

export function getColorExpression(mode: VisualMode): ExpressionSpecification {
  switch (mode) {
    case 'befolkning':
      return steps('totalBefolkning', [
        [100, '#d9ef8b'],
        [250, '#fee08b'],
        [500, '#fc8d59'],
        [1000, '#d73027'],
      ], '#1a9850');

    case 'eldre':
      return [
        'case',
        ['>', ['*', ['get', 'andelEldre'], 100], 40], '#d73027',
        ['>', ['*', ['get', 'andelEldre'], 100], 25], '#fc8d59',
        ['>', ['*', ['get', 'andelEldre'], 100], 10], '#91cf60',
        '#4575b4',
      ];

    case 'yngre':
      return [
        'case',
        ['>', ['*', ['get', 'andelYngre'], 100], 40], '#d73027',
        ['>', ['*', ['get', 'andelYngre'], 100], 30], '#fc8d59',
        ['>', ['*', ['get', 'andelYngre'], 100], 20], '#91cf60',
        '#4575b4',
      ];

    case 'endring':
      return [
        'case',
        ['==', ['get', 'endring'], null], '#cccccc',
        ['>', ['get', 'endring'], 0], '#1a9850',
        '#d73027',
      ];

    default: {
      // Individual age group
      const prop = ageGroupKey(mode);
      return steps(prop, [
        [10, '#d9ef8b'],
        [20, '#fee08b'],
        [50, '#fc8d59'],
        [100, '#d73027'],
      ], '#1a9850');
    }
  }
}

export function getLegendEntries(mode: VisualMode): LegendEntry[] {
  switch (mode) {
    case 'befolkning':
      return [
        { color: '#1a9850', label: '0–100 innbyggere' },
        { color: '#d9ef8b', label: '100–250' },
        { color: '#fee08b', label: '250–500' },
        { color: '#fc8d59', label: '500–1000' },
        { color: '#d73027', label: '1000+' },
      ];

    case 'eldre':
      return [
        { color: '#4575b4', label: 'Under 10 % eldre (60+)' },
        { color: '#91cf60', label: '10–25 %' },
        { color: '#fc8d59', label: '25–40 %' },
        { color: '#d73027', label: 'Over 40 %' },
      ];

    case 'yngre':
      return [
        { color: '#4575b4', label: 'Under 20 % unge (0–19)' },
        { color: '#91cf60', label: '20–30 %' },
        { color: '#fc8d59', label: '30–40 %' },
        { color: '#d73027', label: 'Over 40 %' },
      ];

    case 'endring':
      return [
        { color: '#1a9850', label: 'Befolkningsvekst' },
        { color: '#d73027', label: 'Befolkningsnedgang' },
        { color: '#cccccc', label: 'Ingen 2017-data' },
      ];

    default:
      return [
        { color: '#1a9850', label: '0–10 personer' },
        { color: '#d9ef8b', label: '10–20' },
        { color: '#fee08b', label: '20–50' },
        { color: '#fc8d59', label: '50–100' },
        { color: '#d73027', label: '100+' },
      ];
  }
}

export function getModeName(mode: VisualMode): string {
  const names: Record<string, string> = {
    befolkning: 'Total befolkning',
    eldre: 'Andel eldre (60+)',
    yngre: 'Andel unge (0–19)',
    endring: 'Befolkningsendring',
    '0-4': '0–4 år', '5-9': '5–9 år', '10-14': '10–14 år', '15-19': '15–19 år',
    '20-24': '20–24 år', '25-29': '25–29 år', '30-34': '30–34 år', '35-39': '35–39 år',
    '40-44': '40–44 år', '45-49': '45–49 år', '50-54': '50–54 år', '55-59': '55–59 år',
    '60-64': '60–64 år', '65-69': '65–69 år', '70-74': '70–74 år', '75-79': '75–79 år',
    '80-84': '80–84 år', '85-89': '85–89 år', '90+': '90+ år',
  };
  return names[mode] ?? mode;
}
