import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMapStore } from '../../store/mapStore';
import { getColorExpression } from '../../utils/colors';


const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function BambleMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const initialized = useRef(false);

  const {
    geoData, visualMode, showSchools, showKindergartens, showAreaNames,
    schools, kindergartens, setSelectedArea,
  } = useMapStore();

  const setSelectedAreaRef = useRef(setSelectedArea);
  setSelectedAreaRef.current = setSelectedArea;

  useEffect(() => {
    if (!mapContainer.current || initialized.current) return;
    initialized.current = true;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [9.52, 58.97],
      zoom: 10,
      attributionControl: { compact: true },
      transformRequest: (url) => {
        if (url.startsWith('https://tiles.openfreemap.org/fonts/')) {
          return { url: url.replace('https://tiles.openfreemap.org/fonts/', 'https://fonts.openmaptiles.org/') };
        }
        return { url };
      },
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '260px',
    });

    return () => {
      map.current?.remove();
      map.current = null;
      initialized.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupInteractions = useCallback((m: maplibregl.Map) => {
    let hoveredId: string | number | null = null;

    m.on('mousemove', 'grunnkretser-fill', (e) => {
      if (!e.features?.length) return;
      m.getCanvas().style.cursor = 'pointer';
      const id = e.features[0].id;
      if (id !== undefined && id !== hoveredId) {
        if (hoveredId !== null) {
          m.setFeatureState({ source: 'grunnkretser', id: hoveredId }, { hover: false });
        }
        hoveredId = id;
        m.setFeatureState({ source: 'grunnkretser', id }, { hover: true });
      }
    });

    m.on('mouseleave', 'grunnkretser-fill', () => {
      m.getCanvas().style.cursor = '';
      if (hoveredId !== null) {
        m.setFeatureState({ source: 'grunnkretser', id: hoveredId }, { hover: false });
      }
      hoveredId = null;
    });

    m.on('click', 'grunnkretser-fill', (e) => {
      if (!e.features?.length) return;
      const clickedName = e.features[0].properties?.grunnkretsnavn as string;
      // MapLibre flattens nested objects, so look up the full feature from the store
      const store = useMapStore.getState();
      const feature = store.geoData?.features.find(
        f => f.properties.grunnkretsnavn === clickedName
      );
      if (!feature) return;
      const area = {
        grunnkretsnavn: feature.properties.grunnkretsnavn,
        grunnkretsId: feature.properties.grunnkretsId,
        properties: feature.properties,
      };
      if (store.compareMode) {
        store.setCompareArea(area);
      } else {
        setSelectedAreaRef.current(area);
      }
    });

    m.on('click', 'schools-layer', (e) => {
      if (!e.features?.length || !useMapStore.getState().showSchools) return;
      const p = e.features[0].properties as Record<string, unknown>;
      const geo = e.features[0].geometry as unknown as { coordinates: [number, number] };
      popup.current!.setLngLat(geo.coordinates).setHTML(
        `<div class="popup-title">${p.skolenavn}</div>
        <div class="popup-row"><span>Elever</span><strong>${p.antallElever}</strong></div>
        <div class="popup-row"><span>Ansatte</span><strong>${p.antallAnsatte}</strong></div>
        <div class="popup-row"><span>Trinn</span><strong>${p['trinn_Trinn_lavesteTrinn']}–${p['trinn_Trinn_høyesteTrinn']}</strong></div>
        <div class="popup-section popup-address">${p['besøksadresse_Besøksadresse_adressenavn']}, ${p['besøksadresse_Besøksadresse_postnummer']} ${p['besøksadresse_Besøksadresse_poststed']}</div>`
      ).addTo(m);
    });

    m.on('click', 'kindergartens-layer', (e) => {
      if (!e.features?.length || !useMapStore.getState().showKindergartens) return;
      const p = e.features[0].properties as Record<string, unknown>;
      const geo = e.features[0].geometry as unknown as { coordinates: [number, number] };
      popup.current!.setLngLat(geo.coordinates).setHTML(
        `<div class="popup-title">${p.barnehagenavn}</div>
        <div class="popup-row"><span>Barn</span><strong>${p.antallBarn}</strong></div>
        <div class="popup-row"><span>Ansatte</span><strong>${p.antallAnsatte}</strong></div>
        <div class="popup-row"><span>Alder</span><strong>${p.lavesteAlder}–${p['høyesteAlder']} år</strong></div>
        <div class="popup-row"><span>Åpningstid</span><strong>${p['åpningstidFra']}–${p['åpningstidTil']}</strong></div>
        <div class="popup-section popup-address">${p.adressenavn}, ${p.postnummer} ${p.poststed}</div>`
      ).addTo(m);
    });

    m.on('mouseenter', 'schools-layer', () => {
      if (useMapStore.getState().showSchools) m.getCanvas().style.cursor = 'pointer';
    });
    m.on('mouseenter', 'kindergartens-layer', () => {
      if (useMapStore.getState().showKindergartens) m.getCanvas().style.cursor = 'pointer';
    });
    ['schools-layer', 'kindergartens-layer'].forEach(layer => {
      m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = ''; });
    });
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !geoData) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawGeo = geoData as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSchools = { type: 'FeatureCollection', features: schools } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawKG = { type: 'FeatureCollection', features: kindergartens } as any;

    const addLayers = async () => {
      // ── Grunnkretser polygon layers (no images needed – add immediately) ──────
      if (m.getSource('grunnkretser')) {
        (m.getSource('grunnkretser') as GeoJSONSource).setData(rawGeo);
      } else {
        m.addSource('grunnkretser', { type: 'geojson', data: rawGeo, generateId: true });
        m.addLayer({
          id: 'grunnkretser-fill', type: 'fill', source: 'grunnkretser',
          paint: { 'fill-color': getColorExpression(visualMode), 'fill-opacity': 0.7 },
        });
        m.addLayer({
          id: 'grunnkretser-border', type: 'line', source: 'grunnkretser',
          paint: { 'line-color': '#ffffff', 'line-width': 1 },
        });
        m.addLayer({
          id: 'grunnkretser-hover', type: 'fill', source: 'grunnkretser',
          paint: {
            'fill-color': '#000000',
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.25, 0],
          },
        });
      }

      setupInteractions(m);

      // ── Symbol layers (need icons – load with MapLibre v5 Promise API) ────────
      const loadImg = async (name: string, url: string) => {
        if (m.hasImage(name)) return;
        try {
          const { data: img } = await m.loadImage(url);
          if (!m.hasImage(name)) m.addImage(name, img);
        } catch (err) {
          console.error(`Could not load map icon ${url}:`, err);
        }
      };

      await Promise.all([
        loadImg('school-icon', '/icons/school-bag.png'),
        loadImg('kg-icon', '/icons/playground.png'),
      ]);

      if (!m.getSource('schools')) {
        m.addSource('schools', { type: 'geojson', data: rawSchools });
        m.addLayer({
          id: 'schools-layer', type: 'symbol', source: 'schools',
          layout: { 'icon-image': 'school-icon', 'icon-size': 0.45, 'icon-allow-overlap': true },
          paint: { 'icon-opacity': showSchools ? 1 : 0 },
        });
      }

      if (!m.getSource('kindergartens')) {
        m.addSource('kindergartens', { type: 'geojson', data: rawKG });
        m.addLayer({
          id: 'kindergartens-layer', type: 'symbol', source: 'kindergartens',
          layout: { 'icon-image': 'kg-icon', 'icon-size': 0.45, 'icon-allow-overlap': true },
          paint: { 'icon-opacity': showKindergartens ? 1 : 0 },
        });
      }

      if (!m.getLayer('area-labels')) {
        m.addLayer({
          id: 'area-labels', type: 'symbol', source: 'grunnkretser',
          layout: {
            'text-field': ['get', 'grunnkretsnavn'],
            'text-size': 11,
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#1a1a1a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
            'text-opacity': showAreaNames ? 1 : 0,
          },
        });
      }
    };

    if (m.isStyleLoaded()) addLayers();
    else m.once('load', addLayers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData]);

  useEffect(() => {
    const m = map.current;
    if (!m?.getLayer('grunnkretser-fill')) return;
    m.setPaintProperty('grunnkretser-fill', 'fill-color', getColorExpression(visualMode));
  }, [visualMode]);

  useEffect(() => {
    if (map.current?.getLayer('schools-layer')) {
      map.current.setPaintProperty('schools-layer', 'icon-opacity', showSchools ? 1 : 0);
    }
  }, [showSchools]);

  useEffect(() => {
    if (map.current?.getLayer('kindergartens-layer')) {
      map.current.setPaintProperty('kindergartens-layer', 'icon-opacity', showKindergartens ? 1 : 0);
    }
  }, [showKindergartens]);

  useEffect(() => {
    if (map.current?.getLayer('area-labels')) {
      map.current.setPaintProperty('area-labels', 'text-opacity', showAreaNames ? 1 : 0);
    }
  }, [showAreaNames]);

  useEffect(() => {
    const m = map.current;
    if (!m?.getSource('grunnkretser') || !geoData) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m.getSource('grunnkretser') as GeoJSONSource).setData(geoData as any);
    if (m.getLayer('grunnkretser-fill')) {
      m.setPaintProperty('grunnkretser-fill', 'fill-color', getColorExpression(visualMode));
    }
  }, [geoData, visualMode]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
