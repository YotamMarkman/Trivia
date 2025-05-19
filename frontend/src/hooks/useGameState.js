// src/hooks/useGameState.js
import { useState, useCallback } from 'react';

const useGameState = (initialState = 'waiting') => {
  const [gameState, setGameState] = useState(initialState);
  const [gameId, setGameId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [scores, setScores] = useState([]); // Overall game scores
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerRevealData, setAnswerRevealData] = useState(null); // Data for showing correct answer, who got it right/wrong for the round
  const [leaderboard, setLeaderboard] = useState(null); // Final game leaderboard
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [gameMessage, setGameMessage] = useState('');

  // Reset game state
  const resetGame = useCallback(() => {
    setGameState('waiting');
    setGameId(null);
    setPlayers([]);
    setCurrentQuestion(null);
    setScores([]);
    setTimeRemaining(0);
    setAnswerRevealData(null);
    setLeaderboard(null);
    setCurrentRound(0);
    setTotalRounds(0);
    setGameMessage('');
  }, []);

  // Update player list
  const updatePlayers = useCallback((newPlayers) => {
    setPlayers(newPlayers);
  }, []);

  // Update current question, round info, and set game state for active question
  const updateQuestion = useCallback((questionData) => {
    setCurrentQuestion(questionData.question);
    setCurrentRound(questionData.currentRound);
    setTotalRounds(questionData.totalRounds);
    setTimeRemaining(questionData.timeLimit || 0); // Assuming timeLimit comes with questionData
    setAnswerRevealData(null); // Clear previous round's results
    setGameState('question_active');
    setGameMessage(`Round ${questionData.currentRound}/${questionData.totalRounds}`);
  }, []);

  // Update overall scores
  const updateScores = useCallback((newScores) => {
    setScores(newScores);
  }, []);

  // Update timer
  const updateTimer = useCallback((time) => {
    setTimeRemaining(time);
  }, []);

  // Set data for revealing answers for the current round and update game state
  const showAnswerReveal = useCallback((revealData) => {
    setAnswerRevealData(revealData);
    setGameState('answer_reveal');
  }, []);

  // Set final game leaderboard and update game state
  const showGameResults = useCallback((finalLeaderboard) => {
    setLeaderboard(finalLeaderboard);
    setGameState('game_over');
    setGameMessage('Game Over!');
  }, []);

  return {
    gameState,
    setGameState, // Exposed for direct state changes if needed (e.g., 'connecting', 'error')
    gameId,
    setGameId,
    players,
    updatePlayers,
    currentQuestion,
    updateQuestion, // This now also handles round info and game state transition
    scores,
    updateScores,
    timeRemaining,
    updateTimer,
    answerRevealData,
    showAnswerReveal, // Replaces setResults, sets specific state
    leaderboard,
    showGameResults, // New function to set final results and state
    currentRound,
    totalRounds,
    gameMessage,
    setGameMessage,
    resetGame,
  };
};

export default useGameState;