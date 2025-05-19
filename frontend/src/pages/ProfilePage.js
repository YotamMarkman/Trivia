import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ProfilePage = () => {
  const { token } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const response = await axios.get(`${API_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(response.data.profile);
        setBio(response.data.profile.bio || '');
        setAvatarUrl(response.data.profile.avatar_url || '');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch profile');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [token]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    try {
      const response = await axios.put(
        `${API_URL}/profile`,
        { bio, avatar_url: avatarUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(prev => ({...prev, bio, avatar_url: avatarUrl }));
      setEditSuccess(response.data.message || 'Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!profile) return <p>No profile data found.</p>;

  return (
    <div>
      <h2>My Profile</h2>
      <p><strong>Username:</strong> {profile.username}</p>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Registration Date:</strong> {new Date(profile.registration_date).toLocaleDateString()}</p>
      
      <h3>Stats</h3>
      <p><strong>Games Played:</strong> {profile.games_played}</p>
      <p><strong>Wins:</strong> {profile.wins}</p>
      <p><strong>Total Score:</strong> {profile.total_score}</p>
      
      <h3>Customization</h3>
      {profile.avatar_url && <img src={profile.avatar_url} alt="Avatar" style={{width: '100px', height: '100px', borderRadius: '50%'}}/>}
      <p><strong>Bio:</strong> {profile.bio || 'No bio set.'}</p>

      <button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</button>

      {isEditing && (
        <form onSubmit={handleEditSubmit}>
          <div>
            <label htmlFor="bio">Bio:</label>
            <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div>
            <label htmlFor="avatarUrl">Avatar URL:</label>
            <input type="text" id="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          </div>
          {editError && <p style={{color: 'red'}}>{editError}</p>}
          {editSuccess && <p style={{color: 'green'}}>{editSuccess}</p>}
          <button type="submit">Save Changes</button>
        </form>
      )}
    </div>
  );
};

export default ProfilePage;
