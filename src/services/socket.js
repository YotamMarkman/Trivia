// src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false,  // We'll manually connect when app starts
  reconnection: true,  // Automatically reconnect if connection is lost
  reconnectionAttempts: 5,  // Try to reconnect 5 times
  reconnectionDelay: 1000,  // Wait 1 second between reconnection attempts
  transports: ['websocket', 'polling'],  // Use WebSocket first, fallback to polling
});

// Error handling
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect to server');
});

export default socket;