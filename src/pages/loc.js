// Loc.js
import React, { useEffect, useState } from 'react';


const Loc = ({
  mapRef,
  className = '',
  position = { left: 12, bottom: 12 },
  showFeet = true,
  precision = 5,
}) => {
  const [info, setInfo] = useState({ lng: null, lat: null, elevM: null });

  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return;

    // Ensure DEM + terrain are set up (safe to call if already present)
    const onLoad = () => {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        });
      }
      // If terrain already set, calling again is harmless
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.0 });
    };

    if (map.loaded()) {
      onLoad();
    } else {
      map.once('load', onLoad);
    }

    let rafId = null;
    const onMove = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const { lng, lat } = e.lngLat || {};
        let elevM = null;
        try {
          // IMPORTANT: use e.lngLat, not e.point
          elevM = map.queryTerrainElevation(e.lngLat, { exaggerated: false });
        } catch {
          // ignore if terrain not ready/available
        }
        if (typeof elevM !== 'number' || Number.isNaN(elevM)) elevM = null;
        setInfo({ lng, lat, elevM });
      });
    };

    map.on('mousemove', onMove);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      map.off('mousemove', onMove);
    };
  }, [mapRef]);

  const stylePos = {
    ...(position.left != null ? { left: position.left } : {}),
    ...(position.right != null ? { right: position.right } : {}),
    ...(position.top != null ? { top: position.top } : {}),
    ...(position.bottom != null ? { bottom: position.bottom } : {}),
  };

  const feet = info.elevM != null ? Math.round(info.elevM * 3.28084) : null;

  return (
    <div className={`loc-readout ${className}`} style={stylePos}>
      {info.lat != null && info.lng != null ? (
        <>
          <div>
            <strong>Lat:</strong> {info.lat.toFixed(precision)}&nbsp;
            <strong>Lng:</strong> {info.lng.toFixed(precision)}
          </div>
          <div>
            <strong>Elev:</strong>{' '}
            {info.elevM == null
              ? '—'
              : `${Math.round(info.elevM)} m${showFeet ? ` (${feet} ft)` : ''}`}
          </div>
        </>
      ) : (
        <div>Move cursor over map…</div>
      )}
    </div>
  );
};

export default Loc;
