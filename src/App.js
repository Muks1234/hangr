import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Users, MessageCircle, Coffee, Music, Gamepad2, Book, Smile } from 'lucide-react';
import './App.css';

// Initialize Socket.IO connection (update URL after deploying backend)
const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

function App() {
  const [activeTab, setActiveTab] = useState('spots');
  const [userStatus, setUserStatus] = useState('chill');
  const [userId] = useState('user123'); // Replace with actual user ID after auth
  const [currentSpot, setCurrentSpot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hangoutSpots, setHangoutSpots] = useState([
    {
      id: '1',
      name: 'Chill Café',
      icon: Coffee,
      description: 'Low-key conversations & good vibes',
      activeUsers: 0,
      mood: 'relaxed',
      className: 'cafe',
    },
    {
      id: '2',
      name: 'Music Lounge',
      icon: Music,
      description: 'Share tracks, discover new sounds',
      activeUsers: 0,
      mood: 'groovy',
      className: 'music',
    },
    {
      id: '3',
      name: 'Game Corner',
      icon: Gamepad2,
      description: 'Casual gaming & friendly competition',
      activeUsers: 0,
      mood: 'energetic',
      className: 'gaming',
    },
    {
      id: '4',
      name: 'Study Spot',
      icon: Book,
      description: 'Focus together, support each other',
      activeUsers: 0,
      mood: 'focused',
      className: 'study',
    },
  ]);

  const statusMoods = [
    { id: 'chill', label: 'Chill', icon: '😌' },
    { id: 'energetic', label: 'Energetic', icon: '⚡' },
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'social', label: 'Social', icon: '🤝' },
  ];

  useEffect(() => {
    // Fetch initial spots from backend
    fetch('http://localhost:5000/api/spots')
      .then((res) => res.json())
      .then((data) => {
        setHangoutSpots(
          data.map((spot) => ({
            ...spot,
            icon: { 'Chill Café': Coffee, 'Music Lounge': Music, 'Game Corner': Gamepad2, 'Study Spot': Book }[spot.name],
            className: spot.mood,
          }))
        );
      })
      .catch((err) => console.error('Error fetching spots:', err));

    // Socket.IO listeners
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.on('user-joined-spot', ({ userId, spotId }) => {
      setHangoutSpots((prevSpots) =>
        prevSpots.map((spot) =>
          spot.id === spotId ? { ...spot, activeUsers: spot.activeUsers + 1 } : spot
        )
      );
    });

    socket.on('user-left-spot', ({ userId, spotId }) => {
      setHangoutSpots((prevSpots) =>
        prevSpots.map((spot) =>
          spot.id === spotId ? { ...spot, activeUsers: Math.max(0, spot.activeUsers - 1) } : spot
        )
      );
    });

    socket.on('new-message', ({ message, userId, timestamp }) => {
      setMessages((prev) => [...prev, { message, userId, timestamp }]);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinSpot = (spotId) => {
    if (currentSpot) {
      socket.emit('leave-spot', { spotId: currentSpot, userId });
    }
    socket.emit('join-spot', { spotId, userId });
    setCurrentSpot(spotId);
    setMessages([]); // Clear messages when joining a new spot
    // Fetch message history for the spot (optional)
    fetch(`http://localhost:5000/api/spots/${spotId}/messages`)
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error('Error fetching messages:', err));
  };

  const sendMessage = (message) => {
    if (message && currentSpot) {
      socket.emit('send-message', { message, spotId: currentSpot, userId });
    }
  };

  const SpotCard = ({ spot }) => (
    <div className={`spot-card ${spot.className} fade-in`} onClick={() => joinSpot(spot.id)}>
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

  return (
    <div className="App">
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
              <span>J</span>
            </div>
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
                <SpotCard key={spot.id} spot={spot} />
              ))}
            </div>
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="quick-actions-grid">
                <button className="quick-action-button">
                  <MessageCircle size={18} color="#6b7280" />
                  <span>Start Chat</span>
                </button>
                <button className="quick-action-button">
                  <Users size={18} color="#6b7280" />
                  <span>Find Friends</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'spots' && currentSpot && (
          <div className="chat-container">
            <div className="section-header">
              <h2>Chatting in {hangoutSpots.find((s) => s.id === currentSpot)?.name}</h2>
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
            <div className="messages">
              {messages.map((msg, idx) => (
                <div key={idx} className="message">
                  <span className="message-user">{msg.userId}:</span> {msg.message}
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
              />
              <button type="submit" className="send-button">
                Send
              </button>
            </form>
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="section-header">
            <h2>Your Chats</h2>
            <p>Recent conversations and active hangouts</p>
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="section-header">
            <h2>Your Circle</h2>
            <p>Friends and people you've connected with</p>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="section-header">
            <h2>Your Profile</h2>
            <p>Customize your hangout experience</p>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
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