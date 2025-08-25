// utils/preloadGeojsons.js

export const preloadFloodGeojsons = (hescoMode = false) => {
  const baseURL = hescoMode
    ? "https://flood-data-hesco.s3.us-east-2.amazonaws.com"
    : "https://flood-data.s3.us-east-2.amazonaws.com";

  const levels = Array.from({ length: 10 }, (_, i) => 65 + i); // 65-74

  levels.forEach((level) => {
    const url = `${baseURL}/${level}.geojson`;
    fetch(url)
      .then((res) => {
        if (res.ok) return res.json(); // parse but discard result
      })
      .catch((err) => console.warn(`Preload failed for ${url}`, err));
  });
};
