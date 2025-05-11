// src/pages/Home.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_MODES } from '../utils/constants';

const Home = () => {
  const navigate = useNavigate();

  const handleGameModeSelect = (mode) => {
    navigate(`/${mode}`);
  };

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>Welcome to Trivia Master</h1>
        <p>Test your knowledge in various categories!</p>
      </div>
      
      <div className="game-modes">
        <div className="game-mode-card" onClick={() => handleGameModeSelect(GAME_MODES.SINGLE_PLAYER)}>
          <h2>Single Player</h2>
          <p>Challenge yourself with 30 questions</p>
        </div>
        
        <div className="game-mode-card" onClick={() => handleGameModeSelect(GAME_MODES.MULTIPLAYER)}>
          <h2>Multiplayer</h2>
          <p>Compete with up to 8 players</p>
        </div>
        
        <div className="game-mode-card" onClick={() => handleGameModeSelect(GAME_MODES.HEAD_TO_HEAD)}>
          <h2>Head to Head</h2>
          <p>1v1 battles with quick matches</p>
        </div>
      </div>
      
      <div className="home-actions">
        <button 
          className="secondary-button"
          onClick={() => navigate('/leaderboard')}
        >
          View Leaderboard
        </button>
      </div>
    </div>
  );
};

export default Home;