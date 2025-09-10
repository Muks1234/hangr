// src/Profile.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Save, X } from 'lucide-react';

const Profile = ({ userId, username, token, onUpdate }) => {
  const [profile, setProfile] = useState({ username, mood: 'chill', avatar: 'default-avatar.png', bio: '' });
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

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
      }
    };
    if (token) fetchProfile();
  }, [token]);

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
          avatar: profile.avatar,
          bio: profile.bio,
        }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const updatedProfile = await res.json();
      setProfile(updatedProfile);
      setIsEditing(false);
      if (onUpdate) onUpdate(updatedProfile);
    } catch (err) {
      console.error('Error updating profile:', err.message);
    }
  };

  return (
    <div className="profile-container">
      <h2>Your Profile</h2>
      <div className="profile-avatar">
        <img src={profile.avatar} alt="Avatar" style={{ width: '100px', borderRadius: '50%' }} />
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
            placeholder="Avatar URL"
          />
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Bio"
          />
          <button onClick={handleSave} style={{ marginRight: '10px' }}>
            <Save size={16} /> Save
          </button>
          <button onClick={() => setIsEditing(false)}>
            <X size={16} /> Cancel
          </button>
        </div>
      ) : (
        <div>
          <p><strong>Username:</strong> {profile.username}</p>
          <p><strong>Mood:</strong> {profile.mood}</p>
          <p><strong>Bio:</strong> {profile.bio || 'No bio yet'}</p>
          <button onClick={() => setIsEditing(true)}>
            <Edit size={16} /> Edit Profile
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;