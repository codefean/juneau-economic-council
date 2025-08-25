import React from 'react';

const MapControls = ({ floodLevels, visibleFlood, showFloodLevel }) => {
  return (
    <div className="map-controls">
      <h3>Select Flood Level:</h3>
      {floodLevels.map((flood) => (
        <button
          key={flood.id}
          onClick={() => showFloodLevel(flood.id)}
          style={{
            padding: '10px',
            margin: '5px',
            background: flood.id === visibleFlood ? flood.color : 'white',
            color: flood.id === visibleFlood ? 'white' : 'black',
            border: '1px solid black',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          {flood.name}
        </button>
      ))}
    </div>
  );
};

export default MapControls;
