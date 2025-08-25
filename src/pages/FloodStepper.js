// FloodStepper.js — Updated for Mapbox vector tiles (no .setData)

import React, { useState, useEffect, useCallback } from 'react';
import './FloodStepper.css';

const customColors = [
   "#87c210", "#c3b91e", "#e68a1e", "#31a354", "#3182bd", "#124187",
  "#d63b3b", "#9b3dbd", "#d13c8f", "#c2185b", "#756bb1", "#f59380", "#ba4976",
];

const FloodStepper = ({
  mapRef,
  selectedFloodLevel,
  setSelectedFloodLevel,
  isMenuHidden,
  hideOnDesktop = false,
  hescoMode = false,
  onFloodLayerChange = () => {}
}) => {
  const floodLevel = selectedFloodLevel;
  const [isLayerVisible, setIsLayerVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const minFloodLevel = 8;
  const maxFloodLevel = 20;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateFloodLayer = useCallback((level) => {
    if (!mapRef.current) return;

    const layerId = `flood${64 + (selectedFloodLevel - 8)}-fill`;

    const layers = mapRef.current.getStyle().layers || [];
    layers.forEach((layer) => {
      if (layer.id.includes('flood') && layer.id.endsWith('-fill')) {
        if (mapRef.current.getLayer(layer.id)) {
          mapRef.current.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      }
    });

    if (mapRef.current.getLayer(layerId)) {
      mapRef.current.setLayoutProperty(layerId, 'visibility', 'visible');
    } else {
      console.warn(`Layer ${layerId} not found`);
    }

    onFloodLayerChange();
  }, [mapRef, onFloodLayerChange]);

  useEffect(() => {
    if (selectedFloodLevel) {
      updateFloodLayer(selectedFloodLevel);
    }
  }, [selectedFloodLevel, hescoMode, updateFloodLayer]);

  const changeFloodLevel = (direction) => {
    const newLevel = direction === 'up' ? floodLevel + 1 : floodLevel - 1;
    if (newLevel >= minFloodLevel && newLevel <= maxFloodLevel) {
      setSelectedFloodLevel(newLevel);
    }
  };

  const toggleFloodVisibility = () => {
    const layerId = `flood${64 + (floodLevel - 8)}-fill`;
    const newVisibility = isLayerVisible ? 'none' : 'visible';

    setIsLayerVisible(!isLayerVisible);

    if (mapRef.current?.getLayer(layerId)) {
      mapRef.current.setLayoutProperty(layerId, 'visibility', newVisibility);
      onFloodLayerChange();
    }
  };

  if (hideOnDesktop && !isMobile) return null;

  return (
    <div className="flood-stepper-wrapper">
      <div className={`stepper-container ${isMenuHidden ? 'menu-hidden' : ''}`}>
        <button
          className="stepper-button"
          onClick={() => changeFloodLevel('down')}
          disabled={floodLevel === minFloodLevel}
        >
          −
        </button>

        <div
          className={`flood-level-card ${isLayerVisible ? '' : 'dimmed'}`}
          style={{ backgroundColor: customColors[floodLevel - 8] }}
          onClick={() => {
            const layerId = `flood${64 + (floodLevel - 8)}-fill`;
            if (mapRef.current?.getLayer(layerId)) {
              toggleFloodVisibility();
            }
          }}
        >
          <div className="water-text">Mendenhall Lake</div>
          {floodLevel} ft
        </div>

        <button
          className="stepper-button"
          onClick={() => changeFloodLevel('up')}
          disabled={floodLevel === maxFloodLevel}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default FloodStepper;