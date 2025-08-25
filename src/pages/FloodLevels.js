import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Local styles and components
import "./FloodLevels.css";
import FloodStageMenu from "./FloodStageMenu";
import FloodStepper from "./FloodStepper";
import FloodInfoPopup from "./FloodInfoPopup";
import { getFloodStage } from "./utils/floodStages";

// Custom color palette for each flood level (64–76)
const customColors = [
  "#87c210", "#c3b91e", "#e68a1e", "#31a354", "#3182bd", "#124187",
  "#d63b3b", "#9b3dbd", "#d13c8f", "#c2185b", "#756bb1", "#f59380", "#ba4976",
];

const FloodLevels = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const hoverHandlersRef = useRef({ move: null, out: null });

  // UI state
  const [selectedFloodLevel, setSelectedFloodLevel] = useState(9);
  const [menuOpen, setMenuOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 800 : true));
  const [hescoMode, setHescoMode] = useState(false);
  const [errorMessage] = useState("");
  const [waterLevels, setWaterLevels] = useState([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  /**
   * Tileset IDs for flood levels
   */
  const tilesetMap = useMemo(() => ({
    base: {
      64: "ccav82q0", 65: "3z7whbfp", 66: "8kk8etzn", 67: "akq41oym",
      68: "5vsqqhd8", 69: "awu2n97c", 70: "a2ttaa7t", 71: "0rlea0ym",
      72: "44bl8opr", 73: "65em8or7", 74: "9qrkn8pk", 75: "3ktp8nyu",
      76: "avpruavl",
    },
    hesco: {
      70: "cjs05ojz", 71: "1z6funv6", 72: "9kmxxb2g",
      73: "4nh8p66z", 74: "cz0f7io4",
    },
  }), []);

  /**
   * Utility: derive ids for a given level + mode variant
   */
  const idsFor = (level, mode /* boolean */) => {
    const variant = mode ? "hesco" : "base";
    const sourceId = `flood${level}-${variant}`;
    const layerId = `${sourceId}-fill`;
    return { sourceId, layerId, variant };
  };

  /**
   * Ensure a flood layer exists (adds source/layer once). Returns true if present/created.
   */
  const ensureFloodLayer = (map, mode, level) => {
    const variant = mode ? "hesco" : "base";
    const tilesetId = tilesetMap[variant][level];
    if (!tilesetId) return false; // tileset not available for this level

    const { sourceId, layerId } = idsFor(level, mode);
    const sourceLayerName = mode ? `flood${level}` : String(level);

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: "vector", url: `mapbox://mapfean.${tilesetId}` });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        "source-layer": sourceLayerName,
        layout: { visibility: "none" },
        paint: { "fill-color": customColors[level - 64], "fill-opacity": 0.4 },
      });
    }
    return true;
  };

  /**
   * Hover tooltips for water depth
   */
  const setupHoverPopup = useCallback((activeLayerId) => {
    const map = mapRef.current;
    if (!map || !activeLayerId) return;

    // Wait until style is ready
    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setupHoverPopup(activeLayerId));
      return;
    }

    // Wait until layer exists
    if (!map.getLayer(activeLayerId)) {
      setTimeout(() => setupHoverPopup(activeLayerId), 250);
      return;
    }

    // Remove old event handlers if present
    if (hoverHandlersRef.current.move) {
      map.off("mousemove", hoverHandlersRef.current.move);
      hoverHandlersRef.current.move = null;
    }
    if (hoverHandlersRef.current.out) {
      map.getCanvas().removeEventListener("mouseleave", hoverHandlersRef.current.out);
      hoverHandlersRef.current.out = null;
    }

    // Reuse a single popup instance
    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        className: "hover-popup",
      });
    }

    const moveHandler = (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [activeLayerId] });
      const feature = features && features[0];

      if (feature) {
        const props = feature.properties || {};
        const depth = props.DN ?? props.depth ?? "Unknown";
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<b>Water Depth: ${depth} ft</b>`)
          .addTo(map);
        map.getCanvas().style.cursor = "crosshair";
      } else {
        popupRef.current.remove();
        map.getCanvas().style.cursor = "";
      }
    };

    const outHandler = () => {
      if (popupRef.current) popupRef.current.remove();
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", moveHandler);
    map.getCanvas().addEventListener("mouseleave", outHandler);

    hoverHandlersRef.current.move = moveHandler;
    hoverHandlersRef.current.out = outHandler;
  }, []);

  /**
   * Updates flood layers based on selected level + mode
   *
   * Refactor: build layers once per variant and toggle visibility instead of
   * removing/re-adding everything on each change.
   */
  const updateFloodLayers = (mode) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      map?.once("style.load", () => updateFloodLayers(mode));
      return;
    }

    setLoadingLayers(true);
    const validLevels = Array.from({ length: 13 }, (_, i) => 64 + i);
    const targetLevel = 64 + (selectedFloodLevel - 8); // keep original mapping math

    // Ensure layers exist for both variants as needed, then toggle visibility
    validLevels.forEach((level) => {
      // ensure current variant layer (if available)
      ensureFloodLayer(map, mode, level);
      // also ensure the opposite variant is known if ever needed later
      // (not strictly required to ensure now)
    });

    // Hide all layers for both variants; show only the active one (if exists)
    validLevels.forEach((level) => {
      [false, true].forEach((m) => {
        const { layerId } = idsFor(level, m);
        if (map.getLayer(layerId)) {
          const visible = (m === mode) && (level === targetLevel);
          map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
      });
    });

    setLoadingLayers(false);
    const { layerId: visibleLayerId } = idsFor(targetLevel, mode);
    map.once("idle", () => setupHoverPopup(visibleLayerId));
  };

  /**
   * Toggles HESCO Mode (no page reloads)
   */
  const toggleHescoMode = () => {
    setHescoMode((prev) => {
      const newMode = !prev;
      updateFloodLayers(newMode);
      const targetLevel = 64 + (selectedFloodLevel - 8);
      const { layerId } = idsFor(targetLevel, newMode);
      setTimeout(() => setupHoverPopup(layerId), 300);
      return newMode;
    });
  };

  /**
   * Initialize Mapbox (only once)
   */
  useEffect(() => {
    mapboxgl.accessToken =
      "pk.eyJ1IjoibWFwZmVhbiIsImEiOiJjbTNuOGVvN3cxMGxsMmpzNThzc2s3cTJzIn0.1uhX17BCYd65SeQsW1yibA";

    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-134.572823, 58.397411],
        zoom: 11,
      });

      // Initialize DEM + Terrain ONCE when style loads
      mapRef.current.on("style.load", () => {
        if (!mapRef.current.getSource("mapbox-dem")) {
          mapRef.current.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
        }
        mapRef.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });

        // Load flood layers AFTER style + terrain
        updateFloodLayers(hescoMode);
        setMapReady(true);
      });

      // Add USGS markers
      mapRef.current.on("load", () => {
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
          const markerEl = document.createElement("div");
          markerEl.className = "usgs-marker";

          const marker = new mapboxgl.Marker(markerEl)
            .setLngLat([coord.lng, coord.lat])
            .addTo(mapRef.current);

          if (coord.popupContent) {
            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(coord.popupContent);
            marker.setPopup(popup);
          }
        });
      });
    }

    // Cleanup on unmount
    return () => {
      try {
        const map = mapRef.current;
        if (!map) return;

        // remove hover handlers
        if (hoverHandlersRef.current.move) {
          map.off("mousemove", hoverHandlersRef.current.move);
          hoverHandlersRef.current.move = null;
        }
        if (hoverHandlersRef.current.out) {
          map.getCanvas().removeEventListener("mouseleave", hoverHandlersRef.current.out);
          hoverHandlersRef.current.out = null;
        }

        // remove popups
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }

        // remove map
        map.remove();
        mapRef.current = null;
      } catch {}
    };
  // IMPORTANT: run ONCE
  }, []);

  /**
   * Reset HESCO mode if level out of range
   */
  useEffect(() => {
    if (hescoMode && (selectedFloodLevel < 14 || selectedFloodLevel > 18)) {
      setHescoMode(false);
      updateFloodLayers(false);
    }
  }, [selectedFloodLevel, hescoMode]);

  /**
   * Update hover popup when flood layer changes
   */
  const handleFloodLayerChange = useCallback(() => {
    const targetLevel = 64 + (selectedFloodLevel - 8);
    const { layerId } = idsFor(targetLevel, hescoMode);
    if (mapRef.current?.getLayer(layerId)) {
      setupHoverPopup(layerId);
    }
  }, [selectedFloodLevel, hescoMode, setupHoverPopup]);

  // * Polls USGS API for live lake level data
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

      {/* Menu toggle */}
      <button onClick={toggleMenu} className="menu-toggle-button">
        {menuOpen ? 'Hide Menu' : 'Show Menu'}
      </button>

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
            onFloodLayerChange={() => {
              const targetLevel = 64 + (selectedFloodLevel - 8);
              const { layerId } = idsFor(targetLevel, hescoMode);
              setupHoverPopup(layerId);
            }}
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