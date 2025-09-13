import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Multiavatar from '@multiavatar/multiavatar';
import { BACKEND_URL } from './App';

const ViewProfile = ({ userId, targetUserId, token }) => {
  const [profile, setProfile] = useState({ username: '', mood: '', avatar: '', bio: '' });
  const [friendRequestStatus, setFriendRequestStatus] = useState('none'); 
  const [isAlreadyFriend, setIsAlreadyFriend] = useState(false); // ✅ check real friends
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/profile/${targetUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        // ✅ See if userId is in their friends
        if (data.friends && Array.isArray(data.friends)) {
          setIsAlreadyFriend(data.friends.some(f => f === userId || f?._id === userId));
        }

        setProfile({
          username: data.username || data.user?.username || 'Unknown User',
          mood: data.mood || data.user?.mood || 'Not set',
          avatar: data.avatar || data.user?.avatar || '',
          bio: data.bio || data.user?.bio || '',
        });
      } catch (err) {
        console.error('Error fetching profile:', err.message);
        setError(`Failed to load profile data: ${err.message}`);
      }
    };

    const fetchFriendRequestStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/friends/status`, {
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
        }
      } catch (err) {
        console.error('Error fetching friend request status:', err.message);
      }
    };

    if (token && targetUserId) {
      Promise.all([fetchProfile(), fetchFriendRequestStatus()])
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, userId, targetUserId]);

  const sendFriendRequest = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/request`, {
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

  if (error) {
    return <div className="profile-container">Error: {error}</div>;
  }

  return (
    <div className="profile-container">
      <h2>{profile.username}'s Profile</h2>
      <div className="profile-avatar">
        <img src={profile.avatar || generateAvatar() || null} alt="Avatar" />
      </div>
      <p><strong>Username:</strong> {profile.username}</p>
      <p><strong>Mood:</strong> {profile.mood}</p>
      <p><strong>Bio:</strong> {profile.bio}</p>

      {userId !== targetUserId && (
        <>
          {/* ✅ Only show request options if NOT already friends */}
          {!isAlreadyFriend && friendRequestStatus === 'none' && (
            <button onClick={sendFriendRequest} className="join-button">
              Add Friend
            </button>
          )}
          {!isAlreadyFriend && friendRequestStatus === 'pending' && <p>Friend request sent</p>}
          {!isAlreadyFriend && friendRequestStatus === 'rejected' && (
            <button onClick={sendFriendRequest} className="join-button">
              Send Request
            </button>
          )}

          {/* ✅ If already friends, no request stuff */}
          {isAlreadyFriend && (
            <button onClick={() => navigate(`/chat/${targetUserId}`)} className="join-button">
              ✅ Already Friends – Start Chat
            </button>
          )}
        </>
      )}
    </div>
  );

  function generateAvatar() {
    if (!targetUserId) return null;
    const svg = Multiavatar(targetUserId);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
};

export default ViewProfile;
