// src/pages/SinglePlayer.js
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import { useNavigate } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext';
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
  const { socket } = useSocketContext();
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
    answerRevealData, // New: from useGameState
    leaderboard, // New: from useGameState
    updateQuestion,
    updateTimer,
    showAnswerReveal, // New: from useGameState
    showGameResults, // New: from useGameState
    resetGame,
    score,
    feedback,
    totalQuestions
  } = useGameState(GAME_STATES.SETUP);

  useEffect(() => {
    if (!socket) {
      console.warn('SinglePlayer: Socket is null, skipping event listeners');
      setLoading(false);
      setError('Connection issue. Please refresh the page and try again.');
      return;
    }
    console.log('SinglePlayer: useEffect - Setting up event listeners. Socket ID:', socket.id);

    const clearGameStartTimeout = () => {
      if (gameStartTimeoutRef.current) {
        clearTimeout(gameStartTimeoutRef.current);
        gameStartTimeoutRef.current = null;
      }
    };

    // Define handlers
    const handleSinglePlayerStarted = (data) => {
      console.log('SinglePlayer: Received SINGLE_PLAYER_STARTED, data:', data);
      clearGameStartTimeout();
      if (data.status === 'success') {
        setLoading(false);
        setGameState(GAME_STATES.PLAYING);
        console.log('SinglePlayer: Game state set to PLAYING.');
      } else {
        setError(data.message || 'Failed to start game');
        setLoading(false);
        console.error('SinglePlayer: Error starting game - SINGLE_PLAYER_STARTED status not success:', data);
      }
    };

    const handleSinglePlayerQuestion = (data) => {
      console.log('SinglePlayer: Received SINGLE_PLAYER_QUESTION, data:', data);
      console.log('SinglePlayer: Received SINGLE_PLAYER_QUESTION, data JSON:', JSON.stringify(data)); // Added this log
      updateQuestion(data);
      console.log('SinglePlayer: Called updateQuestion.');
    };

    const handleTimerUpdate = (data) => {
      updateTimer(data.time_remaining);
    };

    const handleAnswerResult = (data) => {
      showAnswerReveal(data);
      console.log('SinglePlayer: Received ANSWER_RESULT, called showAnswerReveal with data:', data);
    };

    const handleSinglePlayerEnded = (data) => {
      showGameResults(data);
      console.log('SinglePlayer: Received SINGLE_PLAYER_ENDED, called showGameResults with data:', data);
    };

    const handleGamePaused = () => {
      setGameState(GAME_STATES.PAUSED);
    };

    const handleGameResumed = () => {
      setGameState(GAME_STATES.PLAYING);
    };

    const handleSocketErrorEvent = (errData) => { // Renamed to avoid conflict with 'error' state
      console.error('Socket error received on client:', errData);
      clearGameStartTimeout();
      setError(errData.message || 'A connection error occurred.');
      setLoading(false);
    };

    // Register listeners
    socket.on(SOCKET_EVENTS.SINGLE_PLAYER_STARTED, handleSinglePlayerStarted);
    socket.on(SOCKET_EVENTS.SINGLE_PLAYER_QUESTION, handleSinglePlayerQuestion);
    socket.on(SOCKET_EVENTS.TIMER_UPDATE, handleTimerUpdate);
    socket.on(SOCKET_EVENTS.ANSWER_RESULT, handleAnswerResult);
    socket.on(SOCKET_EVENTS.SINGLE_PLAYER_ENDED, handleSinglePlayerEnded);
    socket.on('game_paused', handleGamePaused);
    socket.on('game_resumed', handleGameResumed);
    socket.on('error', handleSocketErrorEvent);
    socket.on('connect_error', handleSocketErrorEvent);

    return () => {
      console.log('SinglePlayer: useEffect - Cleaning up event listeners. Socket ID:', socket.id);
      clearGameStartTimeout();
      // Unregister listeners using the same handler references
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_STARTED, handleSinglePlayerStarted);
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_QUESTION, handleSinglePlayerQuestion);
      socket.off(SOCKET_EVENTS.TIMER_UPDATE, handleTimerUpdate);
      socket.off(SOCKET_EVENTS.ANSWER_RESULT, handleAnswerResult);
      socket.off(SOCKET_EVENTS.SINGLE_PLAYER_ENDED, handleSinglePlayerEnded);
      socket.off('game_paused', handleGamePaused);
      socket.off('game_resumed', handleGameResumed);
      socket.off('error', handleSocketErrorEvent);
      socket.off('connect_error', handleSocketErrorEvent);
    };
  }, [socket, setGameState, updateQuestion, updateTimer, showAnswerReveal, showGameResults, setError, setLoading]); // Restored dependencies to include stable setters and critical functions from useGameState and local state setters.

  const getLayoutTitle = () => {
    switch (gameState) {
      case GAME_STATES.SETUP:
        return 'Single Player Setup';
      case GAME_STATES.PLAYING:
        return `Question ${currentQuestion?.question_number || (currentQuestion?.currentRound || 1)}`;
      case GAME_STATES.PAUSED:
        return 'Game Paused';
      case GAME_STATES.FINISHED:
        return 'Game Results';
      default:
        return 'Single Player';
    }
  };

  const getRightContent = () => {
    if (gameState === GAME_STATES.PLAYING && currentQuestion) { // Ensure currentQuestion exists
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

    if (gameStartTimeoutRef.current) {
      clearTimeout(gameStartTimeoutRef.current);
    }

    const clearGameStartTimeout = () => {
      if (gameStartTimeoutRef.current) {
        clearTimeout(gameStartTimeoutRef.current);
        gameStartTimeoutRef.current = null;
      }
    };

    gameStartTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to start game: Server did not respond in time.');
    }, 10000);

    if (!socket) {
      console.error('SinglePlayer: Cannot start game - socket is null');
      setError('Connection lost. Please refresh the page.');
      clearGameStartTimeout();
      setLoading(false);
      return;
    }

    console.log('SinglePlayer: startGame called. PlayerName:', playerName, 'Category:', category);
    socket.emit(SOCKET_EVENTS.START_SINGLE_PLAYER, {
      player_name: playerName.trim(),
      category: category
    });
    console.log('SinglePlayer: Emitted START_SINGLE_PLAYER');
  };

  const submitAnswer = (answer) => {
    if (!socket) {
      console.error('SinglePlayer: Cannot submit answer - socket is null');
      setError('Connection lost. Please refresh the page.');
      return;
    }
    socket.emit(SOCKET_EVENTS.SINGLE_PLAYER_ANSWER, { answer });
  };

  const pauseGame = () => {
    if (!socket) {
      console.error('SinglePlayer: Cannot pause game - socket is null');
      setError('Connection lost. Please refresh the page.');
      return;
    }
    socket.emit(SOCKET_EVENTS.PAUSE_SINGLE_PLAYER);
  };

  const resumeGame = () => {
    if (!socket) {
      console.error('SinglePlayer: Cannot resume game - socket is null');
      setError('Connection lost. Please refresh the page.');
      return;
    }
    socket.emit(SOCKET_EVENTS.RESUME_SINGLE_PLAYER);
  };

  const quitGame = () => {
    if (!socket) {
      console.error('SinglePlayer: Cannot quit game - socket is null');
      navigate('/');
      return;
    }
    socket.emit('quit_single_player');
    navigate('/');
  };

  const playAgain = () => {
    resetGame();
    setGameState(GAME_STATES.SETUP);
  };

  console.log('SinglePlayer: Rendering. GameState:', gameState, 'currentQuestion:', currentQuestion, 'Loading:', loading);

  // Log currentQuestionData from SinglePlayer.js's perspective during render
  // We only log if gameState is PLAYING to be specific to when QuestionDisplay would be rendered
  if (gameState === GAME_STATES.PLAYING || gameState === 'question_active') { // MODIFIED
    console.log(
      '[SinglePlayer.js] Render check. currentQuestionData:', 
      currentQuestion ? { qNum: currentQuestion.question_number, text: currentQuestion.question?.substring(0,30)+"..." } : null,
      'Game State:', gameState
    );
  }

  if (loading) {
    return (
      <GameLayout title="Loading...">
        <Loading message="Starting game..." />
      </GameLayout>
    );
  }

  return (
    <GameLayout 
      score={score} 
      timeLeft={timeRemaining} 
      questionNumber={currentQuestion?.question_number} 
      totalQuestions={totalQuestions} // Ensure totalQuestions is available
      playerName={playerName || 'Player'} 
      gameMode="Single Player"
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

      {(gameState === GAME_STATES.PLAYING || gameState === 'question_active') && currentQuestion && ( // MODIFIED
        <div className="game-area">
          <QuestionDisplay
            // Pass individual props from currentQuestion
            questionText={currentQuestion.question}
            options={currentQuestion.options}
            category={currentQuestion.category}
            currentRound={currentQuestion.question_number}
            totalRounds={currentQuestion.total_questions}
            // Other props that QuestionDisplay expects
            onAnswer={(answer) => {
              submitAnswer(answer); 
            }}
            timerValue={timeRemaining} // This seems like it was for a different version of QuestionDisplay
            showCorrectAnswer={feedback && feedback.hasOwnProperty('is_correct')} // Likely for reveal state
            isAnswerSubmitted={feedback !== null} // Likely for reveal state
            correctAnswerText={feedback?.correct_answer} // Likely for reveal state
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

      {gameState === GAME_STATES.FINISHED && (leaderboard || answerRevealData) && ( // Check for leaderboard or fallback to answerRevealData if that's what SINGLE_PLAYER_ENDED sends
        <GameResults
          results={leaderboard || answerRevealData} // Prefer leaderboard, but use answerRevealData if leaderboard is not yet populated by showGameResults
          onPlayAgain={playAgain}
          onGoHome={() => navigate('/')}
        />
      )}
    </GameLayout>
  );
};

export default SinglePlayer;