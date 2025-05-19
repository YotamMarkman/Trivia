import React, { createContext, useState, useEffect, useCallback } from 'react';
import authService from './services/authService';
import { jwtDecode } from 'jwt-decode'; // Corrected import

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(authService.getCurrentUserToken());

  const updateUserFromToken = useCallback((currentToken) => {
    if (currentToken) {
      try {
        const decoded = jwtDecode(currentToken); // Use jwt-decode
        setUser({ 
          id: decoded.user_id, 
          username: decoded.username, 
          email: decoded.email 
          // Add other relevant fields from token if needed
        });
        localStorage.setItem('userToken', currentToken);
        setToken(currentToken);
      } catch (error) {
        console.error("Failed to decode token:", error);
        setUser(null);
        localStorage.removeItem('userToken');
        setToken(null);
      }
    } else {
      setUser(null);
      localStorage.removeItem('userToken');
      setToken(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    updateUserFromToken(token);
  }, [token, updateUserFromToken]);

  const login = (newToken) => {
    updateUserFromToken(newToken);
  };

  const logout = () => {
    authService.logout();
    updateUserFromToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
