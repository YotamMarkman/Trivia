// src/App.js
import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthContext, AuthProvider } from './context/AuthContext'; 
import { SocketProvider } from './context/SocketContext'; 
import MainLayout from './components/layouts/MainLayout';
import Home from './pages/Home';
import SinglePlayer from './pages/SinglePlayer';
import MultiPlayer from './pages/Multiplayer';
import HeadToHead from './pages/HeadToHead';
import Leaderboard from './pages/Leaderboard';
import NotFound from './pages/NotFound';
import SocketTester from './components/common/SocketTester';

function AppContent() {
  const location = useLocation();
  const { token, isAuthenticated } = useContext(AuthContext);

  return (
    <SocketProvider token={token} isAuthenticated={isAuthenticated}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="single-player" element={<SinglePlayer />} />
            <Route path="multiplayer" element={<MultiPlayer />} />
            <Route path="head-to-head" element={<HeadToHead />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="socket-test" element={<SocketTester />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AnimatePresence>
    </SocketProvider>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;