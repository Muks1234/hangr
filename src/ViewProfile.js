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
        const res = await fetch(`https://hangr-backend.onrender.com/api/users/profile/${targetUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err.message);
      }
    };

    const fetchFriendRequestStatus = async () => {
      try {
        const res = await fetch('https://hangr-backend.onrender.com/api/friends/status', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ senderId: userId, receiverId: targetUserId }),
        });
        if (res.ok) {
          const data = await res.json();
          setFriendRequestStatus(data.status || 'none');
        } else {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
      } catch (err) {
        console.error('Error fetching friend request status:', err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token && targetUserId) {
      fetchProfile();
      fetchFriendRequestStatus();
    }
  }, [token, userId, targetUserId]);

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
      const data = await res.json();
      setFriendRequestStatus(data.status);
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
      {/* Hide friend request buttons/messages when viewing own profile */}
      {userId !== targetUserId && (
        <>
          {friendRequestStatus === 'none' && (
            <button onClick={sendFriendRequest} className="join-button">
              Add Friend
            </button>
          )}
          {friendRequestStatus === 'pending' && <p>Friend request sent</p>}
          {friendRequestStatus === 'rejected' && (
            <button onClick={sendFriendRequest} className="join-button">
              Send Request
            </button>
          )}
          {friendRequestStatus === 'accepted' && (
            <button onClick={() => navigate(`/chat/${targetUserId}`)} className="join-button">
              Start Chat
            </button>
          )}
        </>
      )}
    </div>
  );

  function generateAvatar() {
    if (!targetUserId) return '';
    const svg = Multiavatar(targetUserId);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
};

export default ViewProfile;