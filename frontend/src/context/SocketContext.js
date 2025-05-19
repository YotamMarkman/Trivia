import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children, token, isAuthenticated }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null); // Stores { sid, username, user_id, is_authenticated }

  const connectSocket = useCallback(() => {
    // Ensure previous socket is disconnected before creating a new one
    if (socket) {
      socket.disconnect();
    }

    const newSocketOptions = {
      reconnectionAttempts: 5,
      query: {},
    };

    if (isAuthenticated && token) {
      newSocketOptions.query.token = token;
      console.log('Connecting with token...');
    } else {
      console.log('Connecting as guest...');
    }

    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', newSocketOptions);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setSocketError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Potentially handle server-initiated disconnect, e.g., auth failure
        setSocketError('Disconnected by server.');
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
      setSocketError(err.message);
    });

    newSocket.on('connection_ack', (data) => {
      console.log('Connection acknowledged:', data);
      setSessionInfo(data);
      // You might want to store username or other session details in AuthContext or here
    });

    setSocket(newSocket);

  }, [token, isAuthenticated, socket]); // Added socket to dependency array

  useEffect(() => {
    // Connect socket when isAuthenticated or token changes, or on initial mount if guest allowed
    connectSocket();

    return () => {
      if (socket) {
        console.log('Cleaning up socket connection.');
        socket.disconnect();
      }
    };
  }, [connectSocket]); // connectSocket is now stable due to useCallback

  // Provide a function to manually reconnect if needed, e.g., after token refresh
  const manualConnect = () => {
    connectSocket();
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, socketError, sessionInfo, manualConnect }}>
      {children}
    </SocketContext.Provider>
  );
};
