// src/hooks/useTimer.js
import { useState, useEffect, useRef, useCallback } from 'react';

const useTimer = (initialTime = 0, onTimeUp = () => {}) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  // Start timer
  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  // Pause timer
  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  // Reset timer
  const reset = useCallback((newTime = initialTime) => {
    setTimeLeft(newTime);
    setIsRunning(false);
  }, [initialTime]);

  // Stop timer
  const stop = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(0);
  }, []);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            setIsRunning(false);
            onTimeUp();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft, onTimeUp]);

  return {
    timeLeft,
    isRunning,
    start,
    pause,
    reset,
    stop,
  };
};

export default useTimer;