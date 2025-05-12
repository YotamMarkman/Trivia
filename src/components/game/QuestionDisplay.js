// src/components/game/QuestionDisplay.js
import React, { useState, useEffect } from 'react';

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
    <div className="question-display">
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
          <button
            key={index}
            className={getAnswerClassName(option)}
            onClick={() => handleAnswerSelect(option)}
            disabled={isAnswered}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>
      
      {showResult && (
        <div className={`answer-feedback ${showResult.is_correct ? 'correct' : 'incorrect'}`}>
          {showResult.is_correct ? (
            <p>Correct! You earned {showResult.points_earned} points!</p>
          ) : (
            <p>Incorrect. The correct answer was: {showResult.correct_answer}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionDisplay;