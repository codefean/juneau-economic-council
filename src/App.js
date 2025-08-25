import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import FloodLevels from './pages/FloodLevels.js';
import Footer from './components/Footer';

const useDocumentTitle = (title) => {
  React.useEffect(() => {
    document.title = title;
  }, [title]);
};

const FloodLevelsPage = () => {
  useDocumentTitle("Juneau Flood Maps");
  return <FloodLevels />;
};

function App() {
  return (
    <Router>
      <div className="app-container">
        <div className="main-content">
          <Routes>
            {/* Default homepage */}
            <Route path="/" element={<FloodLevelsPage />} />
            {/* Optional: keep the /flood-map alias */}
            <Route path="/flood-map" element={<FloodLevelsPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
