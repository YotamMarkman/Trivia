// src/pages/MultiPlayer.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext';
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
import { SOCKET_EVENTS, CATEGORIES } from '../utils/constants';

const MultiPlayer = () => {
  const navigate = useNavigate();
  const { socket, sessionInfo, connectSocket, disconnectSocket } = useSocketContext();
  const [uiMode, setUiMode] = useState('choose');
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomCategory, setRoomCategory] = useState('all');
  const operationTimeoutRef = useRef(null);

  const {
    gameState,
    setGameState,
    gameId,
    setGameId,
    players,
    updatePlayers,
    currentQuestion,
    updateQuestion,
    scores,
    updateScores,
    timeRemaining,
    updateTimer,
    answerRevealData,
    showAnswerReveal,
    leaderboard,
    showGameResults,
    currentRound,
    totalRounds,
    gameMessage,
    setGameMessage,
    resetGame,
  } = useGameState();

  const clearOperationTimeout = useCallback(() => {
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current);
      operationTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleRoomCreated = (data) => {
      clearOperationTimeout();
      setGameId(data.room_id);
      setIsHost(data.is_host);
      setRoomCategory(data.category);
      updatePlayers([data.player]);
      setUiMode('lobby');
      setLoading(false);
      setGameMessage(`Room ${data.room_id} created. Waiting for players...`);
    };

    const handleJoinedRoom = (data) => {
      clearOperationTimeout();
      setGameId(data.room_id);
      setIsHost(data.is_host);
      setRoomCategory(data.category);
      updatePlayers(data.players);
      setUiMode('lobby');
      setLoading(false);
      setGameMessage(`Joined room ${data.room_id}. Waiting for game to start.`);
    };

    const handlePlayerJoined = (data) => {
      updatePlayers(data.players);
      setGameMessage(`${data.player_name} joined the room.`);
    };

    const handlePlayerLeft = (data) => {
      updatePlayers(data.players);
      if (data.new_host_id === sessionInfo?.sessionId) {
        setIsHost(true);
        setGameMessage('You are now the host.');
      }
      setGameMessage(`${data.player_name} left the room.`);
    };

    const handleNewHost = (data) => {
      if (data.host_id === sessionInfo?.sessionId) {
        setIsHost(true);
        setGameMessage('You have been assigned as the new host.');
      } else {
        const newHostPlayer = players.find(p => p.id === data.host_id);
        setGameMessage(newHostPlayer ? `${newHostPlayer.name} is the new host.` : 'Host changed.');
      }
    };

    const handleGameStarted = (initialGameData) => {
      clearOperationTimeout();
      setLoading(false);
      if (initialGameData && initialGameData.question) {
        updateQuestion(initialGameData);
      } else {
        setGameState('question_active');
        setGameMessage("Game started! First question incoming...");
      }
    };

    const handleNewQuestion = (questionData) => {
      updateQuestion(questionData);
    };

    const handleTimerUpdate = (data) => {
      updateTimer(data.time_remaining);
    };

    const handleAnswerSubmitted = (data) => {
      if (data.status === 'success') {
        setGameMessage('Answer submitted!');
      } else {
        setError(data.message || 'Failed to submit answer.');
      }
    };

    const handleAnswerReveal = (revealData) => {
      showAnswerReveal(revealData);
      if (revealData.updatedOverallScores) {
        updateScores(revealData.updatedOverallScores);
      }
      setGameMessage('Time up! Revealing answers...');
    };

    const handleScoresUpdate = (data) => {
      updateScores(data.scores);
    };

    const handleGameOver = (finalLeaderboard) => {
      showGameResults(finalLeaderboard);
      setUiMode('finished');
      setGameMessage('Game Over! View the results.');
    };

    const handleCategoryUpdated = (data) => {
      setRoomCategory(data.category);
      setGameMessage(`Category changed to ${CATEGORIES.find(c => c.value === data.category)?.label || data.category}`);
    };

    const handleSocketError = (errData) => {
      console.error('Socket error on Multiplayer page:', errData);
      clearOperationTimeout();
      setError(errData.message || 'A connection or server error occurred.');
      setLoading(false);
      if (uiMode === 'create' || uiMode === 'join' || loading) {
        setUiMode('choose');
      }
    };

    socket.on(SOCKET_EVENTS.ROOM_CREATED, handleRoomCreated);
    socket.on(SOCKET_EVENTS.JOINED_ROOM, handleJoinedRoom);
    socket.on(SOCKET_EVENTS.PLAYER_JOINED, handlePlayerJoined);
    socket.on(SOCKET_EVENTS.PLAYER_LEFT, handlePlayerLeft);
    socket.on('new_host', handleNewHost);
    socket.on(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
    socket.on(SOCKET_EVENTS.NEW_QUESTION, handleNewQuestion);
    socket.on(SOCKET_EVENTS.TIMER_UPDATE, handleTimerUpdate);
    socket.on(SOCKET_EVENTS.ANSWER_SUBMITTED_CONFIRMATION, handleAnswerSubmitted);
    socket.on(SOCKET_EVENTS.ANSWER_REVEAL, handleAnswerReveal);
    socket.on(SOCKET_EVENTS.SCORES_UPDATE, handleScoresUpdate);
    socket.on(SOCKET_EVENTS.GAME_OVER, handleGameOver);
    socket.on('category_updated', handleCategoryUpdated);
    socket.on('error', handleSocketError);

    return () => {
      clearOperationTimeout();
      socket.off(SOCKET_EVENTS.ROOM_CREATED, handleRoomCreated);
      socket.off(SOCKET_EVENTS.JOINED_ROOM, handleJoinedRoom);
      socket.off(SOCKET_EVENTS.PLAYER_JOINED, handlePlayerJoined);
      socket.off(SOCKET_EVENTS.PLAYER_LEFT, handlePlayerLeft);
      socket.off('new_host', handleNewHost);
      socket.off(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
      socket.off(SOCKET_EVENTS.NEW_QUESTION, handleNewQuestion);
      socket.off(SOCKET_EVENTS.TIMER_UPDATE, handleTimerUpdate);
      socket.off(SOCKET_EVENTS.ANSWER_SUBMITTED_CONFIRMATION, handleAnswerSubmitted);
      socket.off(SOCKET_EVENTS.ANSWER_REVEAL, handleAnswerReveal);
      socket.off(SOCKET_EVENTS.SCORES_UPDATE, handleScoresUpdate);
      socket.off(SOCKET_EVENTS.GAME_OVER, handleGameOver);
      socket.off('category_updated', handleCategoryUpdated);
      socket.off('error', handleSocketError);
    };
  }, [
    socket,
    sessionInfo,
    clearOperationTimeout,
    setGameId, updatePlayers, setRoomCategory,
    updateQuestion, updateTimer, showAnswerReveal, updateScores, showGameResults,
    setGameState, setGameMessage, resetGame, uiMode, loading, players
  ]);

  const getLayoutTitle = () => {
    if (gameState === 'question_active' || gameState === 'answer_reveal') {
      return `Round ${currentRound} / ${totalRounds}`;
    }
    if (gameState === 'game_over' || uiMode === 'finished') {
      return 'Game Results';
    }
    switch (uiMode) {
      case 'choose': return 'Multiplayer - Choose Mode';
      case 'create': return 'Create Room';
      case 'join': return 'Join Room';
      case 'lobby': return gameId ? `Room: ${gameId}` : 'Lobby';
      default: return 'Multiplayer Trivia';
    }
  };

  const getRightContent = () => {
    if (gameState === 'question_active') {
      return (
        <div className="header-game-info">
          <Timer time={timeRemaining} />
          <span className="question-counter">
            Question {currentRound} / {totalRounds}
          </span>
        </div>
      );
    }
    if (uiMode === 'lobby' && isHost) {
      return <span className="host-badge">You are the host</span>;
    }
    return null;
  };

  const createRoom = (playerName, category) => {
    if (!socket) { setError("Not connected to server."); return; }
    setLoading(true);
    setError('');
    clearOperationTimeout();
    operationTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to create room: Server did not respond.');
      setUiMode('choose');
    }, 10000);
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, { player_name: playerName, category });
  };

  const joinRoom = (roomIdToJoin, playerName) => {
    if (!socket) { setError("Not connected to server."); return; }
    setLoading(true);
    setError('');
    clearOperationTimeout();
    operationTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to join room: Server did not respond or room is invalid.');
      setUiMode('choose');
    }, 10000);
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { room_id: roomIdToJoin, player_name: playerName });
  };

  const leaveRoom = () => {
    if (socket) socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { room_id: gameId });
    resetGame();
    setUiMode('choose');
    setGameId('');
    setIsHost(false);
    setError('');
    setGameMessage('');
  };

  const startGame = () => {
    if (!socket) { setError("Not connected to server."); return; }
    if (isHost && players.length >= 1) {
      setLoading(true);
      setError('');
      clearOperationTimeout();
      operationTimeoutRef.current = setTimeout(() => {
        setLoading(false);
        setError('Failed to start game: Server did not respond.');
      }, 10000);
      socket.emit(SOCKET_EVENTS.START_GAME, { room_id: gameId });
    } else if (isHost) {
      setError('Need at least 1 player (or ensure bots are enabled server-side).');
    }
  };

  const submitAnswer = (answer) => {
    if (!socket) { setError("Not connected to server."); return; }
    socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { room_id: gameId, answer });
    setGameMessage('Submitting answer...');
  };

  const handleBackToHome = () => {
    if (uiMode === 'lobby' || gameState !== 'waiting') {
      leaveRoom();
    }
    navigate('/');
  };

  const changeCategory = (newCategory) => {
    if (!socket) { setError("Not connected to server."); return; }
    if (isHost) {
      socket.emit('change_category', { room_id: gameId, category: newCategory });
    }
  };

  if (!socket && !sessionInfo) {
    return (
      <GameLayout title="Connecting...">
        <Loading message="Initializing connection..." />
      </GameLayout>
    );
  }

  if (loading && (uiMode === 'create' || uiMode === 'join')) {
    return (
      <GameLayout title="Loading...">
        <Loading message={uiMode === 'create' ? "Creating room..." : "Joining room..."} />
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
      {gameMessage && <div className="game-message-banner">{gameMessage}</div>}

      {uiMode === 'choose' && gameState === 'waiting' && (
        <div className="mode-selection">
          <h2>Multiplayer Mode</h2>
          <div className="mode-options">
            <button className="mode-button" onClick={() => setUiMode('create')}>Create New Room</button>
            <button className="mode-button" onClick={() => setUiMode('join')}>Join Existing Room</button>
          </div>
          <button className="back-button" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      )}

      {uiMode === 'create' && gameState === 'waiting' && (
        <RoomCreator onCreateRoom={createRoom} onBack={() => setUiMode('choose')} />
      )}

      {uiMode === 'join' && gameState === 'waiting' && (
        <RoomJoiner onJoinRoom={joinRoom} onBack={() => setUiMode('choose')} />
      )}

      {uiMode === 'lobby' && gameState === 'waiting' && (
        <div className="lobby">
          <div className="lobby-header">
            <h2>Game Lobby</h2>
            <div className="room-info">
              <div className="room-code-container"><span>Room Code: </span><span className="room-code">{gameId}</span></div>
              <div className="category-info"><span>Category: </span><span className="category-name">{CATEGORIES.find(cat => cat.value === roomCategory)?.label || 'All Categories'}</span></div>
            </div>
          </div>
          <div className="lobby-content">
            <PlayerList players={players} hostId={players.find(p => p.is_host)?.id} currentPlayerId={sessionInfo?.sessionId} />
            <div className="lobby-actions">
              {isHost && (
                <>
                  <CategorySelector selectedCategory={roomCategory} onCategoryChange={changeCategory} disabled={players.length > 1 && gameState !== 'waiting'} />
                  <button className="primary-button" onClick={startGame} disabled={players.length < 1}>
                    {players.length < 1 ? 'Waiting for players...' : 'Start Game'}
                  </button>
                </>
              )}
              {!isHost && <p className="waiting-message">Waiting for host to start the game...</p>}
              <button className="secondary-button" onClick={leaveRoom}>Leave Room</button>
            </div>
          </div>
          <Chat roomId={gameId} />
        </div>
      )}

      {gameState === 'question_active' && currentQuestion && (
        <div className="game-area">
          <div className="game-layout">
            <div className="game-main">
              <QuestionDisplay
                question={currentQuestion.question}
                options={currentQuestion.options}
                onAnswer={submitAnswer}
              />
            </div>
            <div className="game-sidebar">
              <Scoreboard scores={scores} currentQuestion={currentRound} totalQuestions={totalRounds} />
              <Chat roomId={gameId} />
            </div>
          </div>
        </div>
      )}

      {gameState === 'answer_reveal' && answerRevealData && (
        <div className="game-area">
          <div className="game-layout">
            <div className="game-main">
              <QuestionDisplay
                question={currentQuestion.question}
                options={currentQuestion.options}
                onAnswer={() => {}}
                isRevealState={true}
                revealData={answerRevealData}
              />
            </div>
            <div className="game-sidebar">
              <Scoreboard scores={scores} currentQuestion={currentRound} totalQuestions={totalRounds} />
              <Chat roomId={gameId} />
            </div>
          </div>
        </div>
      )}

      {(gameState === 'game_over' || uiMode === 'finished') && leaderboard && (
        <GameResults
          leaderboard={leaderboard}
          onPlayAgain={() => {
            if (socket) socket.emit(SOCKET_EVENTS.REQUEST_REMATCH, { room_id: gameId });
            resetGame();
            setUiMode('lobby');
            setGameMessage(isHost ? "Requesting a new game in this room..." : "Waiting for host to start a new game...");
          }}
          onGoHome={handleBackToHome}
        />
      )}
    </GameLayout>
  );
};

export default MultiPlayer;