// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import useSocket from './hooks/useSocket';
import MainLayout from './components/layouts/MainLayout';
import Home from './pages/Home';
import SinglePlayer from './pages/SinglePlayer';
import MultiPlayer from './pages/Multiplayer';
import HeadToHead from './pages/HeadToHead';
import Leaderboard from './pages/Leaderboard';
import NotFound from './pages/NotFound';

function App() {
  // Initialize socket connection when app starts
  useSocket();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="single-player" element={<SinglePlayer />} />
          <Route path="multiplayer" element={<MultiPlayer />} />
          <Route path="head-to-head" element={<HeadToHead />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;