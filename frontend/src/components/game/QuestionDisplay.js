// src/components/game/QuestionDisplay.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const QuestionDisplay = ({
  questionText,      // string: The actual text of the question.
  options,           // array of strings: The answer choices.
  category,          // string: The category of the question.
  currentRound,      // number: The current question number (e.g., 1, 2, 3...).
  totalRounds,       // number: The total number of questions in the game.
  onAnswer,          // function: Callback when an answer is selected.
  isRevealState = false, // boolean: True if in answer reveal mode.
  revealData = null    // object: { correctAnswer: string, (optional) playerAnswers, scoresForRound }
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);

  useEffect(() => {
    // Reset when new question arrives (identified by questionText changing)
    setSelectedAnswer(null);
    setIsAnswered(false);
  }, [questionText]);

  const handleAnswerSelect = (answer) => {
    if (isAnswered || isRevealState) return; // Prevent answering if already answered or in reveal state
    
    setSelectedAnswer(answer);
    setIsAnswered(true);
    onAnswer(answer);
  };

  const getAnswerClassName = (option) => {
    let className = 'answer-option';
    
    if (isRevealState && revealData) {
      if (option === revealData.correctAnswer) {
        className += ' correct';
      } else if (selectedAnswer === option && option !== revealData.correctAnswer) {
        // If this option was selected by the user and it's incorrect
        className += ' incorrect selected'; 
      } else if (selectedAnswer === option && option === revealData.correctAnswer) {
        // If this option was selected and it is correct (already handled by first if, but good for clarity)
        className += ' correct selected';
      } else {
        // Option was not selected, and not the correct answer (or it is but not selected)
        className += ' disabled-during-reveal'; // General class for other options during reveal
      }
    } else if (selectedAnswer === option) {
      className += ' selected';
    }
    
    return className;
  };

  if (!questionText || !options) {
    return <div className="question-display-loading">Loading question...</div>; // Or some other placeholder
  }

  return (
    <motion.div
      key={questionText} // Animate when questionText changes
      className="question-display"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.3 }}
    >
      <div className="question-header">
        <span className="question-number">
          Question {currentRound} of {totalRounds}
        </span>
        <span className="question-category">
          {category || 'General'}
        </span>
      </div>
      
      <div className="question-text">
        <h2>{questionText}</h2>
      </div>
      
      <div className="answer-options">
        {options.map((option, index) => (
          <motion.button
            key={index}
            className={getAnswerClassName(option)}
            onClick={() => handleAnswerSelect(option)}
            disabled={isAnswered || isRevealState} // Disable if answered or in reveal state
            aria-pressed={selectedAnswer === option}
            whileHover={{ scale: (isAnswered || isRevealState) ? 1 : 1.05 }} // No hover effect if disabled
            whileTap={{ scale: (isAnswered || isRevealState) ? 1 : 0.95 }}   // No tap effect if disabled
            transition={{ duration: 0.1 }}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
          </motion.button>
        ))}
      </div>
      
      {isRevealState && revealData && (
        <div 
          className={`answer-feedback ${selectedAnswer === revealData.correctAnswer ? 'correct-text' : 'incorrect-text'}`}
          aria-live="polite"
        >
          {isAnswered ? (
            selectedAnswer === revealData.correctAnswer ? (
              <p>Correct!</p> // Points earned could be added if revealData includes it for this player
            ) : (
              <p>You chose: "{selectedAnswer}". Correct answer: "{revealData.correctAnswer}"</p>
            )
          ) : (
            <p>Time's up! The correct answer was: "{revealData.correctAnswer}"</p>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default QuestionDisplay;