import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import HomePage from './pages/Home';
import SinglePlayerPage from './pages/SinglePlayer';
import HeadToHeadPage from './pages/HeadToHead';
import MultiplayerPage from './pages/Multiplayer';
import LeaderboardPage from './pages/Leaderboard';
import NotFoundPage from './pages/NotFound';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import { AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

function App() {
  const { user, logout, loading, isAuthenticated } = useContext(AuthContext);

  if (loading) {
    return <div>Loading application...</div>;
  }

  return (
    <SocketProvider token={localStorage.getItem('userToken')} isAuthenticated={isAuthenticated}>
      <Router>
        <div className="App">
          <nav>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/singleplayer">Single Player</Link></li>
              <li><Link to="/head-to-head">Head-to-Head</Link></li>
              <li><Link to="/multiplayer">Multiplayer</Link></li>
              <li><Link to="/leaderboard">Leaderboard</Link></li>
              {isAuthenticated ? (
                <>
                  <li><Link to="/profile">My Profile</Link></li>
                  <li><button onClick={logout}>Logout ({user?.username})</button></li>
                </>
              ) : (
                <>
                  <li><Link to="/login">Login</Link></li>
                  <li><Link to="/register">Register</Link></li>
                </>
              )}
            </ul>
          </nav>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
            <Route path="/singleplayer" element={isAuthenticated ? <SinglePlayerPage /> : <Navigate to="/login" />} />
            <Route path="/head-to-head" element={isAuthenticated ? <HeadToHeadPage /> : <Navigate to="/login" />} />
            <Route path="/multiplayer" element={isAuthenticated ? <MultiplayerPage /> : <Navigate to="/login" />} />
            <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;