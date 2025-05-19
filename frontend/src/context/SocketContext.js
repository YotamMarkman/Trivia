import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocketContext = () => useContext(SocketContext); // Renamed from useSocket

export const SocketProvider = ({ children, token, isAuthenticated }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null); // Stores { sid, username, user_id, is_authenticated }
  const [isManualDisconnect, setIsManualDisconnect] = useState(false); // Add a state to track if an explicit disconnect is intended

  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log('SocketContext: Manually disconnecting socket.');
      setIsManualDisconnect(true); // Indicate that this disconnect is intentional
      socket.disconnect();
      setSocket(null); // Clear the socket instance
      setIsConnected(false);
      setSessionInfo(null); // Clear session info on disconnect
    }
  }, [socket]); // Added socket dependency

  const connectSocket = useCallback(() => {
    // If a socket instance exists, disconnect it first before creating a new one.
    if (socket) {
      console.log('SocketContext: Existing socket found, disconnecting before reconnecting.');
      socket.disconnect();
    }
    setIsManualDisconnect(false); // Reset manual disconnect flag

    const newSocketOptions = {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000, // Optional: add a delay
      query: {},
      // Important: ensure transport is set to websocket to avoid issues with some environments/proxies
      transports: ['websocket'],
      forceNew: true, // Force a new connection
      autoConnect: true
    };

    console.log('SocketContext: Setting up new socket with options:', newSocketOptions);

    if (isAuthenticated && token) {
      newSocketOptions.query.token = token;
      console.log('SocketContext: Connecting with token...');
    } else {
      console.log('SocketContext: Connecting as guest...');
    }

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    console.log('SocketContext: Connecting to socket URL:', socketUrl);
    
    const newSocket = io(socketUrl, newSocketOptions);

    newSocket.on('connect', () => {
      console.log('SocketContext: Socket connected:', newSocket.id);
      setIsConnected(true);
      setSocketError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('SocketContext: Socket disconnected:', reason);
      setIsConnected(false);
      // Only set error if it wasn't a manual disconnect
      if (!isManualDisconnect) {
        if (reason === 'io server disconnect') {
          setSocketError('Disconnected by server. This might be due to an authentication issue or server restart.');
        } else if (reason === 'io client disconnect') {
          // This is a client-initiated disconnect, usually not an error unless unexpected
          setSocketError('Client disconnected.');
        } else {
          setSocketError(`Disconnected: ${reason}. Attempting to reconnect if configured.`);
        }
      }
      // Clear session info on any disconnect
      setSessionInfo(null);
    });

    newSocket.on('connect_error', (err) => {
      console.error('SocketContext: Socket connection error:', err);
      setIsConnected(false);
      setSocketError(`Connection Error: ${err.message}. Check server and network.`);
    });

    newSocket.on('connection_ack', (data) => {
      console.log('SocketContext: Connection acknowledged by server:', data);
      setSessionInfo(data); // Store sid, username, user_id, is_authenticated from backend
      if (data.is_authenticated) {
        console.log(`SocketContext: Authenticated as ${data.username} (User ID: ${data.user_id})`);
      } else {
        console.log(`SocketContext: Connected as guest ${data.username}`);
      }
    });
    
    // Example: Listen for a generic error event from the backend
    newSocket.on('error', (errorData) => {
        console.error('SocketContext: Received error event from server:', errorData);
        // You could set a specific error state here or display a notification
        // For now, just logging it.
        // setSocketError(errorData.message || 'An error occurred on the server.');
    });

    setSocket(newSocket);
  }, [token, isAuthenticated, socket, isManualDisconnect]); // Added socket and isManualDisconnect
  useEffect(() => {
    // This effect handles initial connection and reconnections when auth state changes.
    // It should only run when `isAuthenticated` or `token` changes.
    console.log('SocketContext: Auth state changed (isAuthenticated, token). Re-evaluating connection.');
    if (isAuthenticated && token) {
        console.log('SocketContext: Authenticated user, attempting to connect/reconnect socket.');
        connectSocket();
    } else if (!isAuthenticated && socket) {
        // If user logs out and socket exists, disconnect it.
        console.log('SocketContext: User logged out, disconnecting existing socket.');
        disconnectSocket();
    } else if (!isAuthenticated && !token && !socket) {
        // Connect as guest on initial load if no token and not authenticated
        console.log('SocketContext: No token, attempting to connect as guest.');
        connectSocket(); 
    }

    return () => {
      // Cleanup on component unmount
      if (socket) {
        console.log('SocketContext: Cleaning up socket connection on provider unmount.');
        setIsManualDisconnect(true); // Ensure this is marked as intentional
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setSessionInfo(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated, connectSocket, disconnectSocket, socket]); // Added socket to useEffect dep array as it's used in the else if condition

  // Provide a function to manually reconnect if needed, e.g., after token refresh or explicit connect action
  const manualConnect = useCallback(() => {
    console.log('SocketContext: Manual connect triggered.');
    connectSocket();
  }, [connectSocket]);
  
  const manualDisconnect = useCallback(() => {
    console.log('SocketContext: Manual disconnect triggered.');
    disconnectSocket();
  }, [disconnectSocket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, socketError, sessionInfo, manualConnect, manualDisconnect, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
};
