// src/components/game/QuestionDisplay.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion'; // Import motion

const QuestionDisplay = ({ question, onAnswer, showResult }) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);

  useEffect(() => {
    // Reset when new question arrives
    setSelectedAnswer(null);
    setIsAnswered(false);
  }, [question.question]);

  const handleAnswerSelect = (answer) => {
    if (isAnswered) return;
    
    setSelectedAnswer(answer);
    setIsAnswered(true);
    onAnswer(answer);
  };

  const getAnswerClassName = (option) => {
    let className = 'answer-option';
    
    if (selectedAnswer === option) {
      className += ' selected';
    }
    
    if (showResult) {
      if (option === showResult.correct_answer) {
        className += ' correct';
      } else if (selectedAnswer === option && !showResult.is_correct) {
        className += ' incorrect';
      }
    }
    
    return className;
  };

  return (
    <motion.div // Wrap with motion.div
      key={question.question} // Add key to trigger animation on question change
      className="question-display"
      initial={{ opacity: 0, x: -50 }} // Initial animation state
      animate={{ opacity: 1, x: 0 }} // Animate to this state
      exit={{ opacity: 0, x: 50 }} // Animate to this state on exit
      transition={{ duration: 0.3 }} // Animation duration
    >
      <div className="question-header">
        <span className="question-number">
          Question {question.question_number} of {question.total_questions}
        </span>
        <span className="question-category">
          {question.category || 'General'}
        </span>
      </div>
      
      <div className="question-text">
        <h2>{question.question}</h2>
      </div>
      
      <div className="answer-options">
        {question.options.map((option, index) => (
          <motion.button // Change to motion.button
            key={index}
            className={getAnswerClassName(option)}
            onClick={() => handleAnswerSelect(option)}
            disabled={isAnswered}
            aria-pressed={selectedAnswer === option} // Add aria-pressed
            whileHover={{ scale: 1.05 }} // Add hover effect
            whileTap={{ scale: 0.95 }} // Add tap effect
            transition={{ duration: 0.1 }} // Make transition quick
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
          </motion.button>
        ))}
      </div>
      
      {showResult && (
        <div 
          className={`answer-feedback ${showResult.is_correct ? 'correct' : 'incorrect'}`}
          aria-live="polite" // Add aria-live for screen readers
        >
          {showResult.is_correct ? (
            <p>Correct! You earned {showResult.points_earned} points!</p>
          ) : (
            <p>Incorrect. The correct answer was: {showResult.correct_answer}</p>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default QuestionDisplay;