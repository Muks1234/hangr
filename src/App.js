import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import io from 'socket.io-client';
import {
  Users,
  MessageCircle,
  Coffee,
  Music,
  Gamepad2,
  Book,
  Smile,
  LogOut,
  Edit,
  Trash2,
} from 'lucide-react';
import Auth from './Auth';
import Profile from './Profile'; // New import for Profile component
import './App.css';

// Use environment variable for backend
export const BACKEND_URL = 'http://localhost:5000' || 'https://hangr-backend.onrender.com';

function App() {
  const [activeTab, setActiveTab] = useState('spots');
  const [userStatus, setUserStatus] = useState('chill');
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [token, setToken] = useState(null);
  const [currentSpot, setCurrentSpot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [hangoutSpots, setHangoutSpots] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageText, setEditedMessageText] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const socketRef = useRef(null);

  const statusMoods = [
    { id: 'chill', label: 'Chill', icon: '😌' },
    { id: 'energetic', label: 'Energetic', icon: '⚡' },
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'social', label: 'Social', icon: '🤝' },
  ];

  // Initialize Socket.IO only once when token is available
  useEffect(() => {
    if (token && !socketRef.current) {
      socketRef.current = io(BACKEND_URL, {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: { token },
      });

      console.log('Socket.IO initialized, connected:', socketRef.current.connected);
    }
  }, [token]);

  // Handle Google OAuth callback
  useEffect(() => {
    if (location.pathname === '/auth/callback') {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const userId = params.get('userId');
      const username = params.get('username');
      const mood = params.get('mood');
      console.log('OAuth callback:', { token, userId, username, mood });
      if (token && userId && username) {
        localStorage.setItem('token', token);
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
        localStorage.setItem('mood', mood || 'chill');
        setToken(token);
        setUserId(userId);
        setUsername(username);
        setUserStatus(mood || 'chill');
        navigate('/');
      } else {
        console.error('Missing OAuth params:', { token, userId, username, mood });
      }
    }
  }, [location, navigate]);

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');
    const storedMood = localStorage.getItem('mood');
    console.log('Stored credentials:', { storedToken, storedUserId, storedUsername, storedMood });
    if (storedToken && storedUserId && storedUsername) {
      setToken(storedToken);
      setUserId(storedUserId);
      setUsername(storedUsername);
      setUserStatus(storedMood || 'chill');
    } else {
      console.warn('Incomplete stored credentials');
    }
  }, []);

  // Fetch spots from backend
  const fetchSpots = useCallback(async () => {
    try {
      console.log('Fetching spots with token:', token || localStorage.getItem('token'));
      const res = await fetch(`${BACKEND_URL}/api/spots`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to fetch spots: ${res.status}`);
      const data = await res.json();
      console.log('Spots fetched:', data);
      setHangoutSpots(
        data.map((spot) => ({
          ...spot,
          id: spot._id,
          icon: {
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
  }, [token]);

  useEffect(() => {
    if (token) fetchSpots();
  }, [fetchSpots, token]);

  // Setup Socket.IO listeners (run once when socket is available)
  useEffect(() => {
    if (!socketRef.current) {
      console.warn('Skipping socket listeners: no socket available');
      return;
    }

    const socket = socketRef.current;

    const handleJoin = ({ userId, spotId, username }) => {
      console.log('User joined spot:', { userId, spotId, username });
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
      console.log('User left spot:', { userId, spotId });
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

    const handleMessage = ({ message, userId, username, timestamp, spotId }) => {
      console.log('Received new message:', { message, userId, username, timestamp, spotId, currentSpot });
      if (spotId === currentSpot) {
        setMessages((prev) => {
          const optimisticMsg = prev.find((msg) => msg.message === message && msg.userId === userId && msg.isOptimistic);
          if (optimisticMsg) {
            return prev.map((msg) =>
              msg === optimisticMsg ? { message, userId, username, timestamp } : msg
            );
          }
          if (!prev.some((msg) => msg.message === message && msg.userId === userId && msg.timestamp === timestamp)) {
            return [...prev, { message, userId, username, timestamp }];
          }
          return prev;
        });
      } else {
        console.warn('Message ignored: spotId does not match currentSpot', { spotId, currentSpot });
      }
    };

    const handleMessageUpdated = ({ messageId, updatedMessage, timestamp, spotId }) => {
      if (spotId === currentSpot) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, message: updatedMessage, timestamp } : msg
          )
        );
      }
    };

    const handleMessageDeleted = ({ messageId, spotId }) => {
      if (spotId === currentSpot) {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      }
    };

    const handleTyping = ({ userId, username, spotId }) => {
      console.log('Typing event:', { userId, username, spotId });
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
    socket.on('message-updated', handleMessageUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('typing', handleTyping);
    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });

    return () => {
      socket.off('user-joined-spot', handleJoin);
      socket.off('user-left-spot', handleLeave);
      socket.off('new-message', handleMessage);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('typing', handleTyping);
      socket.off('error');
    };
  }, [socketRef, currentSpot]);

  // Handle login
  const handleLogin = ({ userId, username, token, mood }) => {
    console.log('Login successful:', { userId, username, token, mood });
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('username', username);
    localStorage.setItem('mood', mood || 'chill');
    setToken(token);
    setUserId(userId);
    setUsername(username);
    setUserStatus(mood || 'chill');
  };

  // Handle logout
  const handleLogout = () => {
    console.log('Logging out');
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('mood');
    setToken(null);
    setUserId(null);
    setUsername(null);
    setUserStatus('chill');
    setCurrentSpot(null);
    setMessages([]);
    setActiveUsers([]);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Join spot
  const joinSpot = async (spotId) => {
    if (!username || !userId || !socketRef.current) {
      console.error('Cannot join spot: missing username, userId, or socket', { username, userId });
      return;
    }
    console.log('Joining spot:', { spotId, username, userId });
    if (currentSpot) {
      socketRef.current.emit('leave-spot', { spotId: currentSpot, userId });
    }
    socketRef.current.emit('join-spot', { spotId, userId, username });
    setCurrentSpot(spotId);
    setMessages([]);
    setActiveUsers([]);
    setEditingMessageId(null);
    try {
      console.log('Fetching messages for spot:', spotId);
      const res = await fetch(`${BACKEND_URL}/api/spots/${spotId}/messages`);
      if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
      const data = await res.json();
      console.log('Messages fetched:', data);
      setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err.message);
    }
  };

  // Send message
  const sendMessage = (message) => {
    if (!message || !currentSpot || !username || !userId || !socketRef.current) {
      console.error('Cannot send message: missing data', { message, currentSpot, username, userId });
      return;
    }
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Unique temp ID
    const tempTimestamp = new Date().toISOString(); // Temp for optimistic update
    setMessages((prev) => [
      ...prev,
      { message, userId, username, timestamp: tempTimestamp, _id: tempMessageId, isOptimistic: true },
    ]);
    console.log('Sending message:', { message, spotId: currentSpot, userId, username });
    socketRef.current.emit('send-message', { message, spotId: currentSpot, userId, username });
  };

  // Edit message
  const startEditing = (messageId, currentText) => {
    setEditingMessageId(messageId);
    setEditedMessageText(currentText);
  };

  const saveEdit = (messageId) => {
    if (!editedMessageText || !currentSpot || !socketRef.current) return;
    socketRef.current.emit('edit-message', { messageId, updatedMessage: editedMessageText, spotId: currentSpot });
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId ? { ...msg, message: editedMessageText } : msg // Optimistic update
      )
    );
    setEditingMessageId(null);
    setEditedMessageText('');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditedMessageText('');
  };

  // Delete message
  const deleteMessage = (messageId) => {
    if (!currentSpot || !socketRef.current) return;
    socketRef.current.emit('delete-message', { messageId, spotId: currentSpot });
    setMessages((prev) => prev.filter((msg) => msg._id !== messageId)); // Optimistic delete
  };

  // Typing indicator
  const handleTyping = (e) => {
    if (e.target.value && currentSpot && username && userId && socketRef.current) {
      console.log('Emitting typing event:', { username, spotId: currentSpot });
      socketRef.current.emit('typing', { userId, username, spotId: currentSpot });
    }
  };

  // Spot Card
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

  // Render Auth if not logged in
  if (!token || !userId || !username) {
    return (
      <GoogleOAuthProvider clientId={'934486146442-9hj1qubb9bc6nlkuhog6thd8nb3pif2u.apps.googleusercontent.com'}>
        <Auth onLogin={handleLogin} />
      </GoogleOAuthProvider>
    );
  }

  // Main UI
  return (
    <div className="App">
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
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={20} color="#6b7280" />
            </button>
          </div>
        </div>
      </header>

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

      <main className="main-content">
        {activeTab === 'spots' && !currentSpot && (
          <div>
            <div className="section-header">
              <h2>Available Hangout Spots</h2>
              <p style={{ color: 'white' }}>
                Drop into any space that matches your vibe
              </p>
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
              <button style={{ color: 'white' }}
                className="back-button"
                onClick={() => {
                  if (socketRef.current) {
                    socketRef.current.emit('leave-spot', { spotId: currentSpot, userId });
                  }
                  setCurrentSpot(null);
                }}
              >
                Back to Spots
              </button>
            </div>
            <div className="active-users">
              <p style={{ color: 'white' }}>
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
            
            {/* Updated Messages Section with Bubble Chat */}
            <div className="messages">
              {messages.map((msg, idx) => {
                const formatTime = (timestamp) => {
                  if (!timestamp) return '';
                  const date = new Date(timestamp);
                  const now = new Date();
                  const diffInHours = Math.abs(now - date) / (1000 * 60 * 60);
                  
                  if (diffInHours < 24) {
                    return date.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    });
                  } else if (diffInHours < 168) {
                    return date.toLocaleDateString([], { 
                      weekday: 'short',
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    });
                  } else {
                    return date.toLocaleDateString([], { 
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    });
                  }
                };

                return (
                  <div 
                    key={msg._id || idx} 
                    className={`message ${msg.userId === userId ? 'own' : ''}`}
                  >
                    <div className="message-bubble">
                      <span className="message-user">{msg.username || msg.userId}</span>
                      {editingMessageId === msg._id ? (
                        <div className="edit-form">
                          <input
                            type="text"
                            value={editedMessageText}
                            onChange={(e) => setEditedMessageText(e.target.value)}
                            className="edit-input"
                            placeholder="Edit your message..."
                          />
                          <div className="edit-buttons">
                            <button onClick={() => saveEdit(msg._id)} className="save-button">
                              Save
                            </button>
                            <button onClick={cancelEdit} className="cancel-button">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="message-text">{msg.message}</span>
                          <div 
                            className="message-timestamp"
                            style={{
                              fontSize: '10px',
                              color: msg.userId === userId ? 'rgba(255, 255, 255, 0.7)' : '#9ca3af',
                              marginTop: '4px',
                              textAlign: 'right'
                            }}
                          >
                            {formatTime(msg.timestamp)}
                          </div>
                        </>
                      )}
                    </div>
                    {msg.userId === userId && (
                      <div className="message-actions">
                        <button 
                          onClick={() => startEditing(msg._id, msg.message)} 
                          className="edit-action"
                          title="Edit message"
                        >
                          <Edit size={12} />
                        </button>
                        <button 
                          onClick={() => deleteMessage(msg._id)} 
                          className="delete-action"
                          title="Delete message"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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

        {activeTab === 'profile' && (
          <div>
            <div className="section-header">
              <h2>Your Profile</h2>
            </div>
            <Profile userId={userId} username={username} token={token} onUpdate={(updated) => {
              setUsername(updated.username);
              setUserStatus(updated.mood);
            }} />
          </div>
        )}
      </main>

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