// src/pages/SinglePlayer.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import useGameState from '../hooks/useGameState';
import QuestionDisplay from '../components/game/QuestionDisplay';
import Timer from '../components/common/Timer';
import GameResults from '../components/game/GameResults';
import Loading from '../components/common/Loading';
import { SOCKET_EVENTS, GAME_STATES, CATEGORIES } from '../utils/constants';

const SinglePlayer = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const {
    gameState,
    setGameState,
    currentQuestion,
    scores,
    timeRemaining,
    questionResults,
    updateQuestion,
    updateTimer,
    setResults,
    resetGame,
  } = useGameState(GAME_STATES.SETUP);

  useEffect(() => {
    // Socket event listeners
    socket.on(SOCKET_EVENTS.SINGLE_PLAYER_STARTED, (data) => {
      if (data.status === 'success') {
        setGameState(GAME_STATES.PLAYING);
        setLoading(false);
      } else {
        setError(data.message || 'Failed to start game');
        setLoading(false);
      }
    });

    socket.on(SOCKET_EVENTS.SINGLE_PLAYER_QUESTION, (data) => {
      updateQuestion(data);
      updateTimer(data.time_limit);
    });

    socket.on(SOCKET_EVENTS.TIMER_UPDATE, (data) => {
      updateTimer(data.time_remaining);
    });

    socket.on(SOCKET_EVENTS.ANSWER_RESULT, (data) => {
      setResults(data);
    });

    socket.on(SOCKET_EVENTS.SINGLE_PLAYER_ENDED, (data) => {
      setGameState(GAME_STATES.FINISHED);
      setResults(data);
    });

    socket.on('game_paused', () => {
      setGameState(GAME_STATES.PAUSED);
    });

    socket.on('game_resumed', () => {
      setGameState(GAME_STATES.PLAYING);
    });

    // Cleanup
    return () => {
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_STARTED);
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_QUESTION);
      socket.off(SOCKET_EVENTS.TIMER_UPDATE);
      socket.off(SOCKET_EVENTS.ANSWER_RESULT);
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_ENDED);
      socket.off('game_paused');
      socket.off('game_resumed');
    };
  }, [setGameState, updateQuestion, updateTimer, setResults]);

  const startGame = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setError('');
    setLoading(true);
    socket.emit(SOCKET_EVENTS.START_SINGLE_PLAYER, {
      player_name: playerName.trim(),
      category: category
    });
  };

  const submitAnswer = (answer) => {
    socket.emit(SOCKET_EVENTS.SINGLE_PLAYER_ANSWER, { answer });
  };

  const pauseGame = () => {
    socket.emit(SOCKET_EVENTS.PAUSE_SINGLE_PLAYER);
  };

  const resumeGame = () => {
    socket.emit(SOCKET_EVENTS.RESUME_SINGLE_PLAYER);
  };

  const quitGame = () => {
    socket.emit('quit_single_player');
    navigate('/');
  };

  const playAgain = () => {
    resetGame();
    setGameState(GAME_STATES.SETUP);
  };

  if (loading) {
    return <Loading message="Starting game..." />;
  }

  return (
    <div className="single-player-container">
      {gameState === GAME_STATES.SETUP && (
        <div className="game-setup">
          <h2>Single Player Mode</h2>
          <div className="setup-form">
            <div className="form-group">
              <label htmlFor="playerName">Your Name</label>
              <input
                id="playerName"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <button className="primary-button" onClick={startGame}>
              Start Game
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATES.PLAYING && currentQuestion && (
        <div className="game-area">
          <div className="game-header">
            <Timer time={timeRemaining} />
            <div className="score">Score: {currentQuestion.current_score || 0}</div>
            <button className="pause-button" onClick={pauseGame}>
              Pause
            </button>
          </div>
          
          <QuestionDisplay
            question={currentQuestion}
            onAnswer={submitAnswer}
            showResult={questionResults}
          />
        </div>
      )}

      {gameState === GAME_STATES.PAUSED && (
        <div className="paused-screen">
          <h2>Game Paused</h2>
          <p>Take a break! Your progress is saved.</p>
          <div className="pause-actions">
            <button className="primary-button" onClick={resumeGame}>
              Resume
            </button>
            <button className="secondary-button" onClick={quitGame}>
              Quit Game
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATES.FINISHED && questionResults && (
        <GameResults
          results={questionResults}
          onPlayAgain={playAgain}
          onGoHome={() => navigate('/')}
        />
      )}
    </div>
  );
};

export default SinglePlayer;