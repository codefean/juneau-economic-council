import React, { useState, useEffect } from "react";
import "./FloodInfoPopup.css";

const FloodInfoPopup = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Always show popup when page loads and auto-dismiss after 10 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="flood-popup-overlay">
      <div className="flood-popup-box">
        <h2>Loading Flood Levels</h2>
        <p>
          Additionally, if the browser asks you to wait,
          click <strong>“wait for page to load”</strong> as this data is dense. After you accept, click to the next flood level to begin.
        </p>
        <button onClick={handleClose} className="popup-close-button">
          <strong>Accept</strong>
        </button>
      </div>
    </div>
  );
};

export default FloodInfoPopup;
