import { useGeoData } from './hooks/useGeoData';
import { useMapStore } from './store/mapStore';
import { BambleMap } from './components/Map/BambleMap';
import { MapLegend } from './components/Map/MapLegend';
import { ModeSelector } from './components/Controls/ModeSelector';
import { LayerToggles } from './components/Controls/LayerToggles';
import { YearSlider } from './components/Controls/YearSlider';
import { AreaSidebar } from './components/Sidebar/AreaSidebar';

export default function App() {
  useGeoData();

  const { dataLoaded, selectedArea, catchmentAnalysis, compareMode } = useMapStore();
  const showSidebar = selectedArea !== null || catchmentAnalysis.length > 0;

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* Loading overlay */}
      {!dataLoaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600 text-sm font-medium">Laster kartdata...</p>
          </div>
        </div>
      )}

      {/* Map area */}
      <div className="relative flex-1 min-w-0">
        <BambleMap />

        {/* Unified top-left control panel */}
        <div className="absolute top-3 left-3 z-10 map-overlay overflow-hidden" style={{ width: 228 }}>
          {/* Header */}
          <div className="h-1 bg-gradient-to-r from-blue-600 to-blue-400" />
          <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
            <h1 className="text-sm font-bold text-gray-800 leading-tight">Bamble kommune</h1>
            <p className="text-xs text-gray-400 mt-0.5">Befolkningsutvikling</p>
          </div>
          {/* Visningsmodus */}
          <div className="px-3 py-2.5 border-b border-gray-100">
            <ModeSelector />
          </div>
          {/* Årstall */}
          <div className="px-3 py-2.5 border-b border-gray-100">
            <YearSlider />
          </div>
          {/* Kartlag */}
          <div className="px-3 py-2.5">
            <LayerToggles />
          </div>
        </div>

        {/* Compare mode banner */}
        {compareMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
            <span>⊕</span>
            <span>Sammenligningsmodus — klikk på et område i kartet</span>
          </div>
        )}

        {/* Bottom-left legend */}
        <div className="absolute bottom-8 left-3 z-10">
          <MapLegend />
        </div>

        {/* Attribution */}
        <div className="absolute bottom-0 right-0 z-10 text-[10px] text-gray-500 px-2 py-0.5 bg-white/80">
          Kilde: Kartverket / Geonorge · SSB · OpenFreeMap
        </div>
      </div>

      {/* Right sidebar */}
      {showSidebar && (
        <div className="w-[360px] flex-shrink-0 h-full overflow-hidden">
          <AreaSidebar />
        </div>
      )}
    </div>
  );
}
