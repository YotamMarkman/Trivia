// src/components/game/QuestionDisplay.js
import React, { useState, useEffect } from 'react';

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
  console.log('QuestionDisplay rendered with props:', { questionText, options, category, currentRound, totalRounds, isRevealState }); // Added this log
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false); // This now means an answer has been *confirmed*
  const [isConfirmed, setIsConfirmed] = useState(false); // Tracks if the confirm button has been pressed

  useEffect(() => {
    // Reset when new question arrives (identified by questionText changing)
    setSelectedAnswer(null);
    setIsAnswered(false);
    setIsConfirmed(false);
  }, [questionText]);

  const handleAnswerSelect = (answer) => {
    if (isConfirmed || isRevealState) return; // Prevent changing selection if already confirmed or in reveal state
    setSelectedAnswer(answer);
  };

  const handleConfirmAnswer = () => {
    if (!selectedAnswer || isConfirmed || isRevealState) return;
    setIsAnswered(true); // Mark as answered (confirmed)
    setIsConfirmed(true); // Mark as confirmed
    onAnswer(selectedAnswer);
  };

  const getAnswerClassName = (option) => {
    let className = 'answer-option';
    
    if (isRevealState && revealData) {
      if (option === revealData.correctAnswer) {
        className += ' correct';
      } else if (option !== revealData.correctAnswer && selectedAnswer === option) { // Ensure it was the selected one
        className += ' incorrect selected'; 
      } else if (option === revealData.correctAnswer && selectedAnswer === option) {
        className += ' correct selected';
      } else {
        className += ' disabled-during-reveal';
      }
    } else if (selectedAnswer === option) {
      className += ' selected';
    }
    
    return className;
  };

  if (!questionText || !options) {
    return <div className="question-display-loading">Loading question...</div>;
  }

  return (
    <div
      key={questionText}
      className="question-display"
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
          <button
            key={index}
            className={getAnswerClassName(option)}
            onClick={() => handleAnswerSelect(option)}
            disabled={isConfirmed || isRevealState} // Disable if confirmed or in reveal state
            aria-pressed={selectedAnswer === option}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text"> {option}</span> {/* Added a space before {option} */}
          </button>
        ))}
      </div>

      {!isRevealState && (
        <div className="confirm-answer-section">
          <button
            className="confirm-button primary-button"
            onClick={handleConfirmAnswer}
            disabled={!selectedAnswer || isConfirmed}
          >
            Confirm Answer
          </button>
        </div>
      )}
      
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
    </div>
  );
};

export default QuestionDisplay;