export const stages = [
  { label: "No Flood Stage", range: [0, 8], color: "#28a745", info: "Water level is below flood risk (0ft - 8ft)" },
  { label: "Action Stage", range: [8, 9], color: "#e9f502", info: "Flooding risk starts (8ft - 9ft)" },
  { label: "Minor Flood Stage", range: [9, 10], color: "#F4A100", info: "Flooding risk 9ft - 10ft" },
  { label: "Moderate Flood Stage", range: [10, 14], color: "#E2371D", info: "Flooding risk 10ft - 14ft" },
  { label: "Major Flood Stage", range: [14, Infinity], color: "#9419A3", info: "Flooding risk 14ft+" },
];

export const getFloodStage = (level) => {
  const numericLevel = parseFloat(level);
  if (isNaN(numericLevel)) return null;
  return stages.find(stage => numericLevel >= stage.range[0] && numericLevel < stage.range[1]);
};
