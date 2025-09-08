import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import {
  Users,
  MessageCircle,
  Coffee,
  Music,
  Gamepad2,
  Book,
  Smile,
} from 'lucide-react';
import './App.css';

// ✅ Use environment variable for backend
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// ✅ Initialize Socket.IO once
const socket = io(BACKEND_URL, {
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

function App() {
  const [activeTab, setActiveTab] = useState('spots');
  const [userStatus, setUserStatus] = useState('chill');
  const [userId] = useState('user123'); // Replace with real auth
  const [username] = useState('User123'); // Replace with real auth
  const [currentSpot, setCurrentSpot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [hangoutSpots, setHangoutSpots] = useState([]);

  const statusMoods = [
    { id: 'chill', label: 'Chill', icon: '😌' },
    { id: 'energetic', label: 'Energetic', icon: '⚡' },
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'social', label: 'Social', icon: '🤝' },
  ];

  // ✅ Fetch spots from backend
 const fetchSpots = useCallback(async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/spots`);
    if (!res.ok) throw new Error(`Failed to fetch spots: ${res.status}`);
    const data = await res.json();
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
          'Study Spot': 'study'
        }[spot.name] || 'default',
        activeUsers: spot.activeUsers?.length || 0,
      }))
    );
  } catch (err) {
    console.error(err);
  }
}, []);

  useEffect(() => {
    fetchSpots();
  }, [fetchSpots]);

  // ✅ Setup Socket.IO listeners
  useEffect(() => {
    const handleJoin = ({ userId, spotId, username }) => {
      setHangoutSpots((prev) =>
        prev.map((spot) =>
          spot._id === spotId
            ? { ...spot, activeUsers: spot.activeUsers + 1 }
            : spot
        )
      );
      if (spotId === currentSpot) {
        setActiveUsers((prev) => [...prev, { userId, username }]);
      }
    };

    const handleLeave = ({ userId, spotId }) => {
      setHangoutSpots((prev) =>
        prev.map((spot) =>
          spot._id === spotId
            ? { ...spot, activeUsers: Math.max(0, spot.activeUsers - 1) }
            : spot
        )
      );
      if (spotId === currentSpot) {
        setActiveUsers((prev) => prev.filter((u) => u.userId !== userId));
      }
    };

    const handleMessage = ({ message, userId, username, timestamp }) => {
      setMessages((prev) => [...prev, { message, userId, username, timestamp }]);
    };

    const handleTyping = ({ userId, username, spotId }) => {
      if (spotId === currentSpot) {
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

    socket.on('user-joined-spot', handleJoin);
    socket.on('user-left-spot', handleLeave);
    socket.on('new-message', handleMessage);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('user-joined-spot', handleJoin);
      socket.off('user-left-spot', handleLeave);
      socket.off('new-message', handleMessage);
      socket.off('typing', handleTyping);
    };
  }, [currentSpot]);

  // ✅ Join spot
  const joinSpot = async (spotId) => {
    if (currentSpot) {
      socket.emit('leave-spot', { spotId: currentSpot, userId });
    }
    socket.emit('join-spot', { spotId, userId, username });
    setCurrentSpot(spotId);
    setMessages([]);
    setActiveUsers([]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/spots/${spotId}/messages`);
      if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Send message
  const sendMessage = (message) => {
    if (message && currentSpot) {
      socket.emit('send-message', { message, spotId: currentSpot, userId, username });
    }
  };

  // ✅ Typing indicator
  const handleTyping = (e) => {
    if (e.target.value && currentSpot) {
      socket.emit('typing', { userId, username, spotId: currentSpot });
    }
  };

  // ✅ Spot Card
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

  // ✅ UI
  return (
    <div className="App">
      {/* HEADER */}
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
              <span>{username[0] || 'U'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* STATUS BAR */}
      <div className="status-bar">
        <p className="status-bar-label">How are you feeling?</p>
        <div className="mood-buttons">
          {statusMoods.map((mood) => (
            <button
              key={mood.id}
              onClick={() => setUserStatus(mood.id)}
              className={`mood-button ${mood.id} ${
                userStatus === mood.id ? 'active' : ''
              }`}
            >
              <span>{mood.icon}</span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
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
              <h2>
                Chatting in {hangoutSpots.find((s) => s._id === currentSpot)?.name}
              </h2>
              <button
                className="back-button"
                onClick={() => {
                  socket.emit('leave-spot', { spotId: currentSpot, userId });
                  setCurrentSpot(null);
                }}
              >
                Back to Spots
              </button>
            </div>
            <div className="active-users">
              <p>
                Active Users:{' '}
                {activeUsers.map((u) => u.username).join(', ') || 'None'}
              </p>
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
                <div key={idx} className="message">
                  <span className="message-user">{msg.username || msg.userId}:</span>{' '}
                  {msg.message}
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const message = e.target.message.value;
                if (message) {
                  sendMessage(message);
                  e.target.reset();
                }
              }}
              className="chat-form"
            >
              <input
                type="text"
                name="message"
                placeholder="Type a message..."
                className="message-input"
                onChange={handleTyping}
              />
              <button type="submit" className="send-button">
                Send
              </button>
            </form>
          </div>
        )}
      </main>

      {/* NAVIGATION */}
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

export default App;
