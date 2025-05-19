// src/components/lobby/RoomCreator.js
import React, { useState } from 'react';
import { motion } from 'framer-motion'; // Import motion
import CategorySelector from './CategorySelector';
import { MAX_PLAYER_NAME_LENGTH } from '../../utils/constants';

const RoomCreator = ({ onCreateRoom, onBack }) => {
  const [playerName, setPlayerName] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');
  const [fillWithBots, setFillWithBots] = useState(true); // State for checkbox
  const [defaultBotDifficulty, setDefaultBotDifficulty] = useState('medium'); // New state for bot difficulty

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setError('');
    onCreateRoom(playerName.trim(), category, fillWithBots, defaultBotDifficulty);
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

        <div className="form-group">
          <label htmlFor="fill-bots-checkbox">Fill empty slots with AI Bots:</label>
          <input
            type="checkbox"
            id="fill-bots-checkbox"
            checked={fillWithBots}
            onChange={(e) => setFillWithBots(e.target.checked)}
          />
        </div>

        {fillWithBots && (
          <div className="form-group">
            <label htmlFor="bot-difficulty-select">Default AI Bot Difficulty:</label>
            <select 
              id="bot-difficulty-select"
              value={defaultBotDifficulty}
              onChange={(e) => setDefaultBotDifficulty(e.target.value)}
              disabled={!fillWithBots}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-actions">
          <motion.button // Change to motion.button
            type="submit" 
            className="primary-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            Create Room
          </motion.button>
          <motion.button // Change to motion.button
            type="button" 
            className="secondary-button"
            onClick={onBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            Back
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default RoomCreator;