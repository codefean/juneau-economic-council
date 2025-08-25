import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Navigation.css";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="navigation">
      <span className="menu-toggle" onClick={toggleMenu}>
        ☰
      </span>
      <ul className={isMenuOpen ? "open" : ""}>
      <li>
          <NavLink
            to="/home"
            className={({ isActive }) => (isActive ? "active-link" : "")}
          >
            Home
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/flood-map"
            className={({ isActive }) => (isActive ? "active-link" : "")}
          >
            Flood Maps
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/flood-forecast"
            className={({ isActive }) => (isActive ? "active-link" : "")}
          >
            Flood Forecasting
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/flood-events"
            className={({ isActive }) => (isActive ? "active-link" : "")}
          >
            Flood Events
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/suicide-basin"
            className={({ isActive }) => (isActive ? "active-link" : "")}
          >
            Suicide Basin
          </NavLink>
        </li>

        

      </ul>
    </nav>
  );
};

export default Navigation;

