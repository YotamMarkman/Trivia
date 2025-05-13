// src/components/common/PlayerList.js
import React from 'react';

const PlayerList = ({ players, hostId, currentPlayerId }) => {
  return (
    <div className="player-list">
      <h3>Players ({players.length})</h3>
      <ul className="players">
        {players.map((player) => (
          <li 
            key={player.session_id} 
            className={`player-item ${player.session_id === currentPlayerId ? 'current-player' : ''}`}
          >
            <span className="player-name">{player.name}</span>
            {player.session_id === hostId && (
              <span className="host-indicator">Host</span>
            )}
            {player.connected === false && (
              <span className="disconnected-indicator">Disconnected</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlayerList;