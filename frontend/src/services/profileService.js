import axios from 'axios';
import authService from './authService';

const API_URL = 'http://localhost:5000/api'; // Adjust if your backend URL is different

const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = authService.getCurrentUserToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const getMyProfile = async () => {
  try {
    const response = await apiClient.get('/profile');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error.response?.data || { message: 'Failed to fetch profile' };
  }
};

const updateMyProfile = async (profileData) => {
  try {
    const response = await apiClient.put('/profile', profileData);
    return response.data;
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw error.response?.data || { message: 'Failed to update profile' };
  }
};

const fetchPublicUserProfile = async (username) => {
  try {
    const response = await apiClient.get(`/profile/${username}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch public profile for ${username}:`, error);
    throw error.response?.data || { message: `Failed to fetch profile for ${username}` };
  }
};

const fetchLeaderboard = async () => {
  try {
    // This endpoint will be created in the backend later
    const response = await apiClient.get('/leaderboard');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    throw error.response?.data || { message: 'Failed to fetch leaderboard' };
  }
};

const profileService = {
  getMyProfile,
  updateMyProfile,
  fetchPublicUserProfile,
  fetchLeaderboard,
  apiClient // Exporting apiClient if direct use is needed elsewhere
};

export default profileService;
