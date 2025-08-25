import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Local styles and components
import './FloodLevels.css';
import FloodStageMenu from './FloodStageMenu';        // Accordion for flood level impacts
import FloodStepper from './FloodStepper';            // Stepper for selecting flood height
import FloodInfoPopup from "./FloodInfoPopup";        // Info popup for map disclaimers
import { getFloodStage } from './utils/floodStages';  // Util function for stage descriptions
import Search from './Search.js';                     // Address search bar
import Loc from './loc';
import './loc.css';


// cd /Users/seanfagan/Desktop/juneau-economic-council

// Custom color palette for each flood level (64–76)
const customColors = [
  "#87c210", "#c3b91e", "#e68a1e", "#31a354", "#3182bd", "#124187",
  "#d63b3b", "#9b3dbd", "#d13c8f", "#c2185b", "#756bb1", "#f59380", "#ba4976",
];

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
  const hoverHandlersRef = useRef({ move: null, out: null });
  const [mapReady, setMapReady] = useState(false);
  const toggleMenu = () => setMenuOpen((prev) => !prev);

    /**
   * Enables hover tooltips on flood layers to show water depth
   */
const setupHoverPopup = useCallback((activeLayerId) => {
  const map = mapRef.current;
  if (!map || !activeLayerId) return;

  // Wait until layer exists
  if (!map.getLayer(activeLayerId)) {
    setTimeout(() => setupHoverPopup(activeLayerId), 250);
    return;
  }

  // Remove prior handlers, if any
  if (hoverHandlersRef.current.move) {
    map.off('mousemove', hoverHandlersRef.current.move);
    hoverHandlersRef.current.move = null;
  }
  if (hoverHandlersRef.current.out) {
    map.off('mouseout', hoverHandlersRef.current.out);
    hoverHandlersRef.current.out = null;
  }

  // Reuse a single popup instance
  if (!popupRef.current) {
    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: 'hover-popup',
    });
  }


  if (!mapRef.current.getSource('mapbox-dem')) {
    mapRef.current.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    });
  }
  mapRef.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.0 });

  const moveHandler = (e) => {
    // Only consider features from the active layer
    const features = map.queryRenderedFeatures(e.point, { layers: [activeLayerId] });
    const feature = features && features[0];

    if (feature) {
      const props = feature.properties || {};
      const depth = props.DN ?? props.depth ?? 'Unknown'; // try both keys
      popupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`<b>Water Depth: ${depth} ft</b>`)
        .addTo(map);
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      popupRef.current.remove();
      map.getCanvas().style.cursor = '';
    }
  };

  const outHandler = () => {
    popupRef.current.remove();
    map.getCanvas().style.cursor = '';
  };

  map.on('mousemove', moveHandler);   // bind to map, not layer
  map.on('mouseout', outHandler);

  hoverHandlersRef.current.move = moveHandler;
  hoverHandlersRef.current.out = outHandler;
}, []);

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

    /**
   * Loads Mapbox vector tiles for all flood levels
   */
const updateFloodLayers = (mode) => {
  setLoadingLayers(true);
  const map = mapRef.current;
  const validLevels = Array.from({ length: 13 }, (_, i) => 64 + i); // 64–76
  const visibleLayerId = `flood${64 + (selectedFloodLevel - 8)}-fill`;

  // Remove old layers & sources
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
    const visible = floodId === `flood${64 + (selectedFloodLevel - 8)}`;

    const tilesetId = mode ? tilesetMap.hesco[level] : tilesetMap.base[level];
    if (mode && !tilesetId) {
      loadedCount++;
      if (loadedCount === validLevels.length) {
        setLoadingLayers(false);
        map.once('idle', () => setupHoverPopup(visibleLayerId));
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
      // Wait until the map finishes rendering with the new layer
      map.once('idle', () => setupHoverPopup(visibleLayerId));
    }
  });
};


  /**
   * HESCO Mode Toggle Handler
   */
  const toggleHescoMode = () => {
    setHescoMode((prev) => {
      const newMode = !prev;
      if (!newMode && window.innerWidth < 768) {
        window.location.reload();
      } else {
        updateFloodLayers(newMode);
        const visibleLayerId = `flood${64 + (selectedFloodLevel - 8)}-fill`;
        setTimeout(() => setupHoverPopup(visibleLayerId), 300);
      }
      return newMode;
    });
  };

  /**
   * Mapbox Initialization
   */
  useEffect(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFwZmVhbiIsImEiOiJjbTNuOGVvN3cxMGxsMmpzNThzc2s3cTJzIn0.1uhX17BCYd65SeQsW1yibA';
    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-134.572823, 58.397411],
        zoom: 11,
      });

      mapRef.current.on('load', () => {
        updateFloodLayers(hescoMode);

        // Add USGS gage markers
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
            .addTo(mapRef.current);

          if (coord.popupContent) {
            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(coord.popupContent);
            marker.setPopup(popup);
          }
        });
        setMapReady(true);
      });
    }
  }, [hescoMode]);


  //* Resets HESCO mode if out-of-range level is selected
  useEffect(() => {
    if (hescoMode && (selectedFloodLevel < 14 || selectedFloodLevel > 18)) {
      setHescoMode(false);
      updateFloodLayers(false);
    }
  }, [selectedFloodLevel, hescoMode]);

  //* Updates hover popup when flood layer changes
  const handleFloodLayerChange = useCallback(() => {
    const layerId = `flood${64 + (selectedFloodLevel - 8)}-fill`;
    if (mapRef.current?.getLayer(layerId)) {
      setupHoverPopup(layerId);
    }
  }, [selectedFloodLevel, setupHoverPopup]);

//* Polls USGS API for live lake level data
  useEffect(() => {
    const fetchWaterLevels = async () => {
      const gages = [{ id: '15052500', name: 'Mendenhall Lake Stage Level' }];
      try {
        const fetchedLevels = await Promise.all(
          gages.map(async (gage) => {
            try {
              const response = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${gage.id}&parameterCd=00065&siteStatus=active`);
              if (!response.ok) throw new Error(`HTTP status ${response.status}`);
              const data = await response.json();
              const values = data?.value?.timeSeries?.[0]?.values?.[0]?.value;
              if (values?.length > 0) {
                const latest = values[values.length - 1];
                const alaskaTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Anchorage', timeStyle: 'short', dateStyle: 'medium' }).format(new Date(latest.dateTime));
                return { id: gage.id, name: gage.name, value: parseFloat(latest.value) > 0 ? latest.value : 'N/A', dateTime: alaskaTime, status: 'Online' };
              }
              return { id: gage.id, name: gage.name, value: 'N/A', dateTime: 'N/A', status: 'Offline' };
            } catch {
              return { id: gage.id, name: gage.name, value: 'N/A', dateTime: 'N/A', status: 'Offline' };
            }
          })
        );
        setWaterLevels(fetchedLevels);
      } catch (error) {
        console.error('Error fetching water levels:', error);
      }
    };
    fetchWaterLevels();
    const interval = setInterval(fetchWaterLevels, 60000);
    return () => clearInterval(interval);
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
          onFloodLayerChange={handleFloodLayerChange}
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
            onFloodLayerChange={handleFloodLayerChange}
          />
          <button
            title="HESCO maps are only available for 14ft - 18ft & assume fully functional barriers"
            onClick={() => { if (selectedFloodLevel >= 14) toggleHescoMode(); }}
            className={`hesco-toggle-button ${hescoMode ? 'hesco-on' : 'hesco-off'}`}
            disabled={loadingLayers || selectedFloodLevel < 14 || selectedFloodLevel > 18}
          >
            {loadingLayers ? 'Loading HESCO Data…' : hescoMode ? 'HESCO Barriers ON' : 'HESCO Barriers OFF (14-18ft)'}
          </button>
          <FloodStageMenu
            setFloodLevelFromMenu={setSelectedFloodLevel}
            onFloodLayerChange={() => setupHoverPopup(`flood${64 + (selectedFloodLevel - 8)}-fill`)}
          />
          <div style={{ marginTop: '20px' }}>
            {waterLevels.map((level) => {
              const currentStage = getFloodStage(level.value);
              return (
                <div key={level.id} className="level-card">
                  <p>
                    <a href="https://waterdata.usgs.gov/monitoring-location/15052500/" target="_blank" rel="noopener noreferrer" style={{ color: 'black' }}>Current Lake Level:</a>
                    <strong>{` ${level.value} ft`}</strong>
                  </p>
                  <p>
                    <span style={{ color:'black' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{currentStage?.label || 'OFFLINE'}</span>
                    </span>
                  </p>
                  <p style={{ fontSize: '0.85rem' }}>{level.dateTime || 'N/A'}</p>
                </div>
              );
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
