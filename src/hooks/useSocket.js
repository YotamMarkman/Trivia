// src/hooks/useSocket.js
import { useEffect, useContext } from 'react';
import { SocketContext } from '../services/socket';

const useSocket = () => {
  const socket = useContext(SocketContext);

  useEffect(() => {
    if (!socket) return;

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