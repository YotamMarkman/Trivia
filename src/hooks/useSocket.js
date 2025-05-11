// src/hooks/useSocket.js
import { useEffect, useRef, useCallback } from 'react';
import socket from '../services/socket';

const useSocket = () => {
  const isConnected = useRef(false);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    // Connect only if not already connected
    if (!isConnected.current) {
      socket.connect();
      isConnected.current = true;

      // Connection event handlers
      socket.on('connect', () => {
        console.log('Connected to server');
        reconnectAttempts.current = 0;
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        isConnected.current = false;
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber}`);
        reconnectAttempts.current = attemptNumber;
      });
    }

    // Cleanup function
    return () => {
      if (isConnected.current) {
        socket.disconnect();
        isConnected.current = false;
      }
    };
  }, []);

  // Utility function to emit events with error handling
  const emit = useCallback((event, data, callback) => {
    if (socket.connected) {
      socket.emit(event, data, callback);
    } else {
      console.error('Socket not connected. Cannot emit event:', event);
    }
  }, []);

  return { socket, emit, isConnected: socket.connected };
};

export default useSocket;