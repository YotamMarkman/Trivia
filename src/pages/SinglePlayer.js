// src/pages/SinglePlayer.js
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import useGameState from '../hooks/useGameState';
import GameLayout from '../components/layouts/GameLayout';
import QuestionDisplay from '../components/game/QuestionDisplay';
import Timer from '../components/common/Timer';
import GameResults from '../components/game/GameResults';
import Loading from '../components/common/Loading';
import CategorySelector from '../components/lobby/CategorySelector';
import { SOCKET_EVENTS, GAME_STATES } from '../utils/constants';
import '../index.css';

const SinglePlayer = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gameStartTimeoutRef = useRef(null); // Ref to store timeout ID

  const {
    gameState,
    setGameState,
    currentQuestion,
    timeRemaining,
    questionResults,
    updateQuestion,
    updateTimer,
    setResults,
    resetGame,
  } = useGameState(GAME_STATES.SETUP);

  useEffect(() => {
    // Function to clear the game start timeout
    const clearGameStartTimeout = () => {
      if (gameStartTimeoutRef.current) {
        clearTimeout(gameStartTimeoutRef.current);
        gameStartTimeoutRef.current = null;
      }
    };

    // Socket event listeners
    socket.on(SOCKET_EVENTS.SINGLE_PLAYER_STARTED, (data) => {
      clearGameStartTimeout(); // Clear timeout on receiving response
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

    // Generic error handler
    const handleSocketError = (errData) => {
      console.error('Socket error received on client:', errData);
      clearGameStartTimeout(); // Clear timeout on error
      setError(errData.message || 'A connection error occurred.');
      setLoading(false);
    };
    socket.on('error', handleSocketError); // Listen for generic 'error' events from server
    socket.on('connect_error', handleSocketError); // Listen for connection errors

    // Cleanup
    return () => {
      clearGameStartTimeout(); // Clear timeout on component unmount
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_STARTED);
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_QUESTION);
      socket.off(SOCKET_EVENTS.TIMER_UPDATE);
      socket.off(SOCKET_EVENTS.ANSWER_RESULT);
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_ENDED);
      socket.off('game_paused');
      socket.off('game_resumed');
      socket.off('error', handleSocketError);
      socket.off('connect_error', handleSocketError);
    };
  }, [setGameState, updateQuestion, updateTimer, setResults, loading, gameState]);

  // Layout title based on game state
  const getLayoutTitle = () => {
    switch (gameState) {
      case GAME_STATES.SETUP:
        return 'Single Player Setup';
      case GAME_STATES.PLAYING:
        return `Question ${currentQuestion?.question_number || 1}`;
      case GAME_STATES.PAUSED:
        return 'Game Paused';
      case GAME_STATES.FINISHED:
        return 'Game Results';
      default:
        return 'Single Player';
    }
  };

  // Right content for header (score, timer, etc.)
  const getRightContent = () => {
    if (gameState === GAME_STATES.PLAYING) {
      return (
        <div className="header-game-info">
          <div className="score">Score: {currentQuestion?.current_score || 0}</div>
          {timeRemaining > 0 && <Timer time={timeRemaining} />}
          <button className="pause-button" onClick={pauseGame}>
            Pause
          </button>
        </div>
      );
    }
    return null;
  };

  const startGame = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setError('');
    setLoading(true);

    // Clear any existing timeout
    if (gameStartTimeoutRef.current) {
      clearTimeout(gameStartTimeoutRef.current);
    }

    // Set a timeout for game start
    gameStartTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to start game: Server did not respond in time.');
    }, 10000); // 10 seconds timeout

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
    return (
      <GameLayout title="Loading...">
        <Loading message="Starting game..." />
      </GameLayout>
    );
  }

  return (
    <GameLayout 
      title={getLayoutTitle()}
      onBack={() => navigate('/')}
      rightContent={getRightContent()}
    >
      {gameState === GAME_STATES.SETUP && (
        <div className="game-setup">
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
            
            <CategorySelector 
              selectedCategory={category}
              onCategoryChange={setCategory}
            />
            
            {error && <div className="error-message">{error}</div>}
            
            <button className="primary-button" onClick={startGame}>
              Start Game
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATES.PLAYING && currentQuestion && (
        <div className="game-area">
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
    </GameLayout>
  );
};

export default SinglePlayer;