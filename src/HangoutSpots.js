import React, { useState, useEffect, useCallback } from 'react';
import { Coffee, Music, Gamepad2, Book, Users, MessageCircle, Smile, LogOut } from 'lucide-react';
import './HangoutSpots.css';

function HangoutSpots({ socket, userId, username, onLogout }) {
  const [activeTab, setActiveTab] = useState('spots');
  const [userStatus, setUserStatus] = useState('chill');
  const [currentSpot, setCurrentSpot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [hangoutSpots, setHangoutSpots] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  const BACKEND_URL = 'https://hangr-backend.onrender.com' || 'http://localhost:5000'; // Hardcoded backend URL

  const statusMoods = [
    { id: 'chill', label: 'Chill', icon: '😌' },
    { id: 'energetic', label: 'Energetic', icon: '⚡' },
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'social', label: 'Social', icon: '🤝' },
  ];

  // Fetch spots from backend
  const fetchSpots = useCallback(async () => {
    try {
      console.log('Fetching spots from:', `${BACKEND_URL}/api/spots`);
      const res = await fetch(`${BACKEND_URL}/api/spots`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch spots: ${res.status}`);
      const data = await res.json();
      console.log('Spots fetched:', data);
      setHangoutSpots(
        data.map((spot) => ({
          ...spot,
          id: spot._id,
          icon:
            {
              'Chill Café': Coffee,
              'Music Lounge': Music,
              'Game Corner': Gamepad2,
              'Study Spot': Book,
            }[spot.name] || Coffee,
          className: {
            'Chill Café': 'cafe',
            'Music Lounge': 'music',
            'Game Corner': 'gaming',
            'Study Spot': 'study',
          }[spot.name] || 'default',
          activeUsers: spot.activeUsers?.length || 0,
        }))
      );
    } catch (err) {
      console.error('Error fetching spots:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchSpots();
  }, [fetchSpots]);

  // Handle Socket.IO events
  useEffect(() => {
    if (!socket) return;

    const handleJoin = ({ userId: joinedUserId, spotId, username: joinedUsername }) => {
      console.log('User joined:', { userId: joinedUserId, spotId, username: joinedUsername });
      setHangoutSpots((prev) =>
        prev.map((spot) =>
          spot._id === spotId
            ? { ...spot, activeUsers: spot.activeUsers + 1 }
            : spot
        )
      );
      if (spotId === currentSpot) {
        setActiveUsers((prev) => {
          if (!prev.some((u) => u.userId === joinedUserId)) {
            return [...prev, { userId: joinedUserId, username: joinedUsername }];
          }
          return prev;
        });
      }
    };

    const handleLeave = ({ userId: leftUserId, spotId }) => {
      console.log('User left:', { userId: leftUserId, spotId });
      setHangoutSpots((prev) =>
        prev.map((spot) =>
          spot._id === spotId
            ? { ...spot, activeUsers: Math.max(0, spot.activeUsers - 1) }
            : spot
        )
      );
      if (spotId === currentSpot) {
        setActiveUsers((prev) => prev.filter((u) => u.userId !== leftUserId));
      }
    };

    const handleMessage = ({ message, userId: senderId, username: senderUsername, spotId, timestamp }) => {
      console.log('Received message:', { message, senderId, senderUsername, spotId, timestamp });
      if (spotId === currentSpot) {
        setMessages((prev) => [...prev, { message, userId: senderId, username: senderUsername, timestamp }]);
      } else {
        console.warn('Message received for wrong spot:', { receivedSpotId: spotId, currentSpot });
      }
    };

    const handleTyping = ({ userId, username, spotId }) => {
      if (spotId === currentSpot && userId !== userId) {
        setTypingUsers((prev) => {
          if (!prev.some((u) => u.userId === userId)) {
            return [...prev, { userId, username }];
          }
          return prev;
        });
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        }, 3000);
      }
    };

    const handleError = (err) => {
      console.error('Socket error:', err.message);
    };

    socket.on('user-joined-spot', handleJoin);
    socket.on('user-left-spot', handleLeave);
    socket.on('new-message', handleMessage);
    socket.on('typing', handleTyping);
    socket.on('error', handleError);

    return () => {
      socket.off('user-joined-spot', handleJoin);
      socket.off('user-left-spot', handleLeave);
      socket.off('new-message', handleMessage);
      socket.off('typing', handleTyping);
      socket.off('error', handleError);
    };
  }, [socket, currentSpot, userId]);

  // Join a spot
  const joinSpot = async (spotId) => {
    const spot = hangoutSpots.find((s) => s._id === spotId);
    console.log('Joining spot:', { spotId, spotName: spot?.name });
    if (currentSpot) {
      console.log('Leaving current spot:', currentSpot);
      socket.emit('leave-spot', { spotId: currentSpot });
    }
    socket.emit('join-spot', { spotId, username });
    setCurrentSpot(spotId);
    setMessages([]);
    setActiveUsers([]);
    try {
      console.log('Fetching messages from:', `${BACKEND_URL}/api/spots/${spotId}/messages`);
      const res = await fetch(`${BACKEND_URL}/api/spots/${spotId}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
      const data = await res.json();
      console.log('Messages fetched:', data);
      setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err.message);
    }
  };

  // Send a message
  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && currentSpot) {
      const spot = hangoutSpots.find((s) => s._id === currentSpot);
      console.log('Sending message:', { message: messageInput, spotId: currentSpot, spotName: spot?.name, username });
      socket.emit('send-message', { message: messageInput, spotId: currentSpot, username });
      setMessageInput('');
    } else {
      console.log('Cannot send message:', { messageInput, currentSpot });
    }
  };

  // Handle typing
  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value && currentSpot) {
      socket.emit('typing', { username, spotId: currentSpot });
    }
  };

  // Spot Card component
  const SpotCard = ({ spot }) => (
    <div
      className={`spot-card ${spot.className} fade-in`}
      onClick={() => joinSpot(spot._id)}
    >
      <div className="spot-card-header">
        <div className="spot-card-info">
          <div className="spot-icon">
            <spot.icon size={20} color="#374151" />
          </div>
          <div className="spot-details">
            <h3>{spot.name}</h3>
            <p>{spot.description}</p>
            <p><strong>Mood:</strong> {spot.mood}</p>
          </div>
        </div>
        <div className="user-count">
          <Users size={14} color="#6b7280" />
          <span>{spot.activeUsers}</span>
        </div>
      </div>
      <div className="spot-card-footer">
        <span className="mood-tag">{spot.mood} vibes</span>
        <button className="join-button">Join</button>
      </div>
    </div>
  );

  return (
    <div className="hangout-spots">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-title">
            <h1>Hangr</h1>
            <p>Find your digital hangout</p>
          </div>
          <div className="header-actions">
            <div className="status-badge">
              <span>{statusMoods.find((m) => m.id === userStatus)?.icon}</span>
              <span>{statusMoods.find((m) => m.id === userStatus)?.label}</span>
            </div>
            <div className="user-avatar">
              <span>{username ? username[0].toUpperCase() : 'U'}</span>
            </div>
            <button onClick={onLogout} className="logout-button">
              <LogOut size={20} color="#6b7280" />
            </button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="status-bar">
        <p className="status-bar-label">How are you feeling?</p>
        <div className="mood-buttons">
          {statusMoods.map((mood) => (
            <button
              key={mood.id}
              onClick={() => setUserStatus(mood.id)}
              className={`mood-button ${mood.id} ${userStatus === mood.id ? 'active' : ''}`}
            >
              <span>{mood.icon}</span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'spots' && !currentSpot && (
          <div>
            <div className="section-header">
              <h2>Available Hangout Spots</h2>
              <p>Drop into any space that matches your vibe</p>
            </div>
            <div className="spots-container">
              {hangoutSpots.map((spot) => (
                <SpotCard key={spot._id} spot={spot} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'spots' && currentSpot && (
          <div className="chat-container">
            <div className="section-header">
              <h2>Chatting in {hangoutSpots.find((s) => s._id === currentSpot)?.name || 'Unknown Spot'}</h2>
              <button
                className="back-button" style={{ color:  'white'}}
                onClick={() => {
                  console.log('Leaving spot:', currentSpot);
                  socket.emit('leave-spot', { spotId: currentSpot });
                  setCurrentSpot(null);
                }}
              >
                Back to Spots
              </button>
            </div>
            <div className="active-users" >
              <p style={{ color: 'white' }}>Active Users: {activeUsers.map((u) => u.username).join(', ') || 'None'}</p>
            </div>
            <div className="typing-indicator">
              {typingUsers.length > 0 && (
                <p>
                  {typingUsers.map((u) => u.username).join(', ')}{' '}
                  {typingUsers.length > 1 ? 'are' : 'is'} typing...
                </p>
              )}
            </div>
            <div className="messages">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message ${msg.userId === userId ? 'own' : ''}`}
                >
                  <span className="message-user">{msg.username || msg.userId}:</span>{' '}
                  {msg.message}
                  <span className="message-timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="chat-form">
              <input
                type="text"
                value={messageInput}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="message-input"
              />
              <button type="submit" className="send-button">
                Send
              </button>
            </form>
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="section-header">
            <h2>Chats</h2>
            <p>View your active conversations</p>
            {/* Placeholder for chats tab */}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="section-header">
            <h2>Friends</h2>
            <p>Connect with your buddies</p>
            {/* Placeholder for friends tab */}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="section-header">
            <h2>Profile</h2>
            <p>Manage your account</p>
            {/* Placeholder for profile tab */}
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="bottom-nav">
        <div className="nav-items">
          {[
            { id: 'spots', label: 'Spots', icon: Coffee },
            { id: 'chats', label: 'Chats', icon: MessageCircle },
            { id: 'friends', label: 'Friends', icon: Users },
            { id: 'profile', label: 'You', icon: Smile },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="bottom-padding"></div>
    </div>
  );
}

export default HangoutSpots;