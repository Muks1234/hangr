// src/ViewProfile.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Multiavatar from '@multiavatar/multiavatar';

const ViewProfile = ({ userId, targetUserId, token }) => {
  const [profile, setProfile] = useState({ username: '', mood: '', avatar: '', bio: '' });
  const [friendRequestStatus, setFriendRequestStatus] = useState('none'); // 'none', 'pending', 'accepted', 'rejected'
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/users/profile/${targetUserId}`, {
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
    if (token && targetUserId) fetchProfile();
  }, [token, targetUserId]);

  const generateAvatar = () => {
    if (!targetUserId) return '';
    const svg = Multiavatar(targetUserId);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const sendFriendRequest = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/friends/request', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ senderId: userId, receiverId: targetUserId }),
      });
      if (!res.ok) throw new Error('Failed to send friend request');
      setFriendRequestStatus('pending');
    } catch (err) {
      console.error('Error sending friend request:', err.message);
    }
  };

  if (loading) {
    return <div className="profile-container">Loading...</div>;
  }

  return (
    <div className="profile-container">
      <h2>{profile.username}'s Profile</h2>
      <div className="profile-avatar">
        <img src={profile.avatar || generateAvatar()} alt="Avatar" />
      </div>
      <p><strong>Username:</strong> {profile.username}</p>
      <p><strong>Mood:</strong> {profile.mood}</p>
      <p><strong>Bio:</strong> {profile.bio || 'No bio yet'}</p>
      {friendRequestStatus === 'none' && (
        <button onClick={sendFriendRequest} className="join-button">
          Add Friend
        </button>
      )}
      {friendRequestStatus === 'pending' && <p>Friend request sent</p>}
      {friendRequestStatus === 'accepted' && <p>Friends!</p>}
      {friendRequestStatus === 'rejected' && <p>Friend request rejected</p>}
    </div>
  );
};

export default ViewProfile;