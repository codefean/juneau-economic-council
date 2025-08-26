import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

import './FloodLevels.css';
import FloodStageMenu from './FloodStageMenu';
import FloodStepper from './FloodStepper';
import FloodInfoPopup from './FloodInfoPopup';
import { getFloodStage } from './utils/floodStages';
import Search from './Search.js';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { featureEach, flattenEach } from '@turf/meta';
import { point, featureCollection } from '@turf/helpers';

// cd /Users/seanfagan/Desktop/juneau-economic-council

// ✅ Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoibWFwZmVhbiIsImEiOiJjbTNuOGVvN3cxMGxsMmpzNThzc2s3cTJzIn0.1uhX17BCYd65SeQsW1yibA';

// IDs so we can reference consistently
const BIZ_SOURCE_ID = 'businesses';
const BIZ_LAYER_ID = 'businesses-layer';

const customColors = [
  '#87c210', '#c3b91e', '#e68a1e', '#31a354', '#3182bd', '#124187',
  '#d63b3b', '#9b3dbd', '#d13c8f', '#c2185b', '#756bb1', '#f59380', '#ba4976',
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

const tilesetMap = {
  base: {
    64: 'ccav82q0', 65: '3z7whbfp', 66: '8kk8etzn', 67: 'akq41oym',
    68: '5vsqqhd8', 69: 'awu2n97c', 70: 'a2ttaa7t', 71: '0rlea0ym',
    72: '44bl8opr', 73: '65em8or7', 74: '9qrkn8pk', 75: '3ktp8nyu',
    76: 'avpruavl',
  },
  hesco: {
    70: 'cjs05ojz', 71: '1z6funv6', 72: '9kmxxb2g', 73: '4nh8p66z', 74: 'cz0f7io4',
  },
};

const buildVisibleLayerId = (lvl) => `flood${64 + (lvl - 8)}-fill`;

const FloodLevels = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const [selectedFloodLevel, setSelectedFloodLevel] = useState(9);
  const [menuOpen, setMenuOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 800 : true));
  const [hescoMode, setHescoMode] = useState(false);
  const [errorMessage] = useState('');
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [bizData, setBizData] = useState(null);
  const [bizDataLoaded, setBizDataLoaded] = useState(false);

  const popupRef = useRef(null);
  const hoverHandlersRef = useRef({ move: null, out: null, layerId: null });
  const activeLayerIdRef = useRef(null);

  const [bizResults, setBizResults] = useState({ level: null, items: [] });

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  // --- Map init -------------------------------------------------------------
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-134.572823, 58.397411], // Juneau region
      zoom: 11.2,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

    map.on('load', () => {
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // --- Fetch businesses.geojson once ----------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `${process.env.PUBLIC_URL}/businesses.geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load businesses.geojson (${res.status})`);
        const json = await res.json();
        if (!cancelled) setBizData(json);
      } catch (e) {
        console.error('Error loading businesses.geojson', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Ensure business points are on TOP of flood layers --------------------
  const bringBizLayerAboveFlood = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer(BIZ_LAYER_ID)) return;
    // No beforeId -> move to top
    map.moveLayer(BIZ_LAYER_ID);
  }, []);

  // --- Add businesses source/layer when map & data ready --------------------
  useEffect(() => {
  const map = mapRef.current;
  if (!map || !mapReady || !bizData) return;

  runWhenStyleReady(map, () => {
    // source
    if (!map.getSource(BIZ_SOURCE_ID)) {
      map.addSource(BIZ_SOURCE_ID, { type: 'geojson', data: bizData });
    } else {
      const src = map.getSource(BIZ_SOURCE_ID);
      if (src && src.setData) src.setData(bizData);
    }

    // layer (no beforeId so it’s on top)
    if (!map.getLayer(BIZ_LAYER_ID)) {
      map.addLayer({
        id: BIZ_LAYER_ID,
        type: 'circle',
        source: BIZ_SOURCE_ID,
        paint: {
          'circle-radius': 4,
          'circle-pitch-scale': 'viewport',
          'circle-color': '#ff6600',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
          'circle-blur': 0.05,
          'circle-opacity': 0.9,
        },
      });
    }

    // keep above flood fills
    bringBizLayerAboveFlood();

    // HOVER POPUP
    const bizPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: 'business-popup',
    });

    const onMove = (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      const name = feature.properties?.USER_Busin || 'Unknown Business';
      bizPopup.setLngLat(e.lngLat).setHTML(`<b>${name}</b>`).addTo(map);
    };

    const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => {
      bizPopup.remove();
      map.getCanvas().style.cursor = '';
    };

    // bind
    map.on('mouseenter', BIZ_LAYER_ID, onEnter);
    map.on('mousemove',  BIZ_LAYER_ID, onMove);
    map.on('mouseleave', BIZ_LAYER_ID, onLeave);

    setBizDataLoaded(true);

    // 🔒 Proper cleanup (runs when effect re-runs/unmounts)
    return () => {
      if (!map) return;
      map.off('mouseenter', BIZ_LAYER_ID, onEnter);
      map.off('mousemove',  BIZ_LAYER_ID, onMove);
      map.off('mouseleave', BIZ_LAYER_ID, onLeave);
      bizPopup.remove();
    };
  });
}, [mapReady, bizData, bringBizLayerAboveFlood]);


  // --- Flood layers ---------------------------------------------------------
  const setupHoverPopup = useCallback((activeLayerId) => {
    const map = mapRef.current;
    if (!map || !activeLayerId) return;

    runWhenStyleReady(map, () => {
      // clear old handlers
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

    // clear previous
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
          map.once('idle', () => {
            setupHoverPopup(targetLayerId);
            bringBizLayerAboveFlood();
          });
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
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color': customColors[level - 64],
          'fill-opacity': 0.4,
        },
      });

      loadedCount++;
      if (loadedCount === validLevels.length) {
        setLoadingLayers(false);
        map.once('idle', () => {
          setupHoverPopup(targetLayerId);
          bringBizLayerAboveFlood(); // keep points on top after rebuild
        });
      }
    });
  }, [selectedFloodLevel, setupHoverPopup, bringBizLayerAboveFlood]);

  const safeUpdateFloodLayers = useCallback((mode) => {
    const map = mapRef.current;
    if (!map) return;
    runWhenStyleReady(map, () => updateFloodLayers(mode));
  }, [updateFloodLayers]);

  // kick off initial flood layer once the map is ready
  useEffect(() => {
    if (!mapReady) return;
    safeUpdateFloodLayers(hescoMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // update visible layer when slider changes
  useEffect(() => {
    if (!mapReady) return;
    safeUpdateFloodLayers(hescoMode);
  }, [selectedFloodLevel, hescoMode, mapReady, safeUpdateFloodLayers]);

  const toggleHescoMode = () => {
    setHescoMode((prev) => {
      const newMode = !prev;
      if (newMode && (selectedFloodLevel < 14 || selectedFloodLevel > 18)) {
        safeUpdateFloodLayers(false);
        return false;
      }
      safeUpdateFloodLayers(newMode);
      const visibleLayerId = buildVisibleLayerId(selectedFloodLevel);
      setTimeout(() => setupHoverPopup(visibleLayerId), 300);
      return newMode;
    });
  };


const getBusinessesInFloodZone = async () => {
  const map = mapRef.current;
  if (!map) {
    console.warn('❌ Map not initialized.');
    return;
  }

  if (!bizData?.features?.length) {
    console.warn('⚠️ Business data not loaded yet.');
    return;
  }

  try {
    // Build the public S3 URL for flood map GeoJSONs
    const folder = hescoMode ? "geojson_hesco" : "";
    const floodGeoJsonUrl = `https://flood-events.s3.us-east-2.amazonaws.com${folder ? `/${folder}` : ''}/${selectedFloodLevel}.geojson`;

    console.log(`🌊 Fetching flood map from: ${floodGeoJsonUrl}`);

    const res = await fetch(floodGeoJsonUrl, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`❌ Failed to load ${floodGeoJsonUrl} (${res.status})`);
      setBizResults({ level: selectedFloodLevel, items: [] });
      return;
    }

    const flood = await res.json();

    if (!flood || !Array.isArray(flood.features) || flood.features.length === 0) {
      console.warn('⚠️ No flood polygons loaded.');
      setBizResults({ level: selectedFloodLevel, items: [] });
      return;
    }

    // Flatten MultiPolygon → Polygon
    const polys = [];
    flattenEach(flood, (simple) => {
      if (simple?.geometry?.type === 'Polygon') polys.push(simple);
    });

    if (polys.length === 0) {
      console.warn('⚠️ Flood file has no Polygon geometries after flatten.');
      setBizResults({ level: selectedFloodLevel, items: [] });
      return;
    }

    // Sanity check coordinates (EPSG:4326)
    const firstRing = polys[0].geometry.coordinates?.[0];
    if (Array.isArray(firstRing) && firstRing[0]) {
      const [x, y] = firstRing[0];
      if (Math.abs(x) < 1 && Math.abs(y) < 1) {
        console.warn('⚠️ Flood polygons look like they are not in lon/lat (EPSG:4326). Check CRS.');
      }
      if (y < -180 || y > 180) {
        console.warn('⚠️ Flood polygons may have [lat, lon] order instead of [lon, lat].');
      }
    }

    // Filter businesses within polygons
    const items = bizData.features
      .filter((biz) => {
        const coords = biz?.geometry?.coordinates;
        if (!coords || coords.length < 2) return false;

        // Ensure numeric [lng, lat]
        let [lng, lat] = coords;
        lng = typeof lng === 'string' ? Number(lng) : lng;
        lat = typeof lat === 'string' ? Number(lat) : lat;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;

        const pt = point([lng, lat]);

        // Check if inside any polygon
        return polys.some((poly) => booleanPointInPolygon(pt, poly));
      })
      .map((biz) => ({
        name:
          biz.properties?.USER_Busin?.toString()?.trim() ||
          biz.properties?.name?.toString()?.trim() ||
          '[Unnamed]',
        feature: biz,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setBizResults({ level: selectedFloodLevel, items });

    console.log(
      `🎯 ${items.length} businesses in ${selectedFloodLevel}ft flood zone${hescoMode ? ' (HESCO)' : ''}`
    );
    console.table(items.map((b) => b.name));
  } catch (err) {
    console.error('❌ Error while checking businesses in flood zone:', err);
    setBizResults({ level: selectedFloodLevel, items: [] });
  }
};


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
            onClick={getBusinessesInFloodZone}
            className="flood-button"
            disabled={!bizDataLoaded}
          >
            {bizDataLoaded ? 'Show Businesses in Flood Zone' : 'Loading Businesses…'}
          </button>

          <button
            type="button"
            title="HESCO maps are only available for 14ft - 18ft & assume fully functional barriers"
            onClick={() => { if (selectedFloodLevel >= 14) toggleHescoMode(); }}
            className={`hesco-toggle-button ${hescoMode ? 'hesco-on' : 'hesco-off'}`}
            disabled={loadingLayers || selectedFloodLevel < 14 || selectedFloodLevel > 18}
          >
            {loadingLayers ? 'Loading HESCO Data…' : hescoMode ? 'HESCO Barriers ON' : 'HESCO Barriers OFF (14-18ft)'}
          </button>

          {bizResults.level !== null && (
            <div className="biz-results-tile">
              <div className="biz-results-header">
                <strong>{bizResults.items.length}</strong> businesses in the{' '}
                <strong>{bizResults.level}ft</strong> flood zone
              </div>

              {bizResults.items.length === 0 ? (
                <div className="biz-results-empty">No businesses found in the current view.</div>
              ) : (
                <ul className="biz-results-list">
                  {bizResults.items.map((b, i) => (
                    <li key={`${b.name}-${i}`} className="biz-results-item">
                      {b.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
