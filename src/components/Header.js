import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      {/* Left Logo */}
      <div className="header-image left">
        <a href="https://JEDC.org/" target="_blank" rel="noopener noreferrer">
          <img
            src={`${process.env.PUBLIC_URL}/JEDC3.png`}
            alt="Juneau Economic Development Council"
            className="logo"
          />
        </a>
      </div>

      {/* Title */}
      <div className="header-title">
        <h1>
          Juneau Glacial Flood Dashboard
          <span className="business-edition"> | Business Edition</span>
        </h1>
      </div>

      {/* Right Logo */}
      <div className="header-image right">
        <a href="https://UAS.edu/" target="_blank" rel="noopener noreferrer">
          <img
            src={`${process.env.PUBLIC_URL}/UAS.png`}
            alt="University of Alaska Southeast"
            className="logo"
          />
        </a>
      </div>
    </header>
  );
};

export default Header;
