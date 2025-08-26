import React, { useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import './Search.css';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwZmVhbiIsImEiOiJjbTNuOGVvN3cxMGxsMmpzNThzc2s3cTJzIn0.1uhX17BCYd65SeQsW1yibA';

const Search = ({ mapRef, bizData }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const searchMarkerRef = useRef(null);

  // Filter local business data by name
  const fetchSuggestions = (input) => {
    if (!input || !bizData?.features) {
      setSuggestions([]);
      return;
    }

    const lower = input.toLowerCase();

    const matches = bizData.features
      .filter((f) => {
        const name = f.properties?.USER_Busin || '';
        return name.toLowerCase().includes(lower);
      })
      .slice(0, 10); // Limit dropdown results

    setSuggestions(matches);
  };

  const handleSuggestionSelect = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;

    // Remove old marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
    }

    // Add a red marker at the selected business
    searchMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    // Fly to business location
    mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });

    setQuery(feature.properties?.USER_Busin || 'Unknown Business');
    setSuggestions([]);
    setErrorMessage('');
  };

  return (
    <div className="search-container">
      <div style={{ position: 'relative' }}>
        <input
          className="search-bar"
          type="text"
          placeholder="Search businesses by name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            fetchSuggestions(e.target.value);
          }}
        />
        {suggestions.length > 0 && (
          <ul className="autocomplete-dropdown">
            {suggestions.map((feature, idx) => (
              <li key={idx} onClick={() => handleSuggestionSelect(feature)}>
                {feature.properties?.USER_Busin || 'Unnamed Business'}
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorMessage && (
        <p style={{ color: 'red', marginTop: '5px' }}>{errorMessage}</p>
      )}
    </div>
  );
};

export default Search;
