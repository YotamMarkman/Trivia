// src/components/lobby/RoomJoiner.js
import React, { useState } from 'react';
import { MAX_PLAYER_NAME_LENGTH, ROOM_CODE_LENGTH } from '../../utils/constants';

const RoomJoiner = ({ onJoinRoom }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    
    if (roomCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    
    setError('');
    onJoinRoom(roomCode.trim(), playerName.trim());
  };

  return (
    <div className="room-joiner">
      <h2>Join a Room</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={MAX_PLAYER_NAME_LENGTH}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="roomCode">Room Code</label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-digit room code"
            maxLength={ROOM_CODE_LENGTH}
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <button type="submit" className="primary-button">
          Join Room
        </button>
      </form>
    </div>
  );
};

export default RoomJoiner;