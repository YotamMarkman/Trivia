// src/hooks/useGameState.js
import { useState, useCallback } from 'react';

const useGameState = (initialState = 'waiting') => {
  const [gameState, setGameState] = useState(initialState);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [scores, setScores] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [questionResults, setQuestionResults] = useState(null);

  // Reset game state
  const resetGame = useCallback(() => {
    setGameState('waiting');
    setPlayers([]);
    setCurrentQuestion(null);
    setScores([]);
    setTimeRemaining(0);
    setQuestionResults(null);
  }, []);

  // Update player list
  const updatePlayers = useCallback((newPlayers) => {
    setPlayers(newPlayers);
  }, []);

  // Update current question
  const updateQuestion = useCallback((question) => {
    setCurrentQuestion(question);
    setQuestionResults(null); // Clear previous results
  }, []);

  // Update scores
  const updateScores = useCallback((newScores) => {
    setScores(newScores);
  }, []);

  // Update timer
  const updateTimer = useCallback((time) => {
    setTimeRemaining(time);
  }, []);

  // Set question results
  const setResults = useCallback((results) => {
    setQuestionResults(results);
  }, []);

  return {
    gameState,
    setGameState,
    players,
    currentQuestion,
    scores,
    timeRemaining,
    questionResults,
    resetGame,
    updatePlayers,
    updateQuestion,
    updateScores,
    updateTimer,
    setResults,
  };
};

export default useGameState;