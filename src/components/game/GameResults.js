// src/components/game/GameResults.js
import React from 'react';

const GameResults = ({ results, onPlayAgain, onGoHome }) => {
  const {
    final_score,
    leaderboard_position,
    total_questions,
    correct_answers,
    accuracy,
    leaderboard = []
  } = results;

  return (
    <div className="game-results">
      <h1>Game Over!</h1>
      
      <div className="results-summary">
        <div className="score-display">
          <h2>Final Score</h2>
          <div className="score-value">{final_score}</div>
        </div>
        
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Questions Answered</span>
            <span className="stat-value">{total_questions}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Correct Answers</span>
            <span className="stat-value">{correct_answers}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{accuracy.toFixed(1)}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Leaderboard Position</span>
            <span className="stat-value">#{leaderboard_position}</span>
          </div>
        </div>
      </div>
      
      {leaderboard.length > 0 && (
        <div className="mini-leaderboard">
          <h3>Top 10 Players</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr 
                  key={entry.rank}
                  className={entry.player_name === results.player_name ? 'current-player' : ''}
                >
                  <td>#{entry.rank}</td>
                  <td>{entry.player_name}</td>
                  <td>{entry.score}</td>
                  <td>{entry.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
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
};

export default GameResults;