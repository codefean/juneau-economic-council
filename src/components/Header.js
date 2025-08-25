import React from 'react';
import './Header.css';
import FloodWarn from './FloodWarn';

const Header = () => {
  return (
    <header className="header">
      <div className="header-image">
        <a href="https://akcasc.org/" target="_blank" rel="noopener noreferrer">
          <img src="/ACASC2.png" alt="Alaska Climate Adaptation Science Center Logo" className="logo" />
        </a>
        <a href="https://uas.alaska.edu/" target="_blank" rel="noopener noreferrer">
          <img src="/UAS.png" alt="University of Alaska Southeast Logo" className="logo" />
        </a>
        <a href="https://nsf.gov/" target="_blank" rel="noopener noreferrer">
          <img src="/NSF.png" alt="National Science Foundation Logo" className="logo" />
        </a>
      </div>
<div class="header-title">
  <h1>Juneau Glacial Flood Dashboard</h1>
  <div class="header-subtitle">University of Alaska Southeast | Alaska Climate Adaptation Science Center</div>
</div>

      <FloodWarn />
    </header>
  );
};

export default Header;
