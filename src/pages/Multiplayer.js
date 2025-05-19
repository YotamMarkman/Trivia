// src/pages/MultiPlayer.js
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import useGameState from '../hooks/useGameState';
import GameLayout from '../components/layouts/GameLayout';
import RoomCreator from '../components/lobby/RoomCreator';
import RoomJoiner from '../components/lobby/RoomJoiner';
import PlayerList from 'src/components/common/PLayerList';
import QuestionDisplay from '../components/game/QuestionDisplay';
import Scoreboard from '../components/game/Scoreboard';
import CategorySelector from '../components/lobby/CategorySelector';
import Chat from '../components/common/Chat';
import Loading from '../components/common/Loading';
import GameResults from '../components/game/GameResults';
import Timer from '../components/common/Timer';
import { SOCKET_EVENTS, GAME_STATES, CATEGORIES } from '../utils/constants';

const MultiPlayer = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('choose'); // choose, create, join, lobby, playing, finished
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [roomCategory, setRoomCategory] = useState('all');
  const operationTimeoutRef = useRef(null); // Ref for timeouts

  const {
    setGameState,
    players,
    currentQuestion,
    scores,
    timeRemaining,
    questionResults,
    updatePlayers,
    updateQuestion,
    updateScores,
    updateTimer,
    setResults,
    resetGame,
  } = useGameState();

  useEffect(() => {
    // Function to clear the operation timeout
    const clearOperationTimeout = () => {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
        operationTimeoutRef.current = null;
      }
    };

    // Get session ID once connected
    socket.on('connect', () => {
      setSessionId(socket.id);
    });

    // Room creation/joining events
    socket.on(SOCKET_EVENTS.ROOM_CREATED, (data) => {
      clearOperationTimeout();
      setRoomId(data.room_id);
      setIsHost(data.is_host);
      setRoomCategory(data.category);
      updatePlayers([data.player]);
      setMode('lobby');
      setLoading(false);
    });

    socket.on(SOCKET_EVENTS.JOINED_ROOM, (data) => {
      clearOperationTimeout();
      setRoomId(data.room_id);
      setIsHost(data.is_host);
      setRoomCategory(data.category);
      updatePlayers(data.players);
      setMode('lobby');
      setLoading(false);
    });

    socket.on(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
      updatePlayers(data.players);
    });

    socket.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
      updatePlayers(data.players);
      if (data.new_host_id === sessionId) {
        setIsHost(true);
      }
    });

    socket.on('new_host', (data) => {
      if (data.host_id === sessionId) {
        setIsHost(true);
      }
    });

    // Game events
    socket.on(SOCKET_EVENTS.GAME_STARTED, () => {
      clearOperationTimeout(); // Clear timeout if game starts successfully via host action
      setMode('playing');
      setGameState(GAME_STATES.PLAYING);
    });

    socket.on(SOCKET_EVENTS.NEW_QUESTION, (data) => {
      updateQuestion(data);
      updateTimer(data.time_limit);
      setResults(null);
    });

    socket.on(SOCKET_EVENTS.TIMER_UPDATE, (data) => {
      updateTimer(data.time_remaining);
    });

    socket.on(SOCKET_EVENTS.ANSWER_SUBMITTED, (data) => {
      if (data.status === 'success') {
        // Handle successful answer submission
      }
    });

    socket.on('question_results', (data) => {
      setResults(data);
    });

    socket.on(SOCKET_EVENTS.SCORES_UPDATE, (data) => {
      updateScores(data.scores);
    });

    socket.on(SOCKET_EVENTS.GAME_ENDED, (data) => {
      setMode('finished');
      setGameState(GAME_STATES.FINISHED);
      setResults(data);
    });

    // Category update
    socket.on('category_updated', (data) => {
      setRoomCategory(data.category);
    });

    // Error handling
    const handleSocketError = (errData) => {
      console.error('Socket error on Multiplayer page:', errData);
      clearOperationTimeout();
      setError(errData.message || 'A connection error occurred.');
      setLoading(false);
      // Potentially reset mode if error occurs during critical operations like create/join
      if (mode === 'create' || mode === 'join' || loading) {
        setMode('choose');
      }
    };
    socket.on('error', handleSocketError);
    socket.on('connect_error', handleSocketError);

    return () => {
      clearOperationTimeout();
      // Cleanup all event listeners
      socket.off('connect');
      socket.off(SOCKET_EVENTS.ROOM_CREATED);
      socket.off(SOCKET_EVENTS.JOINED_ROOM);
      socket.off(SOCKET_EVENTS.PLAYER_JOINED);
      socket.off(SOCKET_EVENTS.PLAYER_LEFT);
      socket.off('new_host');
      socket.off(SOCKET_EVENTS.GAME_STARTED);
      socket.off(SOCKET_EVENTS.NEW_QUESTION);
      socket.off(SOCKET_EVENTS.TIMER_UPDATE);
      socket.off(SOCKET_EVENTS.ANSWER_SUBMITTED);
      socket.off('question_results');
      socket.off(SOCKET_EVENTS.SCORES_UPDATE);
      socket.off(SOCKET_EVENTS.GAME_ENDED);
      socket.off('category_updated');
      socket.off('error', handleSocketError);
      socket.off('connect_error', handleSocketError);
    };
  }, [sessionId, setGameState, updatePlayers, updateQuestion, updateScores, updateTimer, setResults, mode, loading]); // Added mode and loading

  const getLayoutTitle = () => {
    switch (mode) {
      case 'choose':
        return 'Multiplayer - Choose Mode';
      case 'create':
        return 'Create Room';
      case 'join':
        return 'Join Room';
      case 'lobby':
        return `Room: ${roomId}`;
      case 'playing':
        return `Question ${currentQuestion?.question_number || 1}`;
      case 'finished':
        return 'Game Results';
      default:
        return 'Multiplayer';
    }
  };

  const getRightContent = () => {
    if (mode === 'playing' && currentQuestion) {
      return (
        <div className="header-game-info">
          <Timer time={timeRemaining} />
          <span className="question-counter">
            {currentQuestion.question_number} / {currentQuestion.total_questions}
          </span>
        </div>
      );
    }
    if (mode === 'lobby' && isHost) {
      return (
        <span className="host-badge">You are the host</span>
      );
    }
    return null;
  };

  const createRoom = (playerName, category) => {
    setLoading(true);
    setError('');
    clearOperationTimeout(); // Clear previous timeout
    operationTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to create room: Server did not respond.');
      setMode('choose');
    }, 10000); // 10 seconds timeout

    socket.emit(SOCKET_EVENTS.CREATE_ROOM, { 
      player_name: playerName, 
      category 
    });
  };

  const joinRoom = (roomId, playerName) => {
    setLoading(true);
    setError('');
    clearOperationTimeout(); // Clear previous timeout
    operationTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to join room: Server did not respond or room is invalid.');
      setMode('choose');
    }, 10000); // 10 seconds timeout

    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { 
      room_id: roomId, 
      player_name: playerName 
    });
  };

  const leaveRoom = () => {
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, {});
    resetGame();
    setMode('choose');
    setRoomId('');
    setIsHost(false);
  };

  const startGame = () => {
    if (isHost && players.length >= 1) { // Changed to 1 for testing, ideally 2
      setLoading(true); // Show loading when host tries to start
      setError('');
      clearOperationTimeout();
      operationTimeoutRef.current = setTimeout(() => {
        setLoading(false);
        setError('Failed to start game: Server did not respond.');
        // Mode remains 'lobby' or as is, host might need to retry
      }, 10000);
      socket.emit(SOCKET_EVENTS.START_GAME, {});
    } else if (isHost) {
      setError('Cannot start game. Need at least 1 other player (or adjust settings for bots).');
    }
  };

  const submitAnswer = (answer) => {
    socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { answer });
  };

  const handleBackToHome = () => {
    if (mode === 'lobby' || mode === 'playing') {
      leaveRoom();
    }
    navigate('/');
  };

  const changeCategory = (newCategory) => {
    if (isHost) {
      socket.emit('change_category', { category: newCategory });
      setRoomCategory(newCategory);
    }
  };

  if (loading) {
    return (
      <GameLayout title="Loading...">
        <Loading message="Connecting..." />
      </GameLayout>
    );
  }

  return (
    <GameLayout 
      title={getLayoutTitle()}
      onBack={handleBackToHome}
      rightContent={getRightContent()}
    >
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {mode === 'choose' && (
        <div className="mode-selection">
          <h2>Multiplayer Mode</h2>
          <div className="mode-options">
            <button 
              className="mode-button"
              onClick={() => setMode('create')}
            >
              Create New Room
            </button>
            <button 
              className="mode-button"
              onClick={() => setMode('join')}
            >
              Join Existing Room
            </button>
          </div>
          <button 
            className="back-button"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
      )}

      {mode === 'create' && (
        <RoomCreator 
          onCreateRoom={createRoom} 
          onBack={() => setMode('choose')}
        />
      )}

      {mode === 'join' && (
        <RoomJoiner 
          onJoinRoom={joinRoom}
          onBack={() => setMode('choose')}
        />
      )}

      {mode === 'lobby' && (
        <div className="lobby">
          <div className="lobby-header">
            <h2>Game Lobby</h2>
            <div className="room-info">
              <div className="room-code-container">
                <span>Room Code: </span>
                <span className="room-code">{roomId}</span>
              </div>
              <div className="category-info">
                <span>Category: </span>
                <span className="category-name">
                  {CATEGORIES.find(cat => cat.value === roomCategory)?.label || 'All Categories'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="lobby-content">
            <PlayerList 
              players={players} 
              hostId={players.find(p => p.is_host)?.session_id || players.find(p => p.session_id === sessionId)?.session_id}
              currentPlayerId={sessionId}
            />
            
            <div className="lobby-actions">
              {isHost && (
                <>
                  <CategorySelector 
                    selectedCategory={roomCategory}
                    onCategoryChange={changeCategory}
                    disabled={players.length > 1} // Disable if other players have joined
                  />
                  <button 
                    className="primary-button"
                    onClick={startGame}
                    disabled={players.length < 2}
                  >
                    {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
                  </button>
                </>
              )}
              {!isHost && (
                <p className="waiting-message">
                  Waiting for host to start the game...
                </p>
              )}
              <button 
                className="secondary-button"
                onClick={leaveRoom}
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'playing' && (
        <div className="game-area">
          <div className="game-layout">
            <div className="game-main">
              {currentQuestion && (
                <QuestionDisplay
                  question={currentQuestion}
                  onAnswer={submitAnswer}
                  showResult={questionResults}
                />
              )}
            </div>
            
            <div className="game-sidebar">
              <Scoreboard 
                scores={scores}
                currentQuestion={currentQuestion?.question_number}
                totalQuestions={currentQuestion?.total_questions}
              />
              <Chat roomId={roomId} />
            </div>
          </div>
        </div>
      )}

      {mode === 'finished' && (
        <GameResults
          results={questionResults}
          onPlayAgain={() => {
            resetGame();
            setMode('lobby');
          }}
          onGoHome={handleBackToHome}
        />
      )}
    </GameLayout>
  );
};

export default MultiPlayer;