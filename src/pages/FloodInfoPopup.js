import React, { useState, useEffect } from "react";
import "./FloodInfoPopup.css";

const FloodInfoPopup = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show popup only on desktop and only if it hasn't been dismissed before
    const hasDismissedPopup = localStorage.getItem("floodPopupDismissed");
    if (!hasDismissedPopup && window.innerWidth >= 768) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem("floodPopupDismissed", "true"); // Prevent showing again
  };

  if (!isVisible) return null;

  return (
    <div className="flood-popup-overlay">
      <div className="flood-popup-box">
        <h2>Welcome to the Glacial Outburst Flood Map</h2>

        <p className="reduce-top-margin">
          <strong>This interactive map helps you plan for flooding in the Mendenhall Valley</strong>
        </p>

        <div className="popup-info">
          <p><strong>Search Your Address:</strong> Check if your location is in a flood-prone zone at various flood levels.</p>
          <p><strong>Explore Flood Levels:</strong> Hover over the inundation maps to see estimated water depths (-/+).</p>
          <p><strong>Forecasted Lake Level:</strong> See the current <em>estimated</em> lake water level during the flood season.</p>
          <p><strong>HESCO Barriers:</strong> View maps showing the predicted flood path assuming fully functional HESCO barriers.</p>
        </div>

        <p className="popup-disclaimer">
          This tool is for <em>informational purposes only</em>. For emergency flood information, refer to the 
          <a href="https://www.weather.gov/ajk/suicideBasin" target="_blank" rel="noopener noreferrer"> National Weather Service</a>.
        </p>

        {/* Only clicking this button will close the popup */}
        <button onClick={handleClose} className="popup-close-button">
          <strong>Accept</strong>
        </button>
      </div>
    </div>
  );
};

export default FloodInfoPopup;

