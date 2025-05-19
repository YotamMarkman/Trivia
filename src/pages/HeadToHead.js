// src/pages/HeadToHead.js
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import useGameState from '../hooks/useGameState';
import GameLayout from '../components/layouts/GameLayout';
import QuestionDisplay from '../components/game/QuestionDisplay';
import Timer from '../components/common/Timer';
import Loading from '../components/common/Loading';
import { SOCKET_EVENTS, MAX_PLAYER_NAME_LENGTH, ROOM_CODE_LENGTH } from '../utils/constants';

const HeadToHead = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('choose'); // choose, queuing, private, waiting, playing, finished
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [queuePosition, setQueuePosition] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const operationTimeoutRef = useRef(null); // Ref for timeouts

  const {
    currentQuestion,
    timeRemaining,
    questionResults,
    updateQuestion,
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

    // Matchmaking events
    socket.on(SOCKET_EVENTS.QUEUE_STATUS, (data) => {
      clearOperationTimeout(); // Clear timeout if we get a queue status update
      if (data.status === 'queued') {
        setQueuePosition(data.position);
      } else if (data.status === 'already_queued') {
        setError('Already in queue');
      }
    });

    socket.on(SOCKET_EVENTS.MATCH_FOUND, (data) => {
      clearOperationTimeout();
      setMode('playing');
      setLoading(false);
      setRoomCode(data.room_id);
    });

    socket.on('queue_cancelled', () => {
      clearOperationTimeout();
      setMode('choose');
      setQueuePosition(0);
    });

    // Private room events
    socket.on(SOCKET_EVENTS.PRIVATE_ROOM_CREATED, (data) => {
      clearOperationTimeout();
      setRoomCode(data.room_code);
      setMode('waiting');
      setLoading(false);
    });

    socket.on(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
      clearOperationTimeout(); // Opponent joined, clear timeout if host was waiting
      if (data.players.length === 2) {
        // Find the other player
      }
    });

    socket.on('ready_to_start', () => {
      clearOperationTimeout(); // Game is ready, clear any waiting timeout
      setMode('playing');
    });

    // Game events
    socket.on('head_to_head_started', (data) => {
      clearOperationTimeout(); // Game started, clear any pending timeouts
      setMode('playing');
    });

    socket.on('head_to_head_question', (data) => {
      updateQuestion(data);
      updateTimer(data.time_limit);
    });

    socket.on(SOCKET_EVENTS.TIMER_UPDATE, (data) => {
      updateTimer(data.time_remaining);
    });

    socket.on('head_to_head_scores', (data) => {
      setResults({
        player1: data.player1,
        player2: data.player2,
        score_difference: data.score_difference,
        leader: data.leader,
        questions_remaining: data.questions_remaining
      });
    });

    socket.on('head_to_head_question_results', (data) => {
      setResults({
        ...data,
        comparison: true
      });
    });

    socket.on('head_to_head_ended', (data) => {
      setMode('finished');
      setResults(data);
    });

    socket.on('rematch_started', (data) => {
      resetGame();
      setMode('playing');
    });

    // Error handling
    const handleSocketError = (errData) => {
      console.error('Socket error on HeadToHead page:', errData);
      clearOperationTimeout();
      setError(errData.message || 'A connection error occurred.');
      setLoading(false);
      // Reset to choose mode if error is critical during setup/connection phases
      if (['choose', 'queuing', 'private', 'waiting'].includes(mode) || loading) {
        setMode('choose');
        setQueuePosition(0);
      }
    };
    socket.on('error', handleSocketError);
    socket.on('connect_error', handleSocketError);

    return () => {
      clearOperationTimeout();
      // Cleanup
      socket.off(SOCKET_EVENTS.QUEUE_STATUS);
      socket.off(SOCKET_EVENTS.MATCH_FOUND);
      socket.off('queue_cancelled');
      socket.off(SOCKET_EVENTS.PRIVATE_ROOM_CREATED);
      socket.off(SOCKET_EVENTS.PLAYER_JOINED);
      socket.off('ready_to_start');
      socket.off('head_to_head_started');
      socket.off('head_to_head_question');
      socket.off(SOCKET_EVENTS.TIMER_UPDATE);
      socket.off('head_to_head_scores');
      socket.off('head_to_head_question_results');
      socket.off('head_to_head_ended');
      socket.off('rematch_started');
      socket.off('error', handleSocketError);
      socket.off('connect_error', handleSocketError);
    };
  }, [updateQuestion, updateTimer, setResults, resetGame, mode, loading]); // Added mode and loading

  const getLayoutTitle = () => {
    switch (mode) {
      case 'choose':
        return 'Head to Head - Setup';
      case 'queuing':
        return 'Finding Opponent...';
      case 'waiting':
        return 'Waiting for Opponent';
      case 'playing':
        return 'Head to Head Match';
      case 'finished':
        return 'Match Results';
      default:
        return 'Head to Head';
    }
  };

  const getRightContent = () => {
    if (mode === 'playing') {
      return (
        <div className="header-game-info">
          <Timer time={timeRemaining} totalTime={10} />
          <span className="question-counter">
            {currentQuestion?.question_number} / {currentQuestion?.total_questions}
          </span>
        </div>
      );
    }
    if (mode === 'waiting') {
      return (
        <div className="room-code-display">{roomCode}</div>
      );
    }
    return null;
  };

  const queueForMatch = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setLoading(true);
    setError('');
    clearOperationTimeout();
    operationTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to join queue: Server did not respond.');
      setMode('choose');
    }, 15000); // 15 seconds timeout for matchmaking queue join

    socket.emit('queue_head_to_head', { 
      player_name: playerName.trim() 
    });
    setMode('queuing');
  };

  const cancelQueue = () => {
    socket.emit('cancel_queue');
    setMode('choose');
    setQueuePosition(0);
  };

  const createPrivateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setLoading(true);
    setError('');
    clearOperationTimeout();
    operationTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to create private room: Server did not respond.');
      setMode('choose');
    }, 10000); // 10 seconds timeout

    socket.emit('create_private_head_to_head', { 
      player_name: playerName.trim() 
    });
  };

  const joinPrivateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!roomCode.trim() || roomCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    
    setLoading(true);
    setError('');
    clearOperationTimeout();
    operationTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Failed to join private room: Server did not respond or room code is invalid.');
      setMode('choose');
    }, 10000); // 10 seconds timeout

    socket.emit('join_private_head_to_head', {
      room_code: roomCode.trim(),
      player_name: playerName.trim()
    });
  };

  const submitAnswer = (answer) => {
    socket.emit('submit_answer', { answer });
  };

  const requestRematch = () => {
    socket.emit('head_to_head_rematch', {
      room_id: roomCode
    });
  };

  const renderHeadToHeadScores = () => {
    if (!questionResults || !questionResults.player1) return null;
    
    return (
      <div className="head-to-head-scores">
        <div className="player-score">
          <div className="player-name">{questionResults.player1.name}</div>
          <div className="score">{questionResults.player1.score}</div>
          {questionResults.player1.streak > 0 && (
            <div className="streak">🔥 {questionResults.player1.streak}</div>
          )}
        </div>
        
        <div className="vs">VS</div>
        
        <div className="player-score">
          <div className="player-name">{questionResults.player2.name}</div>
          <div className="score">{questionResults.player2.score}</div>
          {questionResults.player2.streak > 0 && (
            <div className="streak">🔥 {questionResults.player2.streak}</div>
          )}
        </div>
        
        {questionResults.score_difference > 0 && (
          <div className="lead-indicator">
            {questionResults.leader} leads by {questionResults.score_difference}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <GameLayout title="Loading...">
        <Loading message="Processing..." />
      </GameLayout>
    );
  }

  return (
    <GameLayout 
      title={getLayoutTitle()}
      onBack={() => mode === 'choose' ? navigate('/') : setMode('choose')}
      rightContent={getRightContent()}
    >
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {mode === 'choose' && (
        <div className="mode-selection">
          <h2>Head to Head Mode</h2>
          <div className="setup-form">
            <div className="form-group">
              <label htmlFor="playerName">Your Name</label>
              <input
                id="playerName"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={MAX_PLAYER_NAME_LENGTH}
              />
            </div>
            
            <div className="action-buttons">
              <button 
                className="primary-button"
                onClick={queueForMatch}
              >
                Find Random Opponent
              </button>
              
              <button 
                className="secondary-button"
                onClick={createPrivateRoom}
              >
                Create Private Room
              </button>
            </div>
            
            <div className="join-private">
              <h3>Or Join Private Room</h3>
              <div className="form-group room-code-input">
                <input
                  type="text"
                  placeholder="Room Code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={ROOM_CODE_LENGTH}
                />
                <button 
                  className="join-button"
                  onClick={joinPrivateRoom}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'queuing' && (
        <div className="queue-status">
          <h2>Finding Opponent...</h2>
          <div className="queue-info">
            <div className="spinner" />
            <p>Position in queue: {queuePosition}</p>
          </div>
          <button 
            className="secondary-button"
            onClick={cancelQueue}
          >
            Cancel
          </button>
        </div>
      )}

      {mode === 'waiting' && (
        <div className="private-room">
          <h2>Private Room Created</h2>
          <div className="room-info">
            <p>Share this code with your friend:</p>
            <div className="room-code-display">
              <span>{roomCode}</span>
              <button 
                className="copy-button"
                onClick={() => {
                  navigator.clipboard.writeText(roomCode);
                  setError('Room code copied to clipboard!');
                  setTimeout(() => setError(''), 2000);
                }}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="waiting-animation">
            <div className="spinner" />
            <p>Waiting for opponent to join...</p>
          </div>
        </div>
      )}

      {mode === 'playing' && (
        <div className="game-area">
          {renderHeadToHeadScores()}
          
          {currentQuestion && (
            <QuestionDisplay
              question={currentQuestion}
              onAnswer={submitAnswer}
              showResult={questionResults?.comparison ? questionResults : null}
            />
          )}
          
          {questionResults?.players_comparison && (
            <div className="round-results">
              <h3>Round Results</h3>
              <div className="players-comparison">
                {questionResults.players_comparison.map((player, idx) => (
                  <div 
                    key={idx}
                    className={`player-result ${player.is_correct ? 'correct' : 'incorrect'}`}
                  >
                    <div className="result-header">
                      <span className="player-name">{player.name}</span>
                      {player.answered_first && <span className="first-badge">⚡ First</span>}
                    </div>
                    <div className="result-answer">
                      {player.answer || 'No answer'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="correct-answer">
                <span>Correct answer:</span> {questionResults.correct_answer}
              </div>
              {questionResults.questions_remaining > 0 ? (
                <p className="questions-remaining">
                  Questions remaining: {questionResults.questions_remaining}
                </p>
              ) : (
                <p className="final-question">Final question!</p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'finished' && questionResults && (
        <div className="game-finished">
          <h1>Game Over!</h1>
          
          {questionResults.winner ? (
            <div className="winner-announcement">
              <h2>{questionResults.winner.name} Wins!</h2>
              <p>Final Score: {questionResults.winner.score}</p>
              {questionResults.score_margin > 0 && (
                <p className="margin">Won by {questionResults.score_margin} points</p>
              )}
            </div>
          ) : (
            <div className="tie-announcement">
              <h2>It's a Tie!</h2>
              <p>Both players finished with equal scores</p>
            </div>
          )}
          
          <div className="final-stats">
            {questionResults.players_stats && questionResults.players_stats.map((stat, idx) => (
              <div key={idx} className="player-stats-card">
                <h3>{stat.player.name}</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{stat.player.score}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Accuracy:</span>
                    <span className="stat-value">{stat.accuracy.toFixed(1)}%</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">First Answers:</span>
                    <span className="stat-value">{stat.first_answers}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Best Streak:</span>
                    <span className="stat-value">{stat.max_streak}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Response Time:</span>
                    <span className="stat-value">{stat.avg_response_time.toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="game-actions">
            <button 
              className="primary-button"
              onClick={requestRematch}
            >
              Rematch
            </button>
            <button 
              className="secondary-button"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </GameLayout>
  );
};

export default HeadToHead;