import type {
  GrunnkretsFeatureCollection,
  GrunnkretsFeature,
  GrunnkretsProperties,
  PopulationEntry,
  AgeGroups,
  SchoolFeature,
  SchoolCatchmentAnalysis,
} from '../types';

const AGE_GROUP_FIELD_MAP: Record<keyof AgeGroups, string> = {
  '0-4':   'befolkning0Til04År',
  '5-9':   'befolkning05Til09År',
  '10-14': 'befolkning10Til14År',
  '15-19': 'befolkning15Til19År',
  '20-24': 'befolkning20Til24År',
  '25-29': 'befolkning25Til29År',
  '30-34': 'befolkning30Til34År',
  '35-39': 'befolkning35Til39År',
  '40-44': 'befolkning40Til44År',
  '45-49': 'befolkning45Til49År',
  '50-54': 'befolkning50Til54År',
  '55-59': 'befolkning55Til59År',
  '60-64': 'befolkning60Til64År',
  '65-69': 'befolkning65Til69År',
  '70-74': 'befolkning70Til74År',
  '75-79': 'befolkning75Til79År',
  '80-84': 'befolkning80Til84År',
  '85-89': 'befolkning85Til89År',
  '90+':   'befolkning90ÅrOgOver',
};

export function ageGroupKey(group: string): string {
  return 'ag_' + group.replace(/[^0-9]/g, '_').replace(/_+$/, '');
}

function extractAgeGroups(raw: Record<string, unknown>): AgeGroups {
  const groups = {} as AgeGroups;
  for (const [key, field] of Object.entries(AGE_GROUP_FIELD_MAP)) {
    groups[key as keyof AgeGroups] = (raw[field] as number) || 0;
  }
  return groups;
}

function computeEldre(ag: AgeGroups): number {
  return ag['60-64'] + ag['65-69'] + ag['70-74'] + ag['75-79'] +
         ag['80-84'] + ag['85-89'] + ag['90+'];
}

function computeYngre(ag: AgeGroups): number {
  return ag['0-4'] + ag['5-9'] + ag['10-14'] + ag['15-19'];
}

/**
 * Estimert antall barn i barneskole-alder (6–12 år).
 * SSB bruker 5-årsgrupper, så vi estimerer proporsjonalt:
 *   4/5 av «5–9»-gruppen (alder 6–9) + 3/5 av «10–14»-gruppen (alder 10–12)
 */
export function computeBarneSkoleAlder(ag: AgeGroups): number {
  return Math.round((4 / 5) * ag['5-9'] + (3 / 5) * ag['10-14']);
}

/**
 * Estimert antall barn i ungdomsskole-alder (13–15 år).
 *   2/5 av «10–14»-gruppen (alder 13–14) + 1/5 av «15–19»-gruppen (alder 15)
 */
export function computeUngdomsSkoleAlder(ag: AgeGroups): number {
  return Math.round((2 / 5) * ag['10-14'] + (1 / 5) * ag['15-19']);
}

/**
 * Normalise the raw GeoJSON from geonorge/old project into our internal format.
 * Adds pre-computed fields for MapLibre expressions.
 *
 * @param raw          Rå GeoJSON fra GeoNorge (inneholder befolkningsdata for ett år)
 * @param basePop      Befolkningsdata for base-år (brukes til endring-beregning)
 */
export function normalizeGeoJSON(
  raw: GrunnkretsFeatureCollection,
  basePop: PopulationEntry[]
): GrunnkretsFeatureCollection {
  const baseMap = new Map(basePop.map(e => [e.grunnkretsnavn, e]));

  const features: GrunnkretsFeature[] = raw.features.map(f => {
    const p = f.properties as unknown as Record<string, unknown>;
    const ageGroups = extractAgeGroups(p);
    const total: number = (p.totalBefolkning as number) || 0;
    const antallEldre = computeEldre(ageGroups);
    const antallYngre = computeYngre(ageGroups);
    const andelEldre = total > 0 ? antallEldre / total : 0;
    const andelYngre = total > 0 ? antallYngre / total : 0;

    const baseEntry = baseMap.get(p.grunnkretsnavn as string);
    const endring = baseEntry != null ? total - baseEntry.totalBefolkning : null;

    // Flat ag_ properties for MapLibre expressions
    const agFlat: Record<string, number> = {};
    for (const [key, val] of Object.entries(ageGroups)) {
      agFlat[ageGroupKey(key)] = val;
    }

    const normalized: GrunnkretsProperties = {
      grunnkretsnavn: (p.grunnkretsnavn as string) || '',
      grunnkretsId: (p.grunnkretsId as string) ||
                    (p.grunnkretsnummer as string) ||
                    (p.grunnkretsNummer as string) || '',
      totalBefolkning: total,
      ageGroups,
      andelEldre,
      andelYngre,
      antallEldre,
      antallYngre,
      endring,
      ...agFlat,
    };

    return { ...f, properties: normalized };
  });

  return { type: 'FeatureCollection', features };
}

/**
 * Bygg en GrunnkretsFeatureCollection for et gitt år ved å kombinere
 * geometri fra baseGeo med befolkningsdata fra yearPop.
 *
 * Endring beregnes mot basePop (tidligste år, typisk 2015).
 *
 * @param baseGeo   Geometri-kilde (koordinater hentes herfra)
 * @param yearPop   Befolkningsdata for dette året
 * @param basePop   Befolkningsdata for base-år (endring-beregning)
 */
export function buildYearGeoData(
  baseGeo: GrunnkretsFeatureCollection,
  yearPop: PopulationEntry[],
  basePop: PopulationEntry[] | null
): GrunnkretsFeatureCollection {
  const yearMap = new Map(yearPop.map(e => [e.grunnkretsnavn, e]));
  const baseMap = basePop ? new Map(basePop.map(e => [e.grunnkretsnavn, e])) : null;

  const features = baseGeo.features.map(f => {
    const name  = f.properties.grunnkretsnavn;
    const entry = yearMap.get(name);

    if (!entry) {
      // Ingen populasjonsdata for denne grunnkretsen dette året → nullverdier
      const agFlat: Record<string, number> = {};
      for (const key of Object.keys(f.properties.ageGroups ?? {})) {
        agFlat[ageGroupKey(key)] = 0;
      }
      return {
        ...f,
        properties: {
          ...f.properties,
          totalBefolkning: 0,
          antallEldre: 0,
          antallYngre: 0,
          andelEldre: 0,
          andelYngre: 0,
          endring: null,
          ...agFlat,
        } as GrunnkretsProperties,
      };
    }

    const ag    = entry.ageGroups;
    const total = entry.totalBefolkning;
    const antallEldre = computeEldre(ag);
    const antallYngre = computeYngre(ag);

    const baseEntry = baseMap?.get(name);
    const endring   = baseEntry != null ? total - baseEntry.totalBefolkning : null;

    const agFlat: Record<string, number> = {};
    for (const [key, val] of Object.entries(ag)) {
      agFlat[ageGroupKey(key)] = val;
    }

    const props: GrunnkretsProperties = {
      grunnkretsnavn: name,
      grunnkretsId:   entry.grunnkretsId || f.properties.grunnkretsId,
      totalBefolkning: total,
      ageGroups: ag,
      antallEldre,
      antallYngre,
      andelEldre: total > 0 ? antallEldre / total : 0,
      andelYngre: total > 0 ? antallYngre / total : 0,
      endring,
      ...agFlat,
    };

    return { ...f, properties: props };
  });

  return { type: 'FeatureCollection', features };
}

/**
 * Re-apply 2017 population values to the normalized GeoJSON
 * (for year-slider switching to 2017 view).
 */
export function applyYearData(
  base: GrunnkretsFeatureCollection,
  population: PopulationEntry[]
): GrunnkretsFeatureCollection {
  const map = new Map(population.map(e => [e.grunnkretsnavn, e]));

  const features = base.features.map(f => {
    const entry = map.get(f.properties.grunnkretsnavn);
    if (!entry) return f;

    const ag = entry.ageGroups;
    const total = entry.totalBefolkning;
    const antallEldre = computeEldre(ag);
    const antallYngre = computeYngre(ag);
    const agFlat: Record<string, number> = {};
    for (const [key, val] of Object.entries(ag)) {
      agFlat[ageGroupKey(key)] = val;
    }

    const updated: GrunnkretsProperties = {
      ...f.properties,
      totalBefolkning: total,
      ageGroups: ag,
      antallEldre,
      antallYngre,
      andelEldre: total > 0 ? antallEldre / total : 0,
      andelYngre: total > 0 ? antallYngre / total : 0,
      endring: null,
      ...agFlat,
    };

    return { ...f, properties: updated };
  });

  return { type: 'FeatureCollection', features };
}

/** Haversine distance in km */
function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compute centroid of a polygon ring */
function polygonCentroid(coords: number[][]): [number, number] {
  const lon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lon, lat];
}

function featureCentroid(f: GrunnkretsFeature): [number, number] {
  const geo = f.geometry;
  if (geo.type === 'Polygon') {
    return polygonCentroid(geo.coordinates[0] as number[][]);
  }
  // MultiPolygon: use first ring of largest polygon
  const rings = (geo.coordinates as number[][][][]).map(p => p[0]);
  const largest = rings.reduce((a, b) => (a.length > b.length ? a : b));
  return polygonCentroid(largest);
}

/** True for barneskole or 1–10 skole; false for ren ungdomsskole */
function isBarneSkole(school: SchoolFeature): boolean {
  return school.properties.trinn_Trinn_lavesteTrinn <= 1;
}

/**
 * Compute school catchment analysis.
 *
 * Barneskoler (lavesteTrinn = 1): nearest-school assignment.
 *   Barn telles: estimert 6–12 år = 4/5 × «5–9» + 3/5 × «10–14»
 *
 * Ungdomsskoler (lavesteTrinn ≥ 8): hele kommunen som nedslagsfelt.
 *   Barn telles: estimert 13–15 år = 2/5 × «10–14» + 1/5 × «15–19»
 */
export function computeSchoolCatchments(
  schools: SchoolFeature[],
  grunnkretser: GrunnkretsFeatureCollection
): SchoolCatchmentAnalysis[] {
  const barneskoler = schools.filter(isBarneSkole);
  const ungdomsskoler = schools.filter(s => !isBarneSkole(s));

  // ── Nearest-school for barneskoler ─────────────────────────────────────────
  const catchmentMap = new Map<number, GrunnkretsProperties[]>(
    barneskoler.map((_, i) => [i, []])
  );

  for (const f of grunnkretser.features) {
    const [fLon, fLat] = featureCentroid(f);
    let nearestIdx = 0;
    let nearestDist = Infinity;

    barneskoler.forEach((school, i) => {
      const [sLon, sLat] = school.geometry.coordinates;
      const dist = haversine(fLon, fLat, sLon, sLat);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    });

    catchmentMap.get(nearestIdx)!.push(f.properties);
  }

  const barneResults: SchoolCatchmentAnalysis[] = barneskoler.map((school, i) => {
    const areas = catchmentMap.get(i)!;
    // Barn 6–12 år (estimert fra SSB 5-årsgrupper)
    const childrenInArea = areas.reduce(
      (s, p) => s + computeBarneSkoleAlder(p.ageGroups), 0
    );
    const currentStudents = school.properties.antallElever || 0;
    const utilizationRatio = childrenInArea > 0 ? currentStudents / childrenInArea : 0;
    return { school, catchmentAreas: areas, childrenInArea, currentStudents, utilizationRatio };
  });

  // ── Ungdomsskoler: hele kommunen, barn 13–15 år (estimert) ────────────────
  const totalUngdomsAlder = grunnkretser.features.reduce(
    (s, f) => s + computeUngdomsSkoleAlder(f.properties.ageGroups), 0
  );

  const ungdomsResults: SchoolCatchmentAnalysis[] = ungdomsskoler.map(school => {
    const currentStudents = school.properties.antallElever || 0;
    const utilizationRatio = totalUngdomsAlder > 0 ? currentStudents / totalUngdomsAlder : 0;
    return {
      school,
      catchmentAreas: grunnkretser.features.map(f => f.properties),
      childrenInArea: totalUngdomsAlder,
      currentStudents,
      utilizationRatio,
    };
  });

  return [...barneResults, ...ungdomsResults];
}
