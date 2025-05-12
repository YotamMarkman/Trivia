// src/components/game/Scoreboard.js
import React from 'react';

const Scoreboard = ({ scores, currentQuestion, totalQuestions }) => {
  return (
    <div className="scoreboard">
      <div className="scoreboard-header">
        <h3>Leaderboard</h3>
        <span className="question-counter">
          Question {currentQuestion} of {totalQuestions}
        </span>
      </div>
      
      <div className="scores-list">
        {scores.map((player, index) => (
          <div key={player.session_id} className="score-item">
            <div className="rank">{index + 1}</div>
            <div className="player-info">
              <span className="player-name">{player.name}</span>
              {player.answered && (
                <span className="answered-indicator">✓</span>
              )}
            </div>
            <div className="score">{player.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Scoreboard;