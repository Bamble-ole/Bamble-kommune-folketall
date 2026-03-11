export const AGE_GROUPS = [
  '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
  '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74',
  '75-79', '80-84', '85-89', '90+'
] as const;

export type AgeGroupKey = typeof AGE_GROUPS[number];

export const VISUAL_MODES = [
  'befolkning', 'eldre', 'yngre', 'endring',
  ...AGE_GROUPS
] as const;

export type VisualMode = typeof VISUAL_MODES[number];

export interface AgeGroups {
  '0-4': number;
  '5-9': number;
  '10-14': number;
  '15-19': number;
  '20-24': number;
  '25-29': number;
  '30-34': number;
  '35-39': number;
  '40-44': number;
  '45-49': number;
  '50-54': number;
  '55-59': number;
  '60-64': number;
  '65-69': number;
  '70-74': number;
  '75-79': number;
  '80-84': number;
  '85-89': number;
  '90+': number;
}

/** Properties stored in each GeoJSON feature (normalized at load time) */
export interface GrunnkretsProperties {
  grunnkretsnavn: string;
  grunnkretsId: string;
  totalBefolkning: number;
  ageGroups: AgeGroups;
  // Pre-computed derived values (added at load time)
  andelEldre: number;
  andelYngre: number;
  antallEldre: number;
  antallYngre: number;
  endring: number | null;
  // Flat ag_ properties stored on GeoJSON feature for MapLibre expressions
  [key: `ag_${string}`]: number;
}

export interface GrunnkretsFeature {
  type: 'Feature';
  properties: GrunnkretsProperties;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface GrunnkretsFeatureCollection {
  type: 'FeatureCollection';
  features: GrunnkretsFeature[];
}

export interface PopulationEntry {
  grunnkretsId: string;
  grunnkretsnavn: string;
  totalBefolkning: number;
  ageGroups: AgeGroups;
}

export interface SchoolFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number, number?] };
  properties: {
    skolenavn: string;
    antallElever: number;
    antallAnsatte: number;
    trinn_Trinn_lavesteTrinn: number;
    trinn_Trinn_høyesteTrinn: number;
    besøksadresse_Besøksadresse_adressenavn: string;
    besøksadresse_Besøksadresse_postnummer: string;
    besøksadresse_Besøksadresse_poststed: string;
    [key: string]: unknown;
  };
}

export interface KindergartenFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number, number?] };
  properties: {
    barnehagenavn: string;
    antallBarn: number;
    antallAnsatte: number;
    åpningstidFra: string;
    åpningstidTil: string;
    adressenavn: string;
    postnummer: number;
    poststed: string;
    høyesteAlder: number;
    lavesteAlder: number;
    eierforhold: string;
    [key: string]: unknown;
  };
}

export interface SelectedArea {
  grunnkretsnavn: string;
  grunnkretsId: string;
  properties: GrunnkretsProperties;
}

/** School capacity analysis result */
export interface SchoolCatchmentAnalysis {
  school: SchoolFeature;
  catchmentAreas: GrunnkretsProperties[];
  childrenInArea: number;
  currentStudents: number;
  utilizationRatio: number;
}
