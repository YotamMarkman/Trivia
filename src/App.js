// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'; // Import useLocation
import { AnimatePresence } from 'framer-motion';
import useSocket from './hooks/useSocket';
import MainLayout from './components/layouts/MainLayout';
import Home from './pages/Home';
import SinglePlayer from './pages/SinglePlayer';
import MultiPlayer from './pages/Multiplayer';
import HeadToHead from './pages/HeadToHead';
import Leaderboard from './pages/Leaderboard';
import NotFound from './pages/NotFound';

function AppContent() { // Create a new component to use useLocation
  const location = useLocation(); // Get location here
  useSocket();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}> {/* Pass location and key to Routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="single-player" element={<SinglePlayer />} />
          <Route path="multiplayer" element={<MultiPlayer />} />
          <Route path="head-to-head" element={<HeadToHead />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <AppContent /> {/* Render the new component */}
    </Router>
  );
}

export default App;