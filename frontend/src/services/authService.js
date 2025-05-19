import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'; // Adjust if your backend runs elsewhere

const register = async (username, email, password) => {
  try {
    const response = await axios.post(`${API_URL}/register`, {
      username,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Registration failed' };
  }
};

const login = async (loginIdentifier, password) => {
  try {
    const response = await axios.post(`${API_URL}/login`, {
      login_identifier: loginIdentifier,
      password,
    });
    if (response.data.token) {
      localStorage.setItem('userToken', response.data.token);
    }
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Login failed' };
  }
};

const logout = () => {
  localStorage.removeItem('userToken');
  // Potentially notify backend or clear other client-side state
};

const getCurrentUserToken = () => {
  return localStorage.getItem('userToken');
};

const authService = {
  register,
  login,
  logout,
  getCurrentUserToken,
};

export default authService;
