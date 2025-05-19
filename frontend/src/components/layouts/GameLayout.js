// src/components/layouts/GameLayout.js
import React from 'react';

const GameLayout = ({ 
  children, 
  title, 
  showBack = true, 
  onBack,
  rightContent 
}) => {
  return (
    <div className="game-layout">
      <header className="game-header">
        <div className="header-left">
          {showBack && (
            <button 
              className="back-button" 
              onClick={onBack || (() => window.history.back())}
            >
              ← Back
            </button>
          )}
          <h1>{title}</h1>
        </div>
        <div className="header-right">
          {rightContent}
        </div>
      </header>
      
      <main className="game-content">
        {children}
      </main>
    </div>
  );
};

export default GameLayout;