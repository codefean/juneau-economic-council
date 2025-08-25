import React, { useState, useEffect } from "react";
import "./FloodWarn.css";

const FloodWarn = () => {
  const [floodStatus, setFloodStatus] = useState("Checking flood status...");
  const [alertUrl, setAlertUrl] = useState("https://water.noaa.gov/gauges/MNDA2");

  useEffect(() => {
    const fetchFloodStatus = async () => {
      try {
        const response = await fetch("https://api.weather.gov/alerts/active?zone=AKZ025", {
          headers: { "User-Agent": "JuneauFloodApp (https://github.com/codefean/juneau-flood-beta)" },
        });
        const data = await response.json();

        if (data.features.length > 0) {
          const alert = data.features[0].properties;
          setFloodStatus(alert.headline || alert.event || "Advisory Issued");
          setAlertUrl(alert.web || "https://www.weather.gov/ajk/");
        } else {
          setFloodStatus("No Active Alerts");
          setAlertUrl("https://www.weather.gov/ajk/suicideBasin");
        }
      } catch (error) {
        console.error("Error fetching status:", error);
        setFloodStatus("Data unavailable. Check NWS website.");
        setAlertUrl("https://www.weather.gov/ajk/suicideBasin");
      }
    };

    fetchFloodStatus();
    const interval = setInterval(fetchFloodStatus, 600000); // Update every 10 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flood-warn-header">
      <a href={alertUrl} target="_blank" rel="noopener noreferrer" className="flood-status-btn">
        <span className="flood-status"> NWS: {floodStatus}</span>
      </a>
    </div>
  );
};

export default FloodWarn;