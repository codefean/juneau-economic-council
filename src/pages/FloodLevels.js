import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

// Local styles and components
import './FloodLevels.css';
import FloodStageMenu from './FloodStageMenu';        // Accordion for flood level impacts
import FloodStepper from './FloodStepper';            // Stepper for selecting flood height
import FloodInfoPopup from "./FloodInfoPopup";        // Info popup for map disclaimers
import { getFloodStage } from './utils/floodStages';  // Util function for stage descriptions
import Search from './Search.js';                     // Address search bar
import Loc from './loc';
import './loc.css';

// Custom color palette for each flood level (64–76)
const customColors = [
  "#87c210", "#c3b91e", "#e68a1e", "#31a354", "#3182bd", "#124187",
  "#d63b3b", "#9b3dbd", "#d13c8f", "#c2185b", "#756bb1", "#f59380", "#ba4976",
];

// Helper: run a function once the map's **style** is ready
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
  const mapContainerRef = useRef(null);   // DOM reference for Mapbox container
  const mapRef = useRef(null);            // Stores the map instance

  // UI state
  const [selectedFloodLevel, setSelectedFloodLevel] = useState(9);      // Default is 9 ft
  const [menuOpen, setMenuOpen] = useState(() => window.innerWidth >= 800); // Show menu on desktop
  const [hescoMode, setHescoMode] = useState(false);                    // HESCO toggle
  const [errorMessage] = useState('');                                  // Placeholder for errors
  const [waterLevels, setWaterLevels] = useState([]);                   // Live USGS level
  const [loadingLayers, setLoadingLayers] = useState(false);            // For loading overlay
  const popupRef = useRef(null);
  const hoverHandlersRef = useRef({ move: null, out: null, layerId: null });
  const [mapReady, setMapReady] = useState(false);
  const toggleMenu = () => setMenuOpen((prev) => !prev);

  // Track current active flood layer id for hover binding
  const activeLayerIdRef = useRef(null);

  /**
   * Map of flood level tilesets (base vs HESCO)
   */
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

  /**
   * Enables hover tooltips on flood layers to show water depth (layer-scoped events)
   */
  const setupHoverPopup = useCallback((activeLayerId) => {
    const map = mapRef.current;
    if (!map || !activeLayerId) return;

    runWhenStyleReady(map, () => {
      // Remove prior handlers if bound to a previous layer
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

  /**
   * Loads Mapbox vector tiles for all flood levels for the given mode
   */
  const updateFloodLayers = useCallback((mode) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return; // guard: style must be ready

    setLoadingLayers(true);

    const validLevels = Array.from({ length: 13 }, (_, i) => 64 + i); // 64–76
    const targetFloodId = `flood${64 + (selectedFloodLevel - 8)}`;
    const targetLayerId = `${targetFloodId}-fill`;

    // Remove old layers & sources first
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
        // HESCO only exists for 70–74
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

  /** Safe wrapper to rebuild layers when style is ready */
  const safeUpdateFloodLayers = useCallback((mode) => {
    const map = mapRef.current;
    if (!map) return;
    runWhenStyleReady(map, () => updateFloodLayers(mode));
  }, [updateFloodLayers]);

  /**
   * HESCO Mode Toggle Handler
   */
  const toggleHescoMode = () => {
    setHescoMode((prev) => !prev);
  };

  /**
   * Mapbox Initialization (once)
   */
  useEffect(() => {
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN ?? 'pk.eyJ1IjoibWFwZmVhbiIsImEiOiJjbTNuOGVvN3cxMGxsMmpzNThzc2s3cTJzIn0.1uhX17BCYd65SeQsW1yibA';
    if (mapRef.current) return; // only init once

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-134.572823, 58.397411],
      zoom: 11,
    });

    mapRef.current = map;

    map.on('load', () => {
      // DEM/terrain once on load
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.0 });

      // Initial flood layers
      safeUpdateFloodLayers(hescoMode);

      // USGS gage markers
      const markerCoordinates = [
        {
          lat: 58.4293972,
          lng: -134.5745592,
          popupContent: `
              <a href="https://waterdata.usgs.gov/monitoring-location/15052500/" target="_blank">
                <b>USGS Mendenhall Lake Level Gage</b>
              </a>`,
        },
        {
          lat: 58.4595556,
          lng: -134.5038333,
          popupContent: `
              <a href="https://waterdata.usgs.gov/monitoring-location/1505248590/" target="_blank">
                <b>USGS Suicide Basin Level Gage</b>
              </a>`,
        },
      ];

      markerCoordinates.forEach((coord) => {
        const markerEl = document.createElement('div');
        markerEl.className = 'usgs-marker';

        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([coord.lng, coord.lat])
          .addTo(map);

        if (coord.popupContent) {
          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(coord.popupContent);
          marker.setPopup(popup);
        }
      });

      setMapReady(true);
    });

    return () => {
      // cleanup hover handlers
      if (hoverHandlersRef.current.layerId) {
        const { layerId, move, out } = hoverHandlersRef.current;
        if (move) map.off('mousemove', layerId, move);
        if (out) map.off('mouseleave', layerId, out);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [hescoMode, safeUpdateFloodLayers]);

  // Rebuild layers when HESCO mode changes (style-safe)
  useEffect(() => {
    if (!mapReady) return;
    safeUpdateFloodLayers(hescoMode);
  }, [mapReady, hescoMode, safeUpdateFloodLayers]);

  // Reset HESCO if out of range level is selected
  useEffect(() => {
    if (hescoMode && (selectedFloodLevel < 14 || selectedFloodLevel > 18)) {
      setHescoMode(false);
      safeUpdateFloodLayers(false);
    }
  }, [selectedFloodLevel, hescoMode, safeUpdateFloodLayers]);

  // Flip visibility when flood level changes (no rebuild)
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

  // Poll USGS API for live lake level data with cancellation
  useEffect(() => {
    let aborter = null;
    let mounted = true;

    const fetchWaterLevels = async () => {
      if (aborter) aborter.abort();
      aborter = new AbortController();

      const gages = [{ id: '15052500', name: 'Mendenhall Lake Stage Level' }];
      try {
        const fetchedLevels = await Promise.all(
          gages.map(async (gage) => {
            try {
              const response = await fetch(
                `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${gage.id}&parameterCd=00065&siteStatus=active`,
                { signal: aborter.signal }
              );
              if (!response.ok) throw new Error(`HTTP status ${response.status}`);
              const data = await response.json();
              const values = data?.value?.timeSeries?.[0]?.values?.[0]?.value;
              if (values?.length > 0) {
                const latest = values[values.length - 1];
                const v = parseFloat(latest.value);
                const alaskaTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Anchorage', timeStyle: 'short', dateStyle: 'medium' }).format(new Date(latest.dateTime));
                return { id: gage.id, name: gage.name, value: Number.isFinite(v) ? v.toFixed(2) : 'N/A', dateTime: alaskaTime, status: 'Online' };
              }
              return { id: gage.id, name: gage.name, value: 'N/A', dateTime: 'N/A', status: 'Offline' };
            } catch {
              return { id: gage.id, name: gage.name, value: 'N/A', dateTime: 'N/A', status: 'Offline' };
            }
          })
        );
        if (mounted) setWaterLevels(fetchedLevels);
      } catch (error) {
        if (mounted) console.error('Error fetching water levels:', error);
      }
    };

    fetchWaterLevels();
    const interval = setInterval(fetchWaterLevels, 60000);
    return () => {
      mounted = false;
      if (aborter) aborter.abort();
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <FloodInfoPopup />
      <div id="map" ref={mapContainerRef} style={{ height: '90vh', width: '100vw' }} />
      <button onClick={toggleMenu} className="menu-toggle-button">
        {menuOpen ? 'Hide Menu' : 'Show Menu'}
      </button>
      {mapReady && <Loc mapRef={mapRef} />}

      {/* Mobile Stepper UI */}
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

      {/* Sidebar Menu (Desktop + Tablet) */}
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
            title="HESCO maps are only available for 14ft - 18ft & assume fully functional barriers"
            onClick={() => { if (selectedFloodLevel >= 14) toggleHescoMode(); }}
            className={`hesco-toggle-button ${hescoMode ? 'hesco-on' : 'hesco-off'}`}
            disabled={loadingLayers || selectedFloodLevel < 14 || selectedFloodLevel > 18}
          >
            {loadingLayers ? 'Loading HESCO Data…' : hescoMode ? 'HESCO Barriers ON' : 'HESCO Barriers OFF (14-18ft)'}
          </button>
          <div style={{ marginTop: '20px' }}>
            {waterLevels.map((level) => {
              const currentStage = getFloodStage(level.value);

            })}
          </div>
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
