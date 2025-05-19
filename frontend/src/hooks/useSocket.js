// src/hooks/useSocket.js
import { useEffect } from 'react';
import { useSocketContext } from '../context/SocketContext';

// This hook is deprecated and only kept for backward compatibility
// Use useSocketContext from SocketContext.js directly instead
const useSocket = () => {
  console.warn('useSocket is deprecated. Please use useSocketContext from ../context/SocketContext instead');
  const { socket, connectSocket } = useSocketContext();

  useEffect(() => {
    // If socket is null, try to connect
    if (!socket) {
      console.log('useSocket: Socket is null, attempting to connect');
      connectSocket?.();
      return; // Exit early, will reconnect when socket becomes available
    }

    const handleConnect = () => {
      console.log('Socket connected:', socket.id);
    };

    const handleDisconnect = (reason) => {
      console.log('Socket disconnected:', reason);
    };

    const handleError = (error) => {
      console.error('Socket error:', error);
    };

    // Log initial status
    console.log('Socket instance in useSocket:', socket);
    console.log('Socket connected status in useSocket:', socket.connected);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError); // More specific error handling

    // Clean up listeners when component unmounts or socket changes
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
    };
  }, [socket]); // Re-run effect if socket instance changes

  return socket;
};

export default useSocket;