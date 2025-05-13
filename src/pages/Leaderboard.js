// src/pages/Leaderboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameLayout from '../components/layouts/GameLayout';
import Loading from '../components/common/Loading';

const Leaderboard = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, single, multiplayer, head-to-head

  useEffect(() => {
    // Simulate fetching leaderboard data
    setTimeout(() => {
      const dummyData = [
        { rank: 1, player_name: 'Champion1', score: 9500, games_played: 42, accuracy: 92.5, game_mode: 'single' },
        { rank: 2, player_name: 'QuizMaster', score: 9200, games_played: 38, accuracy: 89.7, game_mode: 'multiplayer' },
        { rank: 3, player_name: 'BrainBox', score: 8900, games_played: 35, accuracy: 91.2, game_mode: 'head-to-head' },
        { rank: 4, player_name: 'TriviaKing', score: 8700, games_played: 40, accuracy: 87.5, game_mode: 'single' },
        { rank: 5, player_name: 'QuizWiz', score: 8500, games_played: 32, accuracy: 88.9, game_mode: 'multiplayer' },
        { rank: 6, player_name: 'BrainiacQueen', score: 8300, games_played: 30, accuracy: 86.3, game_mode: 'head-to-head' },
        { rank: 7, player_name: 'KnowledgeNinja', score: 8100, games_played: 28, accuracy: 85.1, game_mode: 'single' },
        { rank: 8, player_name: 'FactFinder', score: 7900, games_played: 27, accuracy: 84.7, game_mode: 'multiplayer' },
        { rank: 9, player_name: 'TriviaExpert', score: 7700, games_played: 25, accuracy: 83.2, game_mode: 'head-to-head' },
        { rank: 10, player_name: 'QuestionMaster', score: 7500, games_played: 24, accuracy: 82.9, game_mode: 'single' },
      ];
      
      setLeaderboard(dummyData);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredLeaderboard = filter === 'all' 
    ? leaderboard 
    : leaderboard.filter(entry => entry.game_mode === filter);

  return (
    <GameLayout title="Leaderboard" onBack={() => navigate('/')}>
      {loading ? (
        <Loading message="Loading leaderboard data..." />
      ) : (
        <div className="leaderboard-container">
          <div className="leaderboard-filters">
            <button 
              className={`filter-button ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Modes
            </button>
            <button 
              className={`filter-button ${filter === 'single' ? 'active' : ''}`}
              onClick={() => setFilter('single')}
            >
              Single Player
            </button>
            <button 
              className={`filter-button ${filter === 'multiplayer' ? 'active' : ''}`}
              onClick={() => setFilter('multiplayer')}
            >
              Multiplayer
            </button>
            <button 
              className={`filter-button ${filter === 'head-to-head' ? 'active' : ''}`}
              onClick={() => setFilter('head-to-head')}
            >
              Head to Head
            </button>
          </div>
          
          <div className="leaderboard-table">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Games</th>
                  <th>Accuracy</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((entry, index) => (
                  <tr key={index}>
                    <td>#{entry.rank}</td>
                    <td>{entry.player_name}</td>
                    <td>{entry.score}</td>
                    <td>{entry.games_played}</td>
                    <td>{entry.accuracy}%</td>
                    <td>{entry.game_mode}</td>
                  </tr>
                ))}
                {filteredLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan="6" className="no-data">No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </GameLayout>
  );
};

export default Leaderboard;