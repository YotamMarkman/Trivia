// src/components/game/GameResults.js
import React from 'react';
import { useSocketContext } from '../../context/SocketContext'; // To get current player's session ID

const GameResults = ({ leaderboard, onPlayAgain, onGoHome }) => {
  const { sessionInfo } = useSocketContext();
  const currentPlayerSessionId = sessionInfo?.sessionId;

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="game-results">
        <h1>Game Over!</h1>
        <p>No results to display.</p>
        <div className="results-actions">
          <button className="primary-button" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="secondary-button" onClick={onGoHome}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Find current player's stats from the leaderboard if available
  const currentPlayerStats = leaderboard.find(p => p.session_id === currentPlayerSessionId);
  const winners = leaderboard.filter(p => p.is_winner);

  return (
    <div className="game-results">
      <h1>Game Over!</h1>
      
      {winners.length > 0 && (
        <div className="winners-announcement">
          <h2>Winner{winners.length > 1 ? 's' : ''}:</h2>
          <p>{winners.map(w => w.name).join(', ')}</p>
        </div>
      )}

      {currentPlayerStats && (
        <div className="current-player-summary">
          <h3>Your Performance</h3>
          <p>Score: {currentPlayerStats.score}</p>
          {/* Add more individual stats here if available and desired, e.g., rank */}
          {currentPlayerStats.is_winner && <p className="winner-badge">Congratulations, you are a winner!</p>}
        </div>
      )}
      
      <div className="final-leaderboard">
        <h3>Final Leaderboard</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr 
                key={entry.session_id || index} // Use session_id if available, otherwise index
                className={entry.session_id === currentPlayerSessionId ? 'current-player' : ''}
              >
                <td>{index + 1}</td>
                <td>{entry.name}{entry.is_bot ? ' (Bot)' : ''}</td>
                <td>{entry.score}</td>
                <td>{entry.is_winner ? <span className="winner-tag">🏆 Winner</span> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="results-actions">
        <button className="primary-button" onClick={onPlayAgain}>
          Play Again / New Game
        </button>
        <button className="secondary-button" onClick={onGoHome}>
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default GameResults;