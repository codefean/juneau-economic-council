import React, { useState } from 'react';
import './FloodStageMenu.css';

const FloodStageMenu = ({ setFloodLevelFromMenu, onFloodLayerChange = () => {} }) => {
  const [expanded, setExpanded] = useState(null);

  const toggleAccordion = (section, floodLevel) => {
    setExpanded(expanded === section ? null : section);
    if (floodLevel && setFloodLevelFromMenu) {
      setFloodLevelFromMenu(floodLevel);
      onFloodLayerChange();
    }
  };

  return (
    <div className="accordion-container">
      {/* Action Stage */}
      <div
        className={`accordion-section action-stage ${expanded === 'action' ? 'expanded' : ''}`}
        onClick={() => toggleAccordion('action', 9)} 
      >
        <h4>
          <span className="accordion-title">
            Action Stage (8 - 9ft)
            <span className={`accordion-arrow ${expanded === 'action' ? 'open' : ''}`}>&#9656;</span>
          </span>
        </h4>
        {expanded === 'action' && (
          <div className="accordion-content">
            <p>Water levels have reached flood potential. Residents should begin to take mitigation actions for flooding events based on their location.</p>
          </div>
        )}
      </div>

      {/* Minor Flood Stage */}
      <div
        className={`accordion-section minor-stage ${expanded === 'minor' ? 'expanded' : ''}`}
        onClick={() => toggleAccordion('minor', 10)} 
      >
        <h4>
          <span className="accordion-title">
            Minor Flood Stage (9 - 10ft)
            <span className={`accordion-arrow ${expanded === 'minor' ? 'open' : ''}`}>&#9656;</span>
          </span>
        </h4>
        {expanded === 'minor' && (
          <div className="accordion-content">
            <p><strong>9 ft:</strong> Water starts covering Skaters Cabin Rd and flows into Mendenhall Campground.</p>
            <p><strong>9.5 ft:</strong> 0.5 ft of water covers Skaters Cabin Rd. Campsite 7 flooded; water over the road between campsites 8 and 9.</p>
            <p><strong>10 ft:</strong> Mendenhall Campground inundated with up to 3 ft of water. Skaters Cabin Rd has up to 1.5 ft of water. Portions of West Glacier Trail impassable. Minor yard flooding on View Dr begins.</p>
            <p><strong>10.5 ft:</strong> Over 3 ft of water near Mt. McGinnis trailhead. Mendenhall Campground evacuation starts.</p>
          </div>
        )}
      </div>

      {/* Moderate Flood Stage */}
      <div
        className={`accordion-section moderate-stage ${expanded === 'moderate' ? 'expanded' : ''}`}
        onClick={() => toggleAccordion('moderate', 14)} 
      >
        <h4>
          <span className="accordion-title">
            Moderate Flood Stage (10 - 14ft)
            <span className={`accordion-arrow ${expanded === 'moderate' ? 'open' : ''}`}>&#9656;</span>
          </span>
        </h4>
        {expanded === 'moderate' && (
        <div className="accordion-content">
          <p><strong>Impacts With HESCO Barriers</strong></p>
          <p><strong>11 ft:</strong> Yards flood on View Dr (up to 1.5 ft of water). Bank erosion begins below Back Loop Bridge. Backyard flooding on Meander Way. Dredge Lake Trail impassable; floodwaters reach Dredge Lake.</p>
          <p><strong>12.5 ft:</strong> 2–4 ft of water in Meander Way backyards.</p>
          <p><strong>13 ft:</strong> 2 ft of water on road past 9374 View Dr. 1–2 ft of water in some homes on View Dr.</p>
          <p><strong>14 ft:</strong> Road past 9374 View Dr impassable. More homes on View Dr see moderate to major flooding. Water approaches driveways on River Rd.</p>
        </div>
        )}
      </div>

      {/* Major Flood Stage */}
      <div
        className={`accordion-section major-stage ${expanded === 'major' ? 'expanded' : ''}`}
        onClick={() => toggleAccordion('major', 15)} 
      >
        <h4>
          <span className="accordion-title">
            Major Flood Stage (14ft+)
            <span className={`accordion-arrow ${expanded === 'major' ? 'open' : ''}`}>&#9656;</span>
          </span>
        </h4>
        {expanded === 'major' && (
        <div className="accordion-content">
          <p><strong>Impacts With HESCO Barriers</strong></p>
          <p><strong>15 ft:</strong> Major home flooding on View Dr. Water in backyards and driveways along River Rd. Up to 1 ft of water on Riverside Dr near Tournure St and Mendenhall River School.</p>
          <p><strong>16 ft:</strong> Water overtops banks near Wildmeadow Ln. 0.5 ft water at Skaters Cabin Rd & Arctic Cir intersection. Backyard flooding begins between Tamarack Ct and Whitewater Ct. Flooding near River Rd and Meadow Ln.</p>
          <p><strong>17 ft:</strong> Homes flooded near Wildmeadow Ln and Meadow Ln to Eagle St. Businesses in Vintage Park Blvd threatened. Tournure St covered in water. All of View Dr flooded.</p>
          <p><strong>18 ft:</strong> Water over both sides of Back Loop Rd near Mint Way to Chelsea Ct. Mendenhall Loop Rd and Egan Dr begin flooding. Businesses between Sherwood Ln and Bentwood Pl impacted. Water in low areas of neighborhoods east of Radcliffe Rd.</p>
          <p><strong>19 ft:</strong> Roads like Slim Williams Way, Black Wolf Way, and Pond Vista Dr flooded. Homes on Tournure St inundated. Egan Dr and Mendenhall Mall Rd flooded and impassable. Widespread home and business flooding near Mendenhall River.</p>
          <p><strong>20 ft:</strong> Backyards along Gladstone St flooded. Homes south of Mendenhall Loop Rd inundated. Widespread flooding on both sides of Mendenhall River. Egan Dr impassable in multiple locations. Mendenhall wastewater treatment plant affected.</p>
        </div>
        )}
      </div>
    </div>
  );
};

export default FloodStageMenu;
