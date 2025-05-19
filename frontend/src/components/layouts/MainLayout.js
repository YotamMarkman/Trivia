// src/components/layouts/MainLayout.js
import React from 'react';
import { Outlet, Link } from 'react-router-dom';

const MainLayout = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>
          <Link to="/">Trivia Master</Link>
        </h1>
        <nav>
          <Link to="/leaderboard">Leaderboard</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>&copy; 2024 Trivia Master. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default MainLayout;