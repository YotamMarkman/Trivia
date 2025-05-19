// src/components/common/Timer.js
import React from 'react';

const Timer = ({ time, totalTime = 15 }) => {
  const percentage = (time / totalTime) * 100;
  const getColorClass = () => {
    if (percentage > 60) return 'green';
    if (percentage > 30) return 'yellow';
    return 'red';
  };

  return (
    <div className="timer">
      <div className="timer-display">{time}s</div>
      <div className="timer-bar-container">
        <div 
          className={`timer-bar ${getColorClass()}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default Timer;