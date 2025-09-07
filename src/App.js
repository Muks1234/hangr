import React, { useState } from 'react';
import { Users, MessageCircle, Coffee, Music, Gamepad2, Book, Heart, Smile } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('spots');
  const [userStatus, setUserStatus] = useState('chill');

  const hangoutSpots = [
    {
      id: 1,
      name: "Chill Café",
      icon: Coffee,
      description: "Low-key conversations & good vibes",
      activeUsers: 23,
      mood: "relaxed",
      className: "cafe"
    },
    {
      id: 2,
      name: "Music Lounge",
      icon: Music,
      description: "Share tracks, discover new sounds",
      activeUsers: 17,
      mood: "groovy",
      className: "music"
    },
    {
      id: 3,
      name: "Game Corner",
      icon: Gamepad2,
      description: "Casual gaming & friendly competition",
      activeUsers: 31,
      mood: "energetic",
      className: "gaming"
    },
    {
      id: 4,
      name: "Study Spot",
      icon: Book,
      description: "Focus together, support each other",
      activeUsers: 12,
      mood: "focused",
      className: "study"
    }
  ];

  const statusMoods = [
    { id: 'chill', label: 'Chill', icon: '😌' },
    { id: 'energetic', label: 'Energetic', icon: '⚡' },
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'social', label: 'Social', icon: '🤝' }
  ];

  const SpotCard = ({ spot }) => (
    <div className={`spot-card ${spot.className} fade-in`}>
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
        <span className="mood-tag">
          {spot.mood} vibes
        </span>
        <button className="join-button">
          Join
        </button>
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
              <span>{statusMoods.find(m => m.id === userStatus)?.icon}</span>
              <span>{statusMoods.find(m => m.id === userStatus)?.label}</span>
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
        {activeTab === 'spots' && (
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

            {/* Quick Actions */}
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
            { id: 'profile', label: 'You', icon: Smile }
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

      {/* Bottom padding to account for fixed nav */}
      <div className="bottom-padding"></div>
    </div>
  );
}

export default App;