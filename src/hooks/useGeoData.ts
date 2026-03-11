import { useEffect } from 'react';
import { useMapStore, ALL_YEARS, BASE_YEAR, LATEST_YEAR } from '../store/mapStore';
import { buildYearGeoData } from '../utils/dataUtils';
import type {
  GrunnkretsFeatureCollection,
  PopulationEntry,
  SchoolFeature,
  KindergartenFeature,
} from '../types';

/** Format fra population-YYYY.json (hentes av fetch-data.mjs) */
interface RawPopulationEntry {
  grunnkretsId?:           string;
  grunnkretsnavn:          string;
  totalBefolkning:         number;
  befolkningAldersgrupper: Record<string, number>;
}

/** Konverter rå JSON → PopulationEntry med ageGroups */
function mapRawPop(raw: RawPopulationEntry[]): PopulationEntry[] {
  return raw.map(e => ({
    grunnkretsId:   e.grunnkretsId ?? '',
    grunnkretsnavn: e.grunnkretsnavn,
    totalBefolkning: e.totalBefolkning,
    ageGroups: {
      '0-4':   e.befolkningAldersgrupper['0-4']   ?? 0,
      '5-9':   e.befolkningAldersgrupper['5-9']   ?? 0,
      '10-14': e.befolkningAldersgrupper['10-14'] ?? 0,
      '15-19': e.befolkningAldersgrupper['15-19'] ?? 0,
      '20-24': e.befolkningAldersgrupper['20-24'] ?? 0,
      '25-29': e.befolkningAldersgrupper['25-29'] ?? 0,
      '30-34': e.befolkningAldersgrupper['30-34'] ?? 0,
      '35-39': e.befolkningAldersgrupper['35-39'] ?? 0,
      '40-44': e.befolkningAldersgrupper['40-44'] ?? 0,
      '45-49': e.befolkningAldersgrupper['45-49'] ?? 0,
      '50-54': e.befolkningAldersgrupper['50-54'] ?? 0,
      '55-59': e.befolkningAldersgrupper['55-59'] ?? 0,
      '60-64': e.befolkningAldersgrupper['60-64'] ?? 0,
      '65-69': e.befolkningAldersgrupper['65-69'] ?? 0,
      '70-74': e.befolkningAldersgrupper['70-74'] ?? 0,
      '75-79': e.befolkningAldersgrupper['75-79'] ?? 0,
      '80-84': e.befolkningAldersgrupper['80-84'] ?? 0,
      '85-89': e.befolkningAldersgrupper['85-89'] ?? 0,
      '90+':   e.befolkningAldersgrupper['90+']   ?? 0,
    },
  }));
}

export function useGeoData() {
  const { setAllYearData, setSchools, setKindergartens, setCatchmentAnalysis } = useMapStore();

  useEffect(() => {
    async function load() {
      // ── Last alle ressurser parallelt ──────────────────────────────────────
      const [rawGeo, rawSkoler, rawBarnehager, ...rawPops] = await Promise.all([
        fetch('/data/grunnkretser.geojson').then(r => r.json()) as Promise<GrunnkretsFeatureCollection>,
        fetch('/data/skoler.geojson').then(r => r.json()),
        fetch('/data/barnehager.geojson').then(r => r.json()),
        // population-YYYY.json for hvert år – 404 er OK (år uten data hoppes over)
        ...ALL_YEARS.map(year =>
          fetch(`/data/population-${year}.json`)
            .then(r => r.ok ? r.json() as Promise<RawPopulationEntry[]> : Promise.resolve(null))
            .catch(() => null)
        ),
      ]);

      const schools:      SchoolFeature[]      = rawSkoler.features;
      const kindergartens: KindergartenFeature[] = rawBarnehager.features;

      // ── Bygg PopulationEntry per år ────────────────────────────────────────
      const popByYear = new Map<number, PopulationEntry[]>();
      ALL_YEARS.forEach((year, i) => {
        if (rawPops[i]) popByYear.set(year, mapRawPop(rawPops[i]!));
      });

      const basePop = popByYear.get(BASE_YEAR) ?? null;

      // ── Bygg GeoData for hvert år ──────────────────────────────────────────
      // Alle år bruker buildYearGeoData: geometri hentes fra grunnkretser.geojson,
      // befolkningsdata hentes fra population-YYYY.json (inkl. nyeste år fra SSB).
      const allYearData: Record<number, GrunnkretsFeatureCollection> = {};

      for (const year of ALL_YEARS) {
        const pop = popByYear.get(year);
        if (!pop) continue; // hopp over år uten populasjonsfil

        allYearData[year] = buildYearGeoData(rawGeo, pop, basePop);
      }

      // ── Last skolenedslagsfelt (lazy import for å ikke bremse init) ────────
      const { computeSchoolCatchments } = await import('../utils/dataUtils');
      const latestGeo = allYearData[LATEST_YEAR];
      if (latestGeo) {
        const catchments = computeSchoolCatchments(schools, latestGeo);
        setCatchmentAnalysis(catchments);
      }

      setAllYearData(allYearData);
      setSchools(schools);
      setKindergartens(kindergartens);
    }

    load().catch(console.error);
  }, [setAllYearData, setSchools, setKindergartens, setCatchmentAnalysis]);
}
