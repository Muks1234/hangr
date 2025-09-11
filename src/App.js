import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom';
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
import Profile from './Profile';
import ViewProfile from './ViewProfile';
import './App.css';

export const BACKEND_URL = 'https://hangr-backend.onrender.com' || 'http://localhost:5000';

function App() {
  const [activeTab, setActiveTab] = useState('spots');
  const [userStatus, setUserStatus] = useState('chill');
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [token, setToken] = useState(null);
  const [currentSpot, setCurrentSpot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [dmMessages, setDmMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [dmTypingUsers, setDmTypingUsers] = useState({});
  const [activeUsers, setActiveUsers] = useState([]);
  const [hangoutSpots, setHangoutSpots] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageText, setEditedMessageText] = useState('');
  const [friends, setFriends] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [friendRequests, setFriendRequests] = useState([]);
  const [toast, setToast] = useState(null);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [hasFetchedFriends, setHasFetchedFriends] = useState(false);
  const [hasFetchedChats, setHasFetchedChats] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const statusMoods = [
    { id: 'chill', label: 'Chill', icon: '😌' },
    { id: 'energetic', label: 'Energetic', icon: '⚡' },
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'social', label: 'Social', icon: '🤝' },
  ];

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, dmMessages, scrollToBottom]);

  // Fetch friends
  const fetchFriends = useCallback(async () => {
    if (!token) return;
    setIsLoadingFriends(true);
    try {
      console.log('Fetching friends with token:', token);
      const res = await fetch(`${BACKEND_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch friends: ${res.status} ${res.statusText}`);
      const friendsData = await res.json();
      console.log('Fetched friends:', friendsData);
      setFriends(friendsData);
      setHasFetchedFriends(true);
    } catch (err) {
      console.error('Error fetching friends:', err.message);
      setToast('Failed to load friends list');
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [token]);

  // Fetch friend requests
  const fetchFriendRequests = useCallback(async () => {
    if (!token) return;
    try {
      console.log('Fetching friend requests with token:', token);
      const res = await fetch(`${BACKEND_URL}/api/friends/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch friend requests: ${res.status} ${res.statusText}`);
      const requests = await res.json();
      console.log('Pending friend requests:', requests);
      setFriendRequests(requests.map((req) => ({
        senderId: req.senderId,
        senderUsername: req.senderUsername,
        requestId: req._id,
        status: req.status,
      })));
      setUnreadMessages((prev) => prev + requests.length);
    } catch (err) {
      console.error('Error fetching friend requests:', err.message);
      setToast('Failed to load friend requests');
      setTimeout(() => setToast(null), 5000);
    }
  }, [token]);

  // Fetch DMs for a conversation
  const fetchDmMessages = useCallback(
    async (otherUserId) => {
      if (!token || !otherUserId) return;
      try {
        console.log('Fetching DMs for:', { userId, otherUserId });
        const res = await fetch(`${BACKEND_URL}/api/conversations/${otherUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to fetch DMs: ${res.status}`);
        const data = await res.json();
        console.log('DMs fetched:', data.messages);
        setDmMessages((prev) => ({
          ...prev,
          [otherUserId]: data.messages.map((msg) => ({
            _id: msg._id,
            message: msg.message,
            senderId: msg.senderId,
            username: friends.find((f) => f.userId === msg.senderId)?.username || msg.senderId,
            timestamp: msg.timestamp,
          })),
        }));
      } catch (err) {
        console.error('Error fetching DMs:', err.message);
        setToast('Failed to load conversation');
        setTimeout(() => setToast(null), 5000);
      }
    },
    [token, userId]
  );

  // Fetch data when switching tabs
  useEffect(() => {
    if (token) {
      if (activeTab === 'friends' && !hasFetchedFriends) {
        setIsLoadingFriends(true);
        Promise.all([fetchFriends(), fetchFriendRequests()])
          .catch((err) => console.error('Error fetching friends data:', err))
          .finally(() => setIsLoadingFriends(false));
      } else if (activeTab === 'chats' && !hasFetchedChats) {
        setIsLoadingChats(true);
        fetchFriends()
          .then(() => {
            // Fetch DMs for all friends
            return Promise.all(
              friends.map((friend) => fetchDmMessages(friend.userId))
            );
          })
          .then(() => setHasFetchedChats(true))
          .catch((err) => console.error('Error fetching chats data:', err))
          .finally(() => setIsLoadingChats(false));
      }
    }
  }, [activeTab, token, fetchFriends, fetchFriendRequests, fetchDmMessages, hasFetchedFriends, hasFetchedChats]);

  // Initialize Socket.IO and listeners
  useEffect(() => {
    if (token && !socketRef.current) {
      socketRef.current = io(BACKEND_URL, {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: { token },
      });

      socketRef.current.on('connect', () => {
        console.log('Socket.IO connected:', socketRef.current.id, 'for userId:', userId);
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err.message);
      });

      socketRef.current.on('friend-request', ({ senderId, senderUsername, requestId }) => {
        console.log('Friend request received on frontend:', {
          senderId,
          senderUsername,
          requestId,
          currentUserId: userId,
          existingRequests: friendRequests,
        });
        setFriendRequests((prev) => {
          if (!prev.some((req) => req.requestId === requestId)) {
            return [...prev, { senderId, senderUsername, requestId, status: 'pending' }];
          }
          return prev;
        });
        setUnreadMessages((prev) => prev + 1);
        setToast(`New friend request from ${senderUsername}`);
        setTimeout(() => setToast(null), 5000);
      });

      socketRef.current.on('friend-request-accepted', ({ senderId, senderUsername, receiverId, receiverUsername }) => {
        console.log('Friend request accepted:', { senderId, senderUsername, receiverId, receiverUsername });
        setFriendRequests((prev) =>
          prev.filter((req) =>
            userId === senderId
              ? req.senderId !== receiverId
              : req.senderId !== senderId
          )
        );
        if (senderId === userId) {
          setFriends((prev) => {
            if (!prev.some((friend) => friend.userId === receiverId)) {
              return [...prev, { userId: receiverId, username: receiverUsername }];
            }
            return prev;
          });
          setToast(`Friend request to ${receiverUsername} accepted`);
        } else if (receiverId === userId) {
          setFriends((prev) => {
            if (!prev.some((friend) => friend.userId === senderId)) {
              return [...prev, { userId: senderId, username: senderUsername }];
            }
            return prev;
          });
          setToast(`Friend request from ${senderUsername} accepted`);
        }
        setUnreadMessages((prev) => Math.max(0, prev - 1));
        setTimeout(() => setToast(null), 5000);
      });

      socketRef.current.on('friend-request-rejected', ({ requestId }) => {
        console.log('Friend request rejected:', { requestId, currentUserId: userId });
        setFriendRequests((prev) => prev.filter((req) => req.requestId !== requestId));
        setToast('A friend request was rejected');
        setUnreadMessages((prev) => Math.max(0, prev - 1));
        setTimeout(() => setToast(null), 5000);
      });

      socketRef.current.on('new-message', ({ message, userId, username, timestamp, spotId, _id }) => {
        console.log('Received new message:', { message, userId, username, timestamp, spotId, currentSpot });
        if (spotId === currentSpot) {
          setMessages((prev) => {
            const optimisticMsg = prev.find(
              (msg) => msg.message === message && msg.userId === userId && msg.isOptimistic
            );
            if (optimisticMsg) {
              return prev.map((msg) =>
                msg === optimisticMsg ? { message, userId, username, timestamp, _id } : msg
              );
            }
            if (
              !prev.some(
                (msg) => msg.message === message && msg.userId === userId && msg.timestamp === timestamp
              )
            ) {
              return [...prev, { message, userId, username, timestamp, _id }];
            }
            return prev;
          });
        } else {
          console.warn('Message ignored: spotId does not match currentSpot', { spotId, currentSpot });
        }
        if (activeTab !== 'chats') setUnreadMessages((prev) => prev + 1);
      });

      socketRef.current.on('message-updated', ({ messageId, updatedMessage, timestamp, spotId }) => {
        if (spotId === currentSpot) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === messageId ? { ...msg, message: updatedMessage, timestamp } : msg
            )
          );
        }
      });

      socketRef.current.on('message-deleted', ({ messageId, spotId }) => {
        if (spotId === currentSpot) {
          setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        }
      });

      socketRef.current.on('typing', ({ userId, username, spotId }) => {
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
      });

      socketRef.current.on('new-dm', ({ _id, message, senderId, username, otherUserId, timestamp }) => {
        console.log('Received new DM:', { _id, message, senderId, username, otherUserId, timestamp });
        const chatUserId = location.pathname.startsWith('/chat/') ? location.pathname.split('/')[2] : null;
        setDmMessages((prev) => {
          const key = senderId === userId ? otherUserId : senderId;
          const chatMessages = prev[key] || [];
          const optimisticMsg = chatMessages.find(
            (msg) => msg.message === message && msg.senderId === senderId && msg.isOptimistic
          );
          if (optimisticMsg) {
            return {
              ...prev,
              [key]: chatMessages.map((msg) =>
                msg === optimisticMsg ? { _id, message, senderId, username, timestamp } : msg
              ),
            };
          }
          if (
            !chatMessages.some(
              (msg) => msg.message === message && msg.senderId === senderId && msg.timestamp === timestamp
            )
          ) {
            return {
              ...prev,
              [key]: [...chatMessages, { _id, message, senderId, username, timestamp }],
            };
          }
          return prev;
        });
        if (chatUserId !== (senderId === userId ? otherUserId : senderId) && activeTab !== 'chats') {
          setUnreadMessages((prev) => prev + 1);
          setToast(`New message from ${username}`);
          setTimeout(() => setToast(null), 5000);
        }
      });

      socketRef.current.on('dm-updated', ({ messageId, updatedMessage, timestamp, otherUserId }) => {
        console.log('DM updated:', { messageId, updatedMessage, timestamp, otherUserId });
        setDmMessages((prev) => {
          const key = userId === otherUserId ? location.pathname.split('/')[2] : otherUserId;
          const chatMessages = prev[key] || [];
          return {
            ...prev,
            [key]: chatMessages.map((msg) =>
              msg._id === messageId ? { ...msg, message: updatedMessage, timestamp } : msg
            ),
          };
        });
      });

      socketRef.current.on('dm-deleted', ({ messageId, otherUserId }) => {
        console.log('DM deleted:', { messageId, otherUserId });
        setDmMessages((prev) => {
          const key = userId === otherUserId ? location.pathname.split('/')[2] : otherUserId;
          const chatMessages = prev[key] || [];
          return {
            ...prev,
            [key]: chatMessages.filter((msg) => msg._id !== messageId),
          };
        });
      });

      socketRef.current.on('dm-typing', ({ userId: senderId, username, otherUserId }) => {
        console.log('DM typing event:', { senderId, username, otherUserId });
        const chatUserId = location.pathname.startsWith('/chat/') ? location.pathname.split('/')[2] : null;
        if (chatUserId === (senderId === userId ? otherUserId : senderId)) {
          setDmTypingUsers((prev) => ({
            ...prev,
            [senderId]: { userId: senderId, username },
          }));
          setTimeout(() => {
            setDmTypingUsers((prev) => {
              const newTypingUsers = { ...prev };
              delete newTypingUsers[senderId];
              return newTypingUsers;
            });
          }, 3000);
        }
      });

      socketRef.current.on('user-joined-spot', ({ userId, spotId, username }) => {
        console.log('User joined spot:', { userId, spotId, username });
        setHangoutSpots((prev) =>
          prev.map((spot) =>
            spot._id === spotId ? { ...spot, activeUsers: spot.activeUsers + 1 } : spot
          )
        );
        if (spotId === currentSpot) {
          setActiveUsers((prev) => [...prev, { userId, username }]);
        }
      });

      socketRef.current.on('user-left-spot', ({ userId, spotId }) => {
        console.log('User left spot:', { userId, spotId });
        setHangoutSpots((prev) =>
          prev.map((spot) =>
            spot._id === spotId ? { ...spot, activeUsers: Math.max(0, spot.activeUsers - 1) } : spot
          )
        );
        if (spotId === currentSpot) {
          setActiveUsers((prev) => prev.filter((u) => u.userId !== userId));
        }
      });

      socketRef.current.on('error', ({ message }) => {
        console.error('Socket error:', message);
        setToast(`Error: ${message}`);
        setTimeout(() => setToast(null), 5000);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('connect_error');
        socketRef.current.off('friend-request');
        socketRef.current.off('friend-request-accepted');
        socketRef.current.off('friend-request-rejected');
        socketRef.current.off('new-message');
        socketRef.current.off('message-updated');
        socketRef.current.off('message-deleted');
        socketRef.current.off('typing');
        socketRef.current.off('new-dm');
        socketRef.current.off('dm-updated');
        socketRef.current.off('dm-deleted');
        socketRef.current.off('dm-typing');
        socketRef.current.off('user-joined-spot');
        socketRef.current.off('user-left-spot');
        socketRef.current.off('error');
      }
    };
  }, [token, activeTab, currentSpot, userId, location]);

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

  // Fetch initial data on mount
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
      setIsLoadingFriends(true);
      Promise.all([fetchFriends(), fetchFriendRequests()])
        .catch((err) => console.error('Error fetching initial data:', err))
        .finally(() => setIsLoadingFriends(false));
    } else {
      console.warn('Incomplete stored credentials');
    }
  }, [fetchFriends, fetchFriendRequests]);

  // Fetch spots
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
    setDmMessages({});
    setActiveUsers([]);
    setFriends([]);
    setFriendRequests([]);
    setUnreadMessages(0);
    setHasFetchedFriends(false);
    setHasFetchedChats(false);
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

  // Send group message
  const sendMessage = (message) => {
    if (!message || !currentSpot || !username || !userId || !socketRef.current) {
      console.error('Cannot send message: missing data', { message, currentSpot, username, userId });
      return;
    }
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempTimestamp = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { message, userId, username, timestamp: tempTimestamp, _id: tempMessageId, isOptimistic: true },
    ]);
    console.log('Sending message:', { message, spotId: currentSpot, userId, username });
    socketRef.current.emit('send-message', { message, spotId: currentSpot, userId, username });
  };

  // Send direct message
  const sendDm = (message, otherUserId) => {
    if (!message || !otherUserId || !username || !userId || !socketRef.current) {
      console.error('Cannot send DM: missing data', { message, otherUserId, username, userId });
      return;
    }
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempTimestamp = new Date().toISOString();
    setDmMessages((prev) => {
      const chatMessages = prev[otherUserId] || [];
      return {
        ...prev,
        [otherUserId]: [
          ...chatMessages,
          { _id: tempMessageId, message, senderId: userId, username, timestamp: tempTimestamp, isOptimistic: true },
        ],
      };
    });
    console.log('Sending DM:', { message, otherUserId, userId, username });
    socketRef.current.emit('send-dm', { message, otherUserId, userId, username });
  };

  // Start editing message
  const startEditing = (messageId, currentText) => {
    setEditingMessageId(messageId);
    setEditedMessageText(currentText);
  };

  // Save edited message
  const saveEdit = (messageId, otherUserId = null) => {
    if (!editedMessageText || !socketRef.current) return;
    if (otherUserId) {
      socketRef.current.emit('edit-dm', { messageId, updatedMessage: editedMessageText, otherUserId });
      setDmMessages((prev) => {
        const chatMessages = prev[otherUserId] || [];
        return {
          ...prev,
          [otherUserId]: chatMessages.map((msg) =>
            msg._id === messageId ? { ...msg, message: editedMessageText } : msg
          ),
        };
      });
    } else if (currentSpot) {
      socketRef.current.emit('edit-message', { messageId, updatedMessage: editedMessageText, spotId: currentSpot });
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, message: editedMessageText } : msg
        )
      );
    }
    setEditingMessageId(null);
    setEditedMessageText('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditedMessageText('');
  };

  // Delete message
  const deleteMessage = (messageId, otherUserId = null) => {
    if (!socketRef.current) return;
    if (otherUserId) {
      socketRef.current.emit('delete-dm', { messageId, otherUserId });
      setDmMessages((prev) => {
        const chatMessages = prev[otherUserId] || [];
        return {
          ...prev,
          [otherUserId]: chatMessages.filter((msg) => msg._id !== messageId),
        };
      });
    } else if (currentSpot) {
      socketRef.current.emit('delete-message', { messageId, spotId: currentSpot });
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    }
  };

  // Handle typing
  const handleTyping = (e, otherUserId = null) => {
    if (e.target.value && username && userId && socketRef.current) {
      if (otherUserId) {
        console.log('Emitting DM typing event:', { username, otherUserId });
        socketRef.current.emit('dm-typing', { userId, username, otherUserId });
      } else if (currentSpot) {
        console.log('Emitting typing event:', { username, spotId: currentSpot });
        socketRef.current.emit('typing', { userId, username, spotId: currentSpot });
      }
    }
  };

  // Handle friend request response
  const handleFriendRequestResponse = async (requestId, accept) => {
    try {
      console.log('Responding to friend request:', { requestId, accept, token });
      const res = await fetch(`${BACKEND_URL}/api/friends/response`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, accept }),
      });
      if (!res.ok) throw new Error(`Failed to respond to friend request: ${res.status} ${res.statusText}`);
      const data = await res.json();
      console.log('Friend request response:', data);
      setFriendRequests((prev) => prev.filter((req) => req.requestId !== requestId));
      if (accept) {
        fetchFriends(); // Refetch friends to update the list
        const request = friendRequests.find((req) => req.requestId === requestId);
        if (request) {
          setToast(`Added ${request.senderUsername} as a friend`);
        }
      } else {
        setToast('Friend request rejected');
      }
      setUnreadMessages((prev) => Math.max(0, prev - 1));
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.error('Error responding to friend request:', err.message);
      setToast('Error processing friend request');
      setTimeout(() => setToast(null), 5000);
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

  return (
    <div className="App">
      {toast && (
        <div
          className="toast"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#4caf50',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      )}
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
        <Routes>
          <Route
            path="/"
            element={
              <>
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
                      <button
                        style={{ color: 'white' }}
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
                              hour12: true,
                            });
                          } else if (diffInHours < 168) {
                            return date.toLocaleDateString([], {
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            });
                          } else {
                            return date.toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            });
                          }
                        };

                        return (
                          <div
                            key={msg._id || idx}
                            className={`message ${msg.userId === userId ? 'own' : ''}`}
                          >
                            <div className="message-bubble">
                              <span
                                className="message-user"
                                onClick={() => navigate(`/profile/${msg.userId}`)}
                                style={{ cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline' }}
                              >
                                {msg.username || msg.userId}
                              </span>
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
                                      textAlign: 'right',
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
                      <div ref={messagesEndRef} />
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
                    <Profile
                      userId={userId}
                      username={username}
                      token={token}
                      onUpdate={(updated) => {
                        setUsername(updated.username);
                        setUserStatus(updated.mood);
                      }}
                    />
                  </div>
                )}

                {activeTab === 'friends' && (
                  <div className="friends-container">
                    <div className="section-header">
                      <h2>Friends</h2>
                    </div>
                    {isLoadingFriends ? (
                      <div className="loading">Loading friends...</div>
                    ) : friends.length === 0 ? (
                      <div className="no-friends-message">No friends yet. Start connecting!</div>
                    ) : (
                      <div>
                        {friends.map((friend) => (
                          <div
                            key={friend.userId}
                            onClick={() => navigate(`/chat/${friend.userId}`)}
                            className="friend-item"
                          >
                            <span>{friend.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="section-header">
                      <h2>Friend Requests</h2>
                    </div>
                    <div className="friend-requests-container">
                      {isLoadingFriends ? (
                        <div className="loading">Loading friend requests...</div>
                      ) : friendRequests.length === 0 ? (
                        <div className="no-requests-message">No pending friend requests.</div>
                      ) : (
                        friendRequests.map((req) => (
                          <div key={req.requestId} className="friend-request-item">
                            <span>{req.senderUsername} sent you a friend request</span>
                            <div className="friend-request-buttons">
                              <button
                                onClick={() => handleFriendRequestResponse(req.requestId, true)}
                                className="friend-request-button accept"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleFriendRequestResponse(req.requestId, false)}
                                className="friend-request-button reject"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'chats' && (
                  <div className="chats-container">
                    <div className="section-header">
                      <h2>Chats</h2>
                    </div>
                    {isLoadingChats ? (
                      <div className="loading">Loading chats...</div>
                    ) : friends.length === 0 ? (
                      <div className="no-friends-message">No friends yet. Start connecting!</div>
                    ) : (
                      <div>
                        {friends.map((friend) => (
                          <div
                            key={friend.userId}
                            onClick={() => navigate(`/chat/${friend.userId}`)}
                            className="friend-item"
                          >
                            <span>{friend.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <main className="main-content">
                <div className="section-header">
                  <h2>User Profile</h2>
                  <button
                    onClick={() => navigate('/')}
                    className="back-button"
                  >
                    Back to Spots
                  </button>
                </div>
                <ViewProfile
                  userId={userId}
                  targetUserId={location.pathname.split('/')[2]}
                  token={token}
                />
              </main>
            }
          />
          <Route
            path="/chat/:userId"
            element={
              <main className="main-content">
                <div className="section-header">
                  <h2>
                    Chat with{' '}
                    {friends.find((f) => f.userId === location.pathname.split('/')[2])?.username || 'User'}
                  </h2>
                  <button
                    onClick={() => navigate('/')}
                    className="back-button"
                  >
                    Back to Spots
                  </button>
                </div>
                <div className="chat-container">
                  <div className="typing-indicator">
                    {dmTypingUsers[location.pathname.split('/')[2]] && (
                      <p>
                        {dmTypingUsers[location.pathname.split('/')[2]].username} is typing...
                      </p>
                    )}
                  </div>
                  <div className="messages">
                    {(dmMessages[location.pathname.split('/')[2]] || []).map((msg, idx) => {
                      const formatTime = (timestamp) => {
                        if (!timestamp) return '';
                        const date = new Date(timestamp);
                        const now = new Date();
                        const diffInHours = Math.abs(now - date) / (1000 * 60 * 60);

                        if (diffInHours < 24) {
                          return date.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          });
                        } else if (diffInHours < 168) {
                          return date.toLocaleDateString([], {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          });
                        } else {
                          return date.toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          });
                        }
                      };

                      return (
                        <div
                          key={msg._id || idx}
                          className={`message ${msg.senderId === userId ? 'own' : ''}`}
                        >
                          <div className="message-bubble">
                            <span
                              className="message-user"
                              onClick={() => navigate(`/profile/${msg.senderId}`)}
                              style={{ cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline' }}
                            >
                              {msg.username || msg.senderId}
                            </span>
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
                                  <button
                                    onClick={() => saveEdit(msg._id, location.pathname.split('/')[2])}
                                    className="save-button"
                                  >
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
                                    color: msg.senderId === userId ? 'rgba(255, 255, 255, 0.7)' : '#9ca3af',
                                    marginTop: '4px',
                                    textAlign: 'right',
                                  }}
                                >
                                  {formatTime(msg.timestamp)}
                                </div>
                              </>
                            )}
                          </div>
                          {msg.senderId === userId && (
                            <div className="message-actions">
                              <button
                                onClick={() => startEditing(msg._id, msg.message)}
                                className="edit-action"
                                title="Edit message"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => deleteMessage(msg._id, location.pathname.split('/')[2])}
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
                    <div ref={messagesEndRef} />
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const message = e.target.message.value;
                      const otherUserId = location.pathname.split('/')[2];
                      if (message && otherUserId) {
                        sendDm(message, otherUserId);
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
                      onChange={(e) => handleTyping(e, location.pathname.split('/')[2])}
                    />
                    <button type="submit" className="send-button">
                      Send
                    </button>
                  </form>
                </div>
              </main>
            }
          />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <div className="nav-items">
          {[
            { id: 'spots', label: 'Spots', icon: Coffee },
            {
              id: 'chats',
              label: 'Chats',
              icon: MessageCircle,
              badge: unreadMessages > 0 ? unreadMessages : null,
            },
            {
              id: 'friends',
              label: 'Friends',
              icon: Users,
              badge: friendRequests.length > 0 ? friendRequests.length : null,
            },
            { id: 'profile', label: 'You', icon: Smile },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'chats' || tab.id === 'friends') {
                  setUnreadMessages(0);
                }
              }}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={20} />
              {tab.badge && <span className="badge">{tab.badge}</span>}
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