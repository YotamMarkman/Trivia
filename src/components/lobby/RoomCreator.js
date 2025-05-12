// src/components/lobby/RoomCreator.js
import React, { useState } from 'react';
import CategorySelector from './CategorySelector';
import { MAX_PLAYER_NAME_LENGTH } from '../../utils/constants';

const RoomCreator = ({ onCreateRoom, onBack }) => {
  const [playerName, setPlayerName] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setError('');
    onCreateRoom(playerName.trim(), category);
  };

  return (
    <div className="room-creator">
      <h2>Create a Room</h2>
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
        
        <CategorySelector 
          selectedCategory={category}
          onCategoryChange={setCategory}
        />
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-actions">
          <button type="submit" className="primary-button">
            Create Room
          </button>
          <button 
            type="button" 
            className="secondary-button"
            onClick={onBack}
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
};

export default RoomCreator;