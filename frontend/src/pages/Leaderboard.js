import React, { useState, useEffect, useContext } from 'react';
import profileService from '../services/profileService';
import { AuthContext } from '../context/AuthContext';
import './LeaderboardPage.css'; // We will create this CSS file next

function LeaderboardPage() {
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    const fetchLeaders = async () => {
      if (!isAuthenticated) {
        // Optionally, you could clear data or set a specific message if the user logs out
        // For now, we just don't fetch if not authenticated, 
        // or rely on the service to handle unauthorized requests if the endpoint is protected.
        // Based on the prompt, it should be viewable by logged-in users, but might be empty.
      }
      try {
        setLoading(true);
        const data = await profileService.fetchLeaderboard();
        setLeaderboardData(data);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to fetch leaderboard data.');
        setLeaderboardData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, [isAuthenticated]); // Refetch if auth status changes, though leaderboard might not be auth-dependent

  if (loading) {
    return <div className="leaderboard-container"><p>Loading leaderboard...</p></div>;
  }

  if (error) {
    return <div className="leaderboard-container error-message"><p>Error: {error}</p></div>;
  }

  return (
    <div className="leaderboard-container">
      <h1>Leaderboard</h1>
      {(!leaderboardData || (leaderboardData.top_singleplayer_scores?.length === 0 && leaderboardData.most_wins?.length === 0)) ? (
        <p>The leaderboard is currently empty. Play some games to see your name here!</p>
      ) : (
        <>
          {leaderboardData.top_singleplayer_scores && leaderboardData.top_singleplayer_scores.length > 0 && (
            <div className="leaderboard-section">
              <h2>Top Single-Player Scores</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Total Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.top_singleplayer_scores.map((player, index) => (
                    <tr key={player.username || index}>
                      <td>{index + 1}</td>
                      <td>{player.username}</td>
                      <td>{player.total_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {leaderboardData.most_wins && leaderboardData.most_wins.length > 0 && (
            <div className="leaderboard-section">
              <h2>Most Game Wins (Multiplayer & Head-to-Head)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.most_wins.map((player, index) => (
                    <tr key={player.username || index}>
                      <td>{index + 1}</td>
                      <td>{player.username}</td>
                      <td>{player.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LeaderboardPage;
