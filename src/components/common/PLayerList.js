// src/components/common/PlayerList.js
import React from 'react';
import socket from '../../services/socket'; // Import socket

const PlayerList = ({ players, hostId, currentPlayerId, mutedPlayersSet }) => { // Added mutedPlayersSet

  const handleToggleMute = (targetPlayerId) => {
    if (targetPlayerId === currentPlayerId) return; // Cannot mute self

    socket.emit('toggle_mute_player', { 
      target_session_id: targetPlayerId 
    });
  };

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
            {player.session_id !== currentPlayerId && (
              <button 
                onClick={() => handleToggleMute(player.session_id)}
                className={`mute-btn ${mutedPlayersSet && mutedPlayersSet.has(player.session_id) ? 'unmute' : 'mute'}`}
                title={mutedPlayersSet && mutedPlayersSet.has(player.session_id) ? 'Unmute Player' : 'Mute Player'}
              >
                {mutedPlayersSet && mutedPlayersSet.has(player.session_id) ? 'Unmute' : 'Mute'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlayerList;