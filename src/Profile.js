// src/Profile.js
import React, { useState, useEffect } from 'react';
import { Edit, Save, X } from 'lucide-react';
import Multiavatar from '@multiavatar/multiavatar';

const Profile = ({ userId, username, token, onUpdate }) => {
  const [profile, setProfile] = useState({ username, mood: 'chill', avatar: '', bio: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/users/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchProfile();
  }, [token]);

  // Generate avatar based on userId
  const generateAvatar = () => {
    if (!userId) return '';
    const svg = Multiavatar(userId);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handleSave = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/users/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: profile.username,
        mood: profile.mood,
        avatar: profile.avatar || generateAvatar(),
        bio: profile.bio,
      }),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const updatedProfile = await res.json();
    setProfile(updatedProfile);
    setIsEditing(false);
    if (onUpdate) onUpdate(updatedProfile);
  } catch (err) {
    console.error('Save error:', err.message);
    alert('Failed to save profile. Check the console for details.');
  }
};

  if (loading) {
    return <div className="profile-container">Loading...</div>; // Placeholder while loading
  }

  return (
    <div className="profile-container">
      <h2>Your Profile</h2>
      <div className="profile-avatar">
        <img src={generateAvatar() || profile.avatar } alt="Avatar" />
      </div>
      {isEditing ? (
        <div>
          <input
            type="text"
            value={profile.username}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            placeholder="Username"
          />
          <select
            value={profile.mood}
            onChange={(e) => setProfile({ ...profile, mood: e.target.value })}
          >
            <option value="chill">Chill</option>
            <option value="energetic">Energetic</option>
            <option value="focused">Focused</option>
            <option value="social">Social</option>
          </select>
          <input
            type="text"
            value={profile.avatar}
            onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
            placeholder="Avatar URL (optional)"
          />
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Bio"
          />
          <button onClick={handleSave} className="save-button">
            <Save size={16} /> Save
          </button>
          <button onClick={() => setIsEditing(false)} className="cancel-button">
            <X size={16} /> Cancel
          </button>
        </div>
      ) : (
        <div>
          <p><strong>Username:</strong> {profile.username}</p>
          <p><strong>Mood:</strong> {profile.mood}</p>
          <p><strong>Bio:</strong> {profile.bio || 'No bio yet'}</p>
          <button onClick={() => setIsEditing(true)} className="edit-profile-button">
            <Edit size={16} /> Edit Profile
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;