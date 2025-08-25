import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

import './FloodLevels.css';
import FloodStageMenu from './FloodStageMenu';
import FloodStepper from './FloodStepper';
import FloodInfoPopup from "./FloodInfoPopup";
import { getFloodStage } from './utils/floodStages';
import Search from './Search.js';

// cd /Users/seanfagan/Desktop/juneau-economic-council

// ✅ Set your Mapbox token directly
mapboxgl.accessToken = 'pk.eyJ1IjoibWFwZmVhbiIsImEiOiJjbTNuOGVvN3cxMGxsMmpzNThzc2s3cTJzIn0.1uhX17BCYd65SeQsW1yibA';

const customColors = [
  "#87c210", "#c3b91e", "#e68a1e", "#31a354", "#3182bd", "#124187",
  "#d63b3b", "#9b3dbd", "#d13c8f", "#c2185b", "#756bb1", "#f59380", "#ba4976",
];

const runWhenStyleReady = (map, fn) => {
  if (!map) return;
  if (map.isStyleLoaded()) {
    fn();
  } else {
    const once = () => {
      map.off('styledata', once);
      fn();
    };
    map.on('styledata', once);
  }
};

const FloodLevels = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const [selectedFloodLevel, setSelectedFloodLevel] = useState(9);
  const [menuOpen, setMenuOpen] = useState(() => window.innerWidth >= 800);
  const [hescoMode, setHescoMode] = useState(false);
  const [errorMessage] = useState('');
  const [waterLevels, setWaterLevels] = useState([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const popupRef = useRef(null);
  const hoverHandlersRef = useRef({ move: null, out: null, layerId: null });
  const [mapReady, setMapReady] = useState(false);
  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const activeLayerIdRef = useRef(null);

  const tilesetMap = {
    base: {
      64: "ccav82q0", 65: "3z7whbfp", 66: "8kk8etzn", 67: "akq41oym",
      68: "5vsqqhd8", 69: "awu2n97c", 70: "a2ttaa7t", 71: "0rlea0ym",
      72: "44bl8opr", 73: "65em8or7", 74: "9qrkn8pk", 75: "3ktp8nyu",
      76: "avpruavl",
    },
    hesco: {
      70: "cjs05ojz", 71: "1z6funv6", 72: "9kmxxb2g", 73: "4nh8p66z", 74: "cz0f7io4",
    },
  };

  const buildVisibleLayerId = (lvl) => `flood${64 + (lvl - 8)}-fill`;

  const setupHoverPopup = useCallback((activeLayerId) => {
    const map = mapRef.current;
    if (!map || !activeLayerId) return;

    runWhenStyleReady(map, () => {
      if (hoverHandlersRef.current.layerId) {
        const oldId = hoverHandlersRef.current.layerId;
        if (hoverHandlersRef.current.move) map.off('mousemove', oldId, hoverHandlersRef.current.move);
        if (hoverHandlersRef.current.out) map.off('mouseleave', oldId, hoverHandlersRef.current.out);
        hoverHandlersRef.current.move = null;
        hoverHandlersRef.current.out = null;
        hoverHandlersRef.current.layerId = null;
      }

      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 10,
          className: 'hover-popup',
        });
      }

      const moveHandler = (e) => {
        const f = e.features && e.features[0];
        const props = (f?.properties) || {};
        const depth = props.DN ?? props.depth ?? 'Unknown';
        const formatted = Number.isFinite(+depth) ? Number(depth).toFixed(1) : depth;
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<b>Water Depth: ${formatted} ft</b>`)
          .addTo(map);
        map.getCanvas().style.cursor = 'crosshair';
      };

      const outHandler = () => {
        popupRef.current?.remove();
        map.getCanvas().style.cursor = '';
      };

      if (map.getLayer(activeLayerId)) {
        map.on('mousemove', activeLayerId, moveHandler);
        map.on('mouseleave', activeLayerId, outHandler);
        hoverHandlersRef.current.move = moveHandler;
        hoverHandlersRef.current.out = outHandler;
        hoverHandlersRef.current.layerId = activeLayerId;
        activeLayerIdRef.current = activeLayerId;
      }
    });
  }, []);

  const updateFloodLayers = useCallback((mode) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    setLoadingLayers(true);

    const validLevels = Array.from({ length: 13 }, (_, i) => 64 + i);
    const targetFloodId = `flood${64 + (selectedFloodLevel - 8)}`;
    const targetLayerId = `${targetFloodId}-fill`;

    validLevels.forEach((level) => {
      const layerId = `flood${level}-fill`;
      const sourceId = `flood${level}`;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    let loadedCount = 0;

    validLevels.forEach((level) => {
      const floodId = `flood${level}`;
      const layerId = `${floodId}-fill`;
      const visible = floodId === targetFloodId;

      const tilesetId = mode ? tilesetMap.hesco[level] : tilesetMap.base[level];
      if (mode && !tilesetId) {
        loadedCount++;
        if (loadedCount === validLevels.length) {
          setLoadingLayers(false);
          map.once('idle', () => setupHoverPopup(targetLayerId));
        }
        return;
      }

      const sourceLayerName = mode ? `flood${level}` : String(level);

      map.addSource(floodId, {
        type: 'vector',
        url: `mapbox://mapfean.${tilesetId}`,
      });

      map.addLayer({
        id: layerId,
        type: 'fill',
        source: floodId,
        'source-layer': sourceLayerName,
        layout: {
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'fill-color': customColors[level - 64],
          'fill-opacity': 0.4,
        },
      });

      loadedCount++;
      if (loadedCount === validLevels.length) {
        setLoadingLayers(false);
        map.once('idle', () => setupHoverPopup(targetLayerId));
      }
    });
  }, [selectedFloodLevel, setupHoverPopup]);

  const safeUpdateFloodLayers = useCallback((mode) => {
    const map = mapRef.current;
    if (!map) return;
    runWhenStyleReady(map, () => updateFloodLayers(mode));
  }, [updateFloodLayers]);

const toggleHescoMode = () => {
  setHescoMode((prev) => {
    const newMode = !prev;

    // Only allow HESCO mode between 14ft and 18ft
    if (newMode && (selectedFloodLevel < 14 || selectedFloodLevel > 18)) {
      // If user clicks when out of range, fallback to base maps
      safeUpdateFloodLayers(false);
      return false;
    }

    // Update flood layers based on mode
    safeUpdateFloodLayers(newMode);

    // Reattach hover popups for the new visible layer
    const visibleLayerId = `flood${64 + (selectedFloodLevel - 8)}-fill`;
    setTimeout(() => setupHoverPopup(visibleLayerId), 300);

    return newMode;
  });
};


  // ✅ INIT EFFECT — run once on mount (no remounts when state/callbacks change)
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-134.572823, 58.397411],
      zoom: 11,
    });

    mapRef.current = map;

    const handleLoad = () => {
      // Initial layer load. Later changes are handled by other effects.
      safeUpdateFloodLayers(hescoMode);
      setMapReady(true);
    };

    map.on('load', handleLoad);

    return () => {
      const { layerId, move, out } = hoverHandlersRef.current || {};
      if (layerId && move) map.off('mousemove', layerId, move);
      if (layerId && out) map.off('mouseleave', layerId, out);
      map.off('load', handleLoad);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← important

  useEffect(() => {
    if (!mapReady) return;
    safeUpdateFloodLayers(hescoMode);
  }, [mapReady, hescoMode, safeUpdateFloodLayers]);

  useEffect(() => {
    if (hescoMode && (selectedFloodLevel < 14 || selectedFloodLevel > 18)) {
      setHescoMode(false);
      safeUpdateFloodLayers(false);
    }
  }, [selectedFloodLevel, hescoMode, safeUpdateFloodLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const target = buildVisibleLayerId(selectedFloodLevel);
    const all = Array.from({ length: 13 }, (_, i) => `flood${64 + i}-fill`);

    runWhenStyleReady(map, () => {
      all.forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', id === target ? 'visible' : 'none');
        }
      });
      setupHoverPopup(target);
    });
  }, [selectedFloodLevel, mapReady, setupHoverPopup]);

  // IDs so we can reference consistently
const BIZ_SOURCE_ID = 'businesses';
const BIZ_LAYER_ID  = 'businesses-layer';

// Call once after the map is ready (e.g., right after setMapReady(true))
runWhenStyleReady(mapRef.current, () => {
  const map = mapRef.current;
  if (!map) return;

  // Add source (only once)
    if (!map.getSource(BIZ_SOURCE_ID)) {
      map.addSource(BIZ_SOURCE_ID, {
        type: 'geojson',
        // IMPORTANT: base-aware path for GitHub Pages
        data: `${process.env.PUBLIC_URL}/businesses.geojson`,
      });
    }
  // Add a simple circle layer
  if (!map.getLayer(BIZ_LAYER_ID)) {
    map.addLayer({
      id: BIZ_LAYER_ID,
      type: 'circle',
      source: BIZ_SOURCE_ID,
      paint: {
        'circle-radius': 5,
        'circle-color': '#ff6600',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  // Hover popup showing USER_Busin
  const bizPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 10,
    className: 'business-popup',
  });

  const onMove = (e) => {
    const f = e.features && e.features[0];
    const name = f?.properties?.USER_Busin || 'Unknown';
    bizPopup
      .setLngLat(e.lngLat)
      .setHTML(`<b>${name}</b>`)
      .addTo(map);
    map.getCanvas().style.cursor = 'pointer';
  };

  const onLeave = () => {
    bizPopup.remove();
    map.getCanvas().style.cursor = '';
  };

  // Bind to the layer so only business points trigger it
  map.on('mousemove', BIZ_LAYER_ID, onMove);
  map.on('mouseleave', BIZ_LAYER_ID, onLeave);

  // Optional: clean up if you ever remove the layer/source later
  // (You can also put this in your existing cleanup)
  map.once('remove', () => {
    map.off('mousemove', BIZ_LAYER_ID, onMove);
    map.off('mouseleave', BIZ_LAYER_ID, onLeave);
  });
});


  return (
    <div>
      <FloodInfoPopup />
      <div id="map" ref={mapContainerRef} style={{ height: '90vh', width: '100vw' }} />
      <button onClick={toggleMenu} className="menu-toggle-button">
        {menuOpen ? 'Hide Menu' : 'Show Menu'}
      </button>

      <div className="flood-stepper-container">
        <FloodStepper
          mapRef={mapRef}
          selectedFloodLevel={selectedFloodLevel}
          setSelectedFloodLevel={setSelectedFloodLevel}
          isMenuHidden={!menuOpen}
          hideOnDesktop={true}
          hescoMode={hescoMode}
          onFloodLayerChange={() => setupHoverPopup(buildVisibleLayerId(selectedFloodLevel))}
        />
      </div>

      {menuOpen && (
        <div id="controls" style={{ position: 'absolute', top: '160px', left: '15px', zIndex: 1 }}>
          <Search mapRef={mapRef} />
          {errorMessage && <div style={{ color: 'red', marginTop: '10px' }}>{errorMessage}</div>}
          <FloodStepper
            mapRef={mapRef}
            selectedFloodLevel={selectedFloodLevel}
            setSelectedFloodLevel={setSelectedFloodLevel}
            isMenuHidden={!menuOpen}
            hideOnDesktop={false}
            hescoMode={hescoMode}
            onFloodLayerChange={() => setupHoverPopup(buildVisibleLayerId(selectedFloodLevel))}
          />
          <button
            type="button"
            title="HESCO maps are only available for 14ft - 18ft & assume fully functional barriers"
            onClick={() => { if (selectedFloodLevel >= 14) toggleHescoMode(); }}
            className={`hesco-toggle-button ${hescoMode ? 'hesco-on' : 'hesco-off'}`}
            disabled={loadingLayers || selectedFloodLevel < 14 || selectedFloodLevel > 18}
          >
            {loadingLayers ? 'Loading HESCO Data…' : hescoMode ? 'HESCO Barriers ON' : 'HESCO Barriers OFF (14-18ft)'}
          </button>
        </div>
      )}

      {loadingLayers && (
        <div className="map-loading-overlay">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
};

export default FloodLevels;
