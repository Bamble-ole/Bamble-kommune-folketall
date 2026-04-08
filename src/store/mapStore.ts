import { create } from 'zustand';
import type {
  VisualMode,
  SelectedArea,
  GrunnkretsFeatureCollection,
  SchoolFeature,
  KindergartenFeature,
  SchoolCatchmentAnalysis,
} from '../types';

// Alle år vi støtter – oppdater her og i fetch-data.mjs ved nye år
export const ALL_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;
export const BASE_YEAR   = ALL_YEARS[0];   // brukes i "endring"-beregning
export const LATEST_YEAR = ALL_YEARS[ALL_YEARS.length - 1];

interface MapStore {
  // Data
  allYearData:      Record<number, GrunnkretsFeatureCollection>;
  geoData:          GrunnkretsFeatureCollection | null;  // aktivt år
  schools:          SchoolFeature[];
  kindergartens:    KindergartenFeature[];
  catchmentAnalysis: SchoolCatchmentAnalysis[];
  availableYears:   number[];
  dataLoaded:       boolean;

  // UI State
  selectedArea:     SelectedArea | null;
  compareArea:      SelectedArea | null;
  compareMode:      boolean;
  visualMode:       VisualMode;
  activeYear:       number;
  showSchools:      boolean;
  showKindergartens: boolean;
  showAreaNames:    boolean;
  sidebarTab:       'charts' | 'dashboard' | 'okonomi' | 'tjenester' | 'naering' | 'framskriving' | 'utdanning' | 'pendling';

  // Actions
  setAllYearData:      (data: Record<number, GrunnkretsFeatureCollection>) => void;
  setSchools:          (schools: SchoolFeature[]) => void;
  setKindergartens:    (kg: KindergartenFeature[]) => void;
  setCatchmentAnalysis:(analysis: SchoolCatchmentAnalysis[]) => void;
  setSelectedArea:     (area: SelectedArea | null) => void;
  setCompareArea:      (area: SelectedArea | null) => void;
  toggleCompareMode:   () => void;
  setVisualMode:       (mode: VisualMode) => void;
  setActiveYear:       (year: number) => void;
  toggleSchools:       () => void;
  toggleKindergartens: () => void;
  toggleAreaNames:     () => void;
  setSidebarTab:       (tab: 'charts' | 'dashboard' | 'okonomi' | 'tjenester' | 'naering' | 'framskriving' | 'utdanning' | 'pendling') => void;
}

export const useMapStore = create<MapStore>((set) => ({
  allYearData:       {},
  geoData:           null,
  schools:           [],
  kindergartens:     [],
  catchmentAnalysis: [],
  availableYears:    [...ALL_YEARS],
  dataLoaded:        false,

  selectedArea:      null,
  compareArea:       null,
  compareMode:       false,
  visualMode:        'befolkning',
  activeYear:        LATEST_YEAR,
  showSchools:       false,
  showKindergartens: false,
  showAreaNames:     true,
  sidebarTab:        'dashboard',

  setAllYearData: (allYearData) =>
    set({
      allYearData,
      geoData:    allYearData[LATEST_YEAR] ?? null,
      dataLoaded: true,
    }),

  setSchools:          (schools)          => set({ schools }),
  setKindergartens:    (kindergartens)    => set({ kindergartens }),
  setCatchmentAnalysis:(catchmentAnalysis)=> set({ catchmentAnalysis }),

  setSelectedArea: (selectedArea) =>
    set({ selectedArea, sidebarTab: selectedArea ? 'charts' : 'dashboard' }),

  setCompareArea: (compareArea) =>
    set({ compareArea, compareMode: false }),

  toggleCompareMode: () =>
    set(s => ({
      compareMode: !s.compareMode,
      compareArea: s.compareMode ? null : s.compareArea,
    })),

  setVisualMode: (visualMode) => set({ visualMode }),

  setActiveYear: (activeYear) =>
    set(state => ({
      activeYear,
      geoData: state.allYearData[activeYear] ?? state.geoData,
    })),

  toggleSchools:       () => set(s => ({ showSchools:      !s.showSchools })),
  toggleKindergartens: () => set(s => ({ showKindergartens: !s.showKindergartens })),
  toggleAreaNames:     () => set(s => ({ showAreaNames:    !s.showAreaNames })),
  setSidebarTab:       (sidebarTab) => set({ sidebarTab }),
}));
