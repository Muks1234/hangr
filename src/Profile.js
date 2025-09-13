import React, { useState, useEffect } from 'react';
import { Edit, Save, X, MapPin } from 'lucide-react';
import Multiavatar from '@multiavatar/multiavatar';
import { BACKEND_URL } from './App';

const Profile = ({ userId, username, token, statusMoods, onUpdate }) => {
  const [profile, setProfile] = useState({
    username,
    mood: 'chill',
    avatar: '',
    bio: '',
    latitude: 0,
    longitude: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Generate avatar based on userId
  const generateAvatar = () => {
    if (!userId) return '';
    const svg = Multiavatar(userId);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
        const data = await res.json();
        setProfile({
          username: data.username || username,
          mood: data.mood || 'chill',
          avatar: data.avatar || '',
          bio: data.bio || '',
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
        });
      } catch (err) {
        console.error('Error fetching profile:', err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchProfile();
  }, [token, username]);

  // Update location with browser geolocation
  const updateLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/users/location`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });

          if (!res.ok) throw new Error(`Failed to update location: ${res.status}`);
          const updatedProfile = await res.json();
          setProfile((prev) => ({ ...prev, ...updatedProfile }));
          alert('📍 Location updated!');
        } catch (err) {
          console.error('Update location error:', err.message);
          alert('Failed to update location.');
        }
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        alert('Failed to get your location.');
      }
    );
  };

  // Handle save
  const handleSave = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/profile`, {
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
      if (!res.ok) throw new Error(`Failed to save profile: ${res.status}`);
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
    return <div className="profile-container">Loading profile...</div>;
  }

  return (
    <div className="profile-container">
      <h2>Your Profile</h2>
      <div className="profile-avatar">
        <img src={profile.avatar || generateAvatar()} alt="Avatar" />
      </div>

      {isEditing ? (
        <div className="profile-form">
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
            {statusMoods.map((mood) => (
              <option key={mood.id} value={mood.id}>
                {mood.label} {mood.icon}
              </option>
            ))}
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
          <div className="profile-actions">
            <button onClick={handleSave} className="save-button">
              <Save size={16} /> Save
            </button>
            <button onClick={() => setIsEditing(false)} className="cancel-button">
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="profile-details">
          <p><strong>Username:</strong> {profile.username}</p>
          <p>
            <strong>Mood:</strong>{' '}
            {statusMoods.find((m) => m.id === profile.mood)?.label || profile.mood}{' '}
            {statusMoods.find((m) => m.id === profile.mood)?.icon || ''}
          </p>
          <p><strong>Bio:</strong> {profile.bio || 'No bio yet'}</p>
          <p><strong>Latitude:</strong> {profile.latitude}</p>
          <p><strong>Longitude:</strong> {profile.longitude}</p>

          <div className="profile-actions">
            <button onClick={() => setIsEditing(true)} className="edit-profile-button">
              <Edit size={16} /> Edit Profile
            </button>
            <button onClick={updateLocation} className="save-button">
              <MapPin size={16} /> Update Location
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
