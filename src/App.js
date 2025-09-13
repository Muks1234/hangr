import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Routes, Route, useParams } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import io from 'socket.io-client';
import {
  Users,
  MessageCircle,
  Smile,
  LogOut,
  Edit,
  Trash2,
  PlusCircle,
  MapPin,
} from 'lucide-react';
import Auth from './Auth';
import Profile from './Profile';
import ViewProfile from './ViewProfile';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import './App.css';

export const BACKEND_URL = 'https://hangr-backend.onrender.com' || 'http://localhost:5000';

// ProfileWrapper for handling dynamic userId in profile route
const ProfileWrapper = ({ userId, token, fetchUsername }) => {
  const { userId: targetUserId } = useParams();
  return (
    <ViewProfile
      userId={userId}
      targetUserId={targetUserId}
      token={token}
      fetchUsername={fetchUsername}
    />
  );
};

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
  const [descriptionLength, setDescriptionLength] = useState(0);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const usernameCache = useRef({});
  const pendingSpots = useRef(new Map());
  const location = useLocation();
  const navigate = useNavigate();

  const statusMoods = [
    { id: 'chill', label: 'Chill', icon: '😌' },
    { id: 'energetic', label: 'Energetic', icon: '⚡' },
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'social', label: 'Social', icon: '🤝' },
  ];

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, dmMessages, scrollToBottom]);

  // Update active tab based on route
  useEffect(() => {
    if (location.pathname === '/') {
      setActiveTab('spots');
    } else if (location.pathname.startsWith('/chat/')) {
      setActiveTab('chats');
    } else if (location.pathname.startsWith('/profile/') || location.pathname === '/profile') {
      setActiveTab('profile');
    } else if (location.pathname === '/friends') {
      setActiveTab('friends');
    } else if (location.pathname === '/chats') {
      setActiveTab('chats');
    } else if (location.pathname === '/create-spot') {
      setActiveTab('spots');
    } else if (location.pathname === '/search') {
      setActiveTab('friends');
    }
  }, [location.pathname]);

  // Fetch username with caching
  const fetchUsername = useCallback(
    async (id) => {
      if (usernameCache.current[id]) {
        return usernameCache.current[id];
      }
      try {
        const response = await fetch(`${BACKEND_URL}/api/users/profile/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Failed to fetch username: ${response.status}`);
        const data = await response.json();
        usernameCache.current[id] = data.username || id;
        return data.username || id;
      } catch (err) {
        //console.error('Error fetching username:', err.message);
        return id;
      }
    },
    [token]
  );

  // Fetch friends
  const fetchFriends = useCallback(async () => {
    if (!token) return;
    setIsLoadingFriends(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch friends: ${response.status}`);
      const friendsData = await response.json();
      setFriends(friendsData);
      friendsData.forEach((friend) => {
        usernameCache.current[friend.userId] = friend.username;
      });
      setHasFetchedFriends(true);
    } catch (err) {
      //console.error('Error fetching friends:', err.message);
      setToast('Failed to load friends');
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [token]);

  // Fetch friend requests
  const fetchFriendRequests = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch friend requests: ${response.status}`);
      const requests = await response.json();
      setFriendRequests(
        requests.map((req) => ({
          senderId: req.senderId,
          senderUsername: req.senderUsername,
          requestId: req._id,
          status: req.status,
        }))
      );
      setUnreadMessages((prev) => prev + requests.length);
    } catch (err) {
      //console.error('Error fetching friend requests:', err.message);
      setToast('Failed to load friend requests');
      setTimeout(() => setToast(null), 5000);
    }
  }, [token]);

  // Fetch DM messages
  const fetchDmMessages = useCallback(
    async (otherUserId) => {
      if (!token || !otherUserId) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/conversations/${otherUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Failed to fetch DMs: ${response.status}`);
        const data = await response.json();
        const messagesWithUsernames = await Promise.all(
          data.messages.map(async (msg) => ({
            _id: msg._id,
            message: msg.message,
            senderId: msg.senderId,
            username: friends.find((f) => f.userId === msg.senderId)?.username || (await fetchUsername(msg.senderId)),
            timestamp: msg.timestamp,
          }))
        );
        setDmMessages((prev) => ({
          ...prev,
          [otherUserId]: messagesWithUsernames,
        }));
      } catch (err) {
        //console.error('Error fetching DMs:', err.message);
        setToast('Failed to load conversation');
        setTimeout(() => setToast(null), 5000);
      }
    },
    [token, friends, fetchUsername]
  );

  // Fetch friends and chats when needed
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'friends' && !hasFetchedFriends) {
      setIsLoadingFriends(true);
      Promise.all([fetchFriends(), fetchFriendRequests()])
        .catch((err) => console.error('Error fetching friends data:', err))
        .finally(() => setIsLoadingFriends(false));
    } else if (activeTab === 'chats' && !hasFetchedChats) {
      setIsLoadingChats(true);
      fetchFriends()
        .then(() => Promise.all(friends.map((friend) => fetchDmMessages(friend.userId))))
        .then(() => setHasFetchedChats(true))
        .catch((err) => console.error('Error fetching chats data:', err))
        .finally(() => setIsLoadingChats(false));
    }
  }, [activeTab, token, fetchFriends, fetchFriendRequests, fetchDmMessages, hasFetchedFriends, hasFetchedChats, friends]);

  // Socket.IO setup
  useEffect(() => {
    if (!token || socketRef.current) return;

   // console.log('Setting up Socket.IO connection');
    socketRef.current = io(BACKEND_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: { token },
    });

    socketRef.current.on('connect', () => {
      //console.log('Socket.IO connected:', socketRef.current.id, 'for userId:', userId);
      if (currentSpot) {
        //console.log('Rejoining spot on connect:', currentSpot);
        socketRef.current.emit('join-spot', { spotId: currentSpot, userId, username });
      }
    });

    socketRef.current.on('reconnect_attempt', (attempt) => {
     // console.log('Socket.IO reconnect attempt:', attempt);
    });

    socketRef.current.on('reconnect', () => {
      console.log('Socket.IO reconnected');
      if (currentSpot) {
       // console.log('Rejoining spot on reconnect:', currentSpot);
        socketRef.current.emit('join-spot', { spotId: currentSpot, userId, username });
      }
    });

    socketRef.current.on('connect_error', (err) => {
     // console.error('Socket.IO connection error:', err.message);
      if (err.message.includes('Token expired')) {
        setToast('Session expired, please log in again');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('mood');
        setToken(null);
        setUserId(null);
        setUsername(null);
        setUserStatus('chill');
        socketRef.current.disconnect();
        socketRef.current = null;
        navigate('/auth');
        setTimeout(() => setToast(null), 5000);
      }
    });

    socketRef.current.on('error', ({ message }) => {
      //console.error('Socket.IO error:', message);
      setToast(`Error: ${message}`);
      setTimeout(() => setToast(null), 5000);
    });

    socketRef.current.on('friend-request', ({ senderId, senderUsername, requestId }) => {
     // console.log('Received friend-request:', { senderId, senderUsername, requestId });
      setFriendRequests((prev) => {
        if (!prev.some((req) => req.requestId === requestId)) {
          usernameCache.current[senderId] = senderUsername;
          return [...prev, { senderId, senderUsername, requestId, status: 'pending' }];
        }
        return prev;
      });
      setUnreadMessages((prev) => prev + 1);
      setToast(`New friend request from ${senderUsername}`);
      setTimeout(() => setToast(null), 5000);
    });

    socketRef.current.on('friend-request-accepted', ({ senderId, senderUsername, receiverId, receiverUsername }) => {
      //console.log('Received friend-request-accepted:', { senderId, senderUsername, receiverId, receiverUsername });
      setFriendRequests((prev) =>
        prev.filter((req) => (userId === senderId ? req.senderId !== receiverId : req.senderId !== senderId))
      );
      if (senderId === userId) {
        setFriends((prev) => {
          if (!prev.some((friend) => friend.userId === receiverId)) {
            usernameCache.current[receiverId] = receiverUsername;
            return [...prev, { userId: receiverId, username: receiverUsername }];
          }
          return prev;
        });
        setToast(`Friend request to ${receiverUsername} accepted`);
      } else if (receiverId === userId) {
        setFriends((prev) => {
          if (!prev.some((friend) => friend.userId === senderId)) {
            usernameCache.current[senderId] = senderUsername;
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
      //console.log('Received friend-request-rejected:', { requestId });
      setFriendRequests((prev) => prev.filter((req) => req.requestId !== requestId));
      setToast('A friend request was rejected');
      setUnreadMessages((prev) => Math.max(0, prev - 1));
      setTimeout(() => setToast(null), 5000);
    });

    socketRef.current.on('new-message', async ({ message, userId: senderId, username, timestamp, spotId, _id }) => {
      //console.log('Received new-message:', { spotId, currentSpot, message, senderId, _id });
      const resolvedUsername = username || usernameCache.current[senderId] || (await fetchUsername(senderId));
      if (spotId === currentSpot) {
        setMessages((prev) => {
          const optimisticMsg = prev.find((msg) => msg.isOptimistic && msg.userId === senderId && msg.message === message);
          if (optimisticMsg) {
           // console.log('Replacing optimistic message:', optimisticMsg._id, 'with:', _id);
            return prev.map((msg) =>
              msg === optimisticMsg ? { message, userId: senderId, username: resolvedUsername, timestamp, _id } : msg
            );
          }
          if (!prev.some((msg) => msg._id === _id)) {
            //console.log('Adding new message:', { message, senderId, _id });
            return [...prev, { message, userId: senderId, username: resolvedUsername, timestamp, _id }];
          }
          console.log('Message already exists:', _id);
          return prev;
        });
      } else {
        //console.log('Message ignored: spotId does not match currentSpot');
        if (activeTab !== 'chats') setUnreadMessages((prev) => prev + 1);
      }
    });

    socketRef.current.on('message-updated', ({ messageId, updatedMessage, timestamp, spotId }) => {
      //console.log('Received message-updated:', { messageId, updatedMessage, spotId });
      if (spotId === currentSpot) {
        setMessages((prev) =>
          prev.map((msg) => (msg._id === messageId ? { ...msg, message: updatedMessage, timestamp } : msg))
        );
      }
    });

    socketRef.current.on('message-deleted', ({ messageId, spotId }) => {
      //console.log('Received message-deleted:', { messageId, spotId });
      if (spotId === currentSpot) {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      }
    });

    socketRef.current.on('typing', ({ userId, username, spotId }) => {
      //console.log('Received typing:', { userId, username, spotId });
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

    socketRef.current.on('new-dm', async ({ _id, message, senderId, username, otherUserId, timestamp }) => {
      //console.log('Received new-dm:', { _id, message, senderId, otherUserId });
      const resolvedUsername = username || usernameCache.current[senderId] || (await fetchUsername(senderId));
      const chatUserId = location.pathname.startsWith('/chat/') ? location.pathname.split('/')[2] : null;
      setDmMessages((prev) => {
        const key = senderId === userId ? otherUserId : senderId;
        const chatMessages = prev[key] || [];
        const optimisticMsg = chatMessages.find(
          (msg) => msg.isOptimistic && msg.senderId === senderId && msg.message === message
        );
        if (optimisticMsg) {
          //console.log('Replacing optimistic DM:', optimisticMsg._id, 'with:', _id);
          return {
            ...prev,
            [key]: chatMessages.map((msg) =>
              msg === optimisticMsg ? { _id, message, senderId, username: resolvedUsername, timestamp } : msg
            ),
          };
        }
        if (!chatMessages.some((msg) => msg._id === _id)) {
         // console.log('Adding new DM:', { _id, message, senderId });
          return {
            ...prev,
            [key]: [...chatMessages, { _id, message, senderId, username: resolvedUsername, timestamp }],
          };
        }
        //console.log('DM already exists:', _id);
        return prev;
      });
      if (chatUserId !== (senderId === userId ? otherUserId : senderId) && activeTab !== 'chats') {
        setUnreadMessages((prev) => prev + 1);
        setToast(`New message from ${resolvedUsername}`);
        setTimeout(() => setToast(null), 5000);
      }
    });

    socketRef.current.on('dm-updated', ({ messageId, updatedMessage, timestamp, otherUserId }) => {
     // console.log('Received dm-updated:', { messageId, updatedMessage, otherUserId });
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
     // console.log('Received dm-deleted:', { messageId, otherUserId });
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
     // console.log('Received dm-typing:', { senderId, username, otherUserId });
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

    socketRef.current.on('user-joined-spot', ({ userId: joinedUserId, spotId, username }) => {
     // console.log('Received user-joined-spot:', { userId: joinedUserId, spotId, username });
      setHangoutSpots((prev) =>
        prev.map((spot) =>
          spot._id === spotId
            ? {
                ...spot,
                members: spot.members.includes(joinedUserId)
                  ? spot.members
                  : [...(spot.members || []), joinedUserId],
              }
            : spot
        )
      );
      if (spotId === currentSpot) {
        setActiveUsers((prev) => {
          if (!prev.some((u) => u.userId === joinedUserId)) {
            return [...prev, { userId: joinedUserId, username }];
          }
          return prev;
        });
      }
    });

    socketRef.current.on('user-left-spot', ({ userId: leftUserId, spotId }) => {
      //console.log('Received user-left-spot:', { userId: leftUserId, spotId });
      setHangoutSpots((prev) =>
        prev.map((spot) =>
          spot._id === spotId
            ? { ...spot, members: (spot.members || []).filter((id) => id !== leftUserId) }
            : spot
        )
      );
      if (spotId === currentSpot) {
        setActiveUsers((prev) => prev.filter((u) => u.userId !== leftUserId));
      }
    });

    socketRef.current.on('new-spot', ({ spotId, _id, name, handle, description, location, members, username, creatorId }) => {
     // console.log('Received new-spot:', { spotId, name, handle, creatorId });
      setHangoutSpots((prev) => {
        if (prev.some((spot) => spot._id === spotId)) {
          return prev;
        }
        const tempSpotEntry = Array.from(pendingSpots.current.entries()).find(
          ([, spot]) => spot.handle === handle && spot.isOptimistic
        );
        if (tempSpotEntry && creatorId === userId) {
          const [tempId] = tempSpotEntry;
          pendingSpots.current.delete(tempId);
          return prev.map((spot) =>
            spot._id === tempId
              ? {
                  _id: spotId,
                  id: spotId,
                  name,
                  handle,
                  description,
                  latitude: location?.coordinates?.[1] ?? 0,
                  longitude: location?.coordinates?.[0] ?? 0,
                  distanceInKm: 0,
                  members: members || [],
                  icon: MessageCircle,
                  className: 'default',
                }
              : spot
          );
        }
        return [
          ...prev,
          {
            _id: spotId,
            id: spotId,
            name,
            handle,
            description,
            latitude: location?.coordinates?.[1] ?? 0,
            longitude: location?.coordinates?.[0] ?? 0,
            distanceInKm: 0,
            members: members || [],
            icon: MessageCircle,
            className: 'default',
          },
        ];
      });
      if (creatorId !== userId) {
        setToast(`New spot created: ${name} by ${username}`);
        setTimeout(() => setToast(null), 5000);
      }
    });

    return () => {
      if (socketRef.current) {
        console.log('Disconnecting Socket.IO');
        socketRef.current.off('connect');
        socketRef.current.off('reconnect_attempt');
        socketRef.current.off('reconnect');
        socketRef.current.off('connect_error');
        socketRef.current.off('error');
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
        socketRef.current.off('new-spot');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, activeTab, currentSpot, userId, username, location, navigate, fetchUsername]);

  // Handle auth callback
  useEffect(() => {
    if (location.pathname === '/auth/callback') {
      const params = new URLSearchParams(location.search);
      const authToken = params.get('token');
      const authUserId = params.get('userId');
      const authUsername = params.get('username');
      const authMood = params.get('mood');
      if (authToken && authUserId && authUsername) {
        localStorage.setItem('token', authToken);
        localStorage.setItem('userId', authUserId);
        localStorage.setItem('username', authUsername);
        localStorage.setItem('mood', authMood || 'chill');
        setToken(authToken);
        setUserId(authUserId);
        setUsername(authUsername);
        setUserStatus(authMood || 'chill');
        usernameCache.current[authUserId] = authUsername;
        navigate('/');
      }
    }
  }, [location, navigate]);

  // Load stored auth data
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');
    const storedMood = localStorage.getItem('mood');
    if (storedToken && storedUserId && storedUsername) {
      setToken(storedToken);
      setUserId(storedUserId);
      setUsername(storedUsername);
      setUserStatus(storedMood || 'chill');
      usernameCache.current[storedUserId] = storedUsername;
      setIsLoadingFriends(true);
      Promise.all([fetchFriends(), fetchFriendRequests()])
        .catch((err) => console.error('Error fetching initial data:', err))
        .finally(() => setIsLoadingFriends(false));
    }
  }, [fetchFriends, fetchFriendRequests]);

  // Fetch nearby spots
  const fetchSpots = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/spots/nearby`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400 && errorData.error === 'User location not set') {
          setToast('Please set your location in your profile to view nearby spots');
          setTimeout(() => setToast(null), 5000);
          navigate('/profile');
          return;
        }
        throw new Error(`Failed to fetch nearby spots: ${response.status} ${errorData.error || response.statusText}`);
      }
      const data = await response.json();
      setHangoutSpots(
        data.map((spot) => ({
          _id: spot._id,
          id: spot._id,
          name: spot.name,
          handle: spot.handle,
          description: spot.description,
          latitude: spot.location?.coordinates?.[1] ?? 0,
          longitude: spot.location?.coordinates?.[0] ?? 0,
          distanceInKm: spot.distanceInKm ?? 0,
          members: Array.isArray(spot.members) ? spot.members : [],
          icon: MessageCircle,
          className: 'default',
        }))
      );
      pendingSpots.current.clear();
    } catch (err) {
     // console.error('Error fetching nearby spots:', err.message);
      setToast('Failed to load nearby spots');
      setTimeout(() => setToast(null), 5000);
    }
  }, [token, navigate]);

  useEffect(() => {
    if (token) fetchSpots();
  }, [fetchSpots, token]);

  // Create a new spot
  const createSpot = async (spotData) => {
    if (!token || !userId) {
      setToast('Please log in to create a spot');
      setTimeout(() => setToast(null), 5000);
      return;
    }
    const tempSpotId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticSpot = {
      _id: tempSpotId,
      id: tempSpotId,
      name: spotData.name,
      handle: spotData.handle,
      description: spotData.description,
      latitude: spotData.latitude,
      longitude: spotData.longitude,
      distanceInKm: 0,
      members: [userId],
      icon: MessageCircle,
      className: 'default',
      isOptimistic: true,
      tempId: tempSpotId,
    };
    pendingSpots.current.set(tempSpotId, optimisticSpot);
    setHangoutSpots((prev) => [...prev, optimisticSpot]);
    try {
      const response = await fetch(`${BACKEND_URL}/api/spots`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(spotData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create spot: ${response.status} ${errorData.error || response.statusText}`);
      }
      const newSpot = await response.json();
      pendingSpots.current.delete(tempSpotId);
      setHangoutSpots((prev) =>
        prev.map((spot) =>
          spot._id === tempSpotId
            ? {
                _id: newSpot._id,
                id: newSpot._id,
                name: newSpot.name,
                handle: newSpot.handle,
                description: newSpot.description,
                latitude: newSpot.location?.coordinates?.[1] ?? 0,
                longitude: newSpot.location?.coordinates?.[0] ?? 0,
                distanceInKm: newSpot.distanceInKm ?? 0,
                members: Array.isArray(newSpot.members) ? newSpot.members : [userId],
                icon: MessageCircle,
                className: 'default',
              }
            : spot
        )
      );
      setToast('Spot created successfully!');
      setTimeout(() => setToast(null), 5000);
      navigate('/');
    } catch (err) {
      //console.error('Error creating spot:', err.message);
      setHangoutSpots((prev) => prev.filter((spot) => spot._id !== tempSpotId));
      pendingSpots.current.delete(tempSpotId);
      setToast(`Failed to create spot: ${err.message}`);
      setTimeout(() => setToast(null), 5000);
    }
  };

  // Join a spot
  const joinSpot = async (spotId) => {
    if (!username || !userId || !socketRef.current) {
    //  console.error('Cannot join spot: missing data', { username, userId });
      return;
    }
    if (currentSpot) {
    //  console.log('Leaving current spot:', currentSpot);
      socketRef.current.emit('leave-spot', { spotId: currentSpot, userId });
    }
   // console.log('Joining spot:', spotId);
    setCurrentSpot(spotId);
    socketRef.current.emit('join-spot', { spotId, userId, username });
    setMessages([]);
    setActiveUsers([]);
    setTypingUsers([]);
    setEditingMessageId(null);
    try {
     // console.log('Fetching messages for spot:', spotId);
      const response = await fetch(`${BACKEND_URL}/api/spots/${spotId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch messages: ${response.status}`);
      const data = await response.json();
      const messagesWithUsernames = await Promise.all(
        data.map(async (msg) => ({
          ...msg,
          username: msg.username || usernameCache.current[msg.userId] || (await fetchUsername(msg.userId)),
        }))
      );
    //  console.log('Messages fetched:', messagesWithUsernames);
      setMessages(messagesWithUsernames);
    } catch (err) {
     // console.error('Error fetching messages:', err.message);
      setToast('Failed to load messages');
      setTimeout(() => setToast(null), 5000);
    }
    navigate('/');
  };

  // Handle login
  const handleLogin = ({ userId, username, token, mood }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('username', username);
    localStorage.setItem('mood', mood || 'chill');
    setToken(token);
    setUserId(userId);
    setUsername(username);
    setUserStatus(mood || 'chill');
    usernameCache.current[userId] = username;
    navigate('/');
  };

  // Handle logout
  const handleLogout = () => {
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
    setTypingUsers([]);
    setDmTypingUsers({});
    setFriends([]);
    setFriendRequests([]);
    setUnreadMessages(0);
    setHasFetchedFriends(false);
    setHasFetchedChats(false);
    usernameCache.current = {};
    pendingSpots.current.clear();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    navigate('/');
  };

  // Send spot message
  const sendMessage = (message) => {
    if (!message || !currentSpot || !username || !userId || !socketRef.current) {
      //console.error('Cannot send message: missing data', { message, currentSpot, username, userId });
      return;
    }
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempTimestamp = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { message, userId, username, timestamp: tempTimestamp, _id: tempMessageId, isOptimistic: true },
    ]);
   // console.log('Sending message:', { message, spotId: currentSpot, userId, username });
    socketRef.current.emit('send-message', { message, spotId: currentSpot, userId, username });
  };

  // Send DM
  const sendDm = (message, otherUserId) => {
    if (!message || !otherUserId || !username || !userId || !socketRef.current) {
     // console.error('Cannot send DM: missing data', { message, otherUserId, username, userId });
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
  //  console.log('Sending DM:', { message, otherUserId, userId, username });
    socketRef.current.emit('send-dm', { message, otherUserId, userId, username });
  };

  // Start editing a message
  const startEditing = (messageId, currentText) => {
    setEditingMessageId(messageId);
    setEditedMessageText(currentText);
  };

  // Save edited message
  const saveEdit = (messageId, otherUserId = null) => {
    if (!editedMessageText || !socketRef.current) return;
    if (otherUserId) {
      //console.log('Saving edited DM:', { messageId, updatedMessage: editedMessageText, otherUserId });
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
    //  console.log('Saving edited message:', { messageId, updatedMessage: editedMessageText, spotId: currentSpot });
      socketRef.current.emit('edit-message', { messageId, updatedMessage: editedMessageText, spotId: currentSpot });
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, message: editedMessageText } : msg))
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
     // console.log('Deleting DM:', { messageId, otherUserId });
      socketRef.current.emit('delete-dm', { messageId, otherUserId });
      setDmMessages((prev) => {
        const chatMessages = prev[otherUserId] || [];
        return {
          ...prev,
          [otherUserId]: chatMessages.filter((msg) => msg._id !== messageId),
        };
      });
    } else if (currentSpot) {
     // console.log('Deleting message:', { messageId, spotId: currentSpot });
      socketRef.current.emit('delete-message', { messageId, spotId: currentSpot });
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    }
  };

  // Handle typing indicator
  const handleTyping = (e, otherUserId = null) => {
    if (e.target.value && username && userId && socketRef.current) {
      if (otherUserId) {
        console.log('Emitting dm-typing:', { userId, username, otherUserId });
        socketRef.current.emit('dm-typing', { userId, username, otherUserId });
      } else if (currentSpot) {
      //  console.log('Emitting typing:', { userId, username, spotId: currentSpot });
        socketRef.current.emit('typing', { userId, username, spotId: currentSpot });
      }
    }
  };

  // Handle friend request response
  const handleFriendRequestResponse = async (requestId, accept) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/friends/response`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, accept }),
      });
      if (!response.ok) throw new Error(`Failed to respond to friend request: ${response.status}`);
      setFriendRequests((prev) => prev.filter((req) => req.requestId !== requestId));
      if (accept) {
        await fetchFriends();
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
     // console.error('Error responding to friend request:', err.message);
      setToast('Error processing friend request');
      setTimeout(() => setToast(null), 5000);
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    if (!token || !userId) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update profile: ${response.status} ${errorData.error || response.statusText}`);
      }
      const updatedUser = await response.json();
      setUsername(updatedUser.username);
      setUserStatus(updatedUser.mood || 'chill');
      localStorage.setItem('username', updatedUser.username);
      localStorage.setItem('mood', updatedUser.mood || 'chill');
      usernameCache.current[userId] = updatedUser.username;
      setToast('Profile updated successfully');
      setTimeout(() => setToast(null), 5000);
      fetchSpots();
    } catch (err) {
     // console.error('Error updating profile:', err.message);
      setToast('Failed to update profile');
      setTimeout(() => setToast(null), 5000);
    }
  };

  // SpotCard component
  const SpotCard = ({ spot }) => (
    <div className={`spot-card ${spot.className} fade-in`} onClick={() => joinSpot(spot._id)}>
      <div className="spot-card-header">
        <div className="spot-card-info">
          <div className="spot-icon">
            <MessageCircle size={20} color="#374151" />
          </div>
          <div className="spot-details">
            <h3>
              {spot.name} (@{spot.handle})
            </h3>
            <p>{spot.description}</p>
            <p>
              <strong>Distance:</strong>{' '}
              {typeof spot.distanceInKm === 'number' ? `${spot.distanceInKm.toFixed(1)} km from you` : 'Unknown'}
            </p>
          </div>
        </div>
        <div className="user-count">
          <Users size={14} color="#6b7280" />
          <span>{Array.isArray(spot.members) ? spot.members.length : 0}</span>
        </div>
      </div>
      <div className="spot-card-footer">
        <button className="join-button">Join</button>
      </div>
    </div>
  );

  // Render login if not authenticated
  if (!token || !userId || !username) {
    return (
      <GoogleOAuthProvider clientId="934486146442-9hj1qubb9bc6nlkuhog6thd8nb3pif2u.apps.googleusercontent.com">
        <Auth onLogin={handleLogin} />
      </GoogleOAuthProvider>
    );
  }

  // Main app render
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
            <button onClick={() => navigate('/create-spot')} className="create-spot-button" title="Create a new spot">
              <PlusCircle size={20} color="#6b7280" />
            </button>
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
              className={`mood-button ${mood.id} ${userStatus === mood.id ? 'active' : ''}`}
            >
              <span>{mood.icon}</span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
        <SearchBar />
      </div>

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              activeTab === 'spots' && !currentSpot ? (
                <div>
                  <div className="section-header">
                    <h2>Nearby Hangout Spots</h2>
                    <p style={{ color: 'white' }}>Drop into spaces near you</p>
                  </div>
                  <div className="spots-container">
                    {hangoutSpots.length === 0 ? (
                      <p>No spots found nearby.</p>
                    ) : (
                      hangoutSpots.map((spot) => <SpotCard key={spot._id} spot={spot} />)
                    )}
                  </div>
                </div>
              ) : activeTab === 'spots' && currentSpot ? (
                <div className="chat-container">
                  <div className="section-header">
                    <h2>Chatting in {hangoutSpots.find((s) => s._id === currentSpot)?.name || 'Spot'}</h2>
                    <button
                      style={{ color: 'white' }}
                      className="back-button"
                      onClick={() => {
                        if (socketRef.current) {
                          socketRef.current.emit('leave-spot', { spotId: currentSpot, userId });
                        }
                        setCurrentSpot(null);
                        navigate('/');
                      }}
                    >
                      Back to Spots
                    </button>
                  </div>
                  <div className="active-users">
                    <p style={{ color: 'white' }}>
                      Active Users: {activeUsers.map((u) => u.username).join(', ') || 'None'}
                    </p>
                  </div>
                  <div className="typing-indicator">
                    {typingUsers.length > 0 && (
                      <p>
                        {typingUsers.map((u) => u.username).join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
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
                          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        } else if (diffInHours < 168) {
                          return date.toLocaleDateString([], {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          });
                        }
                        return date.toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        });
                      };

                      return (
                        <div key={msg._id || idx} className={`message ${msg.userId === userId ? 'own' : ''}`}>
                          <div className="message-bubble">
                            <span
                              className="message-user"
                              onClick={() => navigate(`/profile/${msg.userId}`)}
                              style={{ cursor: 'pointer', color: '#d4af37', textDecoration: 'underline' }}
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
              ) : null
            }
          />
          <Route
            path="/create-spot"
            element={
              <main className="main-content">
                <div className="section-header">
                  <h2>Create a New Spot</h2>
                  <button onClick={() => navigate('/')} className="back-button">
                    Back to Spots
                  </button>
                </div>
                <div className="create-spot-form">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const latitude = parseFloat(e.target.latitude.value) || 0;
                      const longitude = parseFloat(e.target.longitude.value) || 0;
                      const spotData = {
                        name: e.target.name.value.trim(),
                        handle: e.target.handle.value.trim(),
                        description: e.target.description.value.trim(),
                        latitude,
                        longitude,
                      };
                      if (spotData.name && spotData.handle && spotData.description) {
                        createSpot(spotData);
                        e.target.reset();
                        setDescriptionLength(0);
                      } else {
                        setToast('Please fill out all required fields');
                        setTimeout(() => setToast(null), 5000);
                      }
                    }}
                  >
                    <input
                      type="text"
                      name="name"
                      placeholder="Spot Name"
                      className="spot-input"
                      maxLength={50}
                      required
                    />
                    <input
                      type="text"
                      name="handle"
                      placeholder="Spot Handle (e.g., coolspot)"
                      className="spot-input"
                      maxLength={30}
                      pattern="[a-zA-Z0-9_]+"
                      title="Handle must contain only letters, numbers, or underscores"
                      required
                    />
                    <div className="description-wrapper">
                      <input
                        type="text"
                        name="description"
                        placeholder="Description"
                        className="spot-input"
                        maxLength={200}
                        onChange={(e) => setDescriptionLength(e.target.value.length)}
                        required
                      />
                      <span className="character-counter">{descriptionLength}/200</span>
                    </div>
                    <input
                      type="number"
                      name="latitude"
                      placeholder="Latitude"
                      className="spot-input"
                      step="any"
                      defaultValue={0}
                      required
                    />
                    <input
                      type="number"
                      name="longitude"
                      placeholder="Longitude"
                      className="spot-input"
                      step="any"
                      defaultValue={0}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setToast('Geolocation is not supported by your browser');
                          setTimeout(() => setToast(null), 5000);
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            document.querySelector('input[name="latitude"]').value = position.coords.latitude;
                            document.querySelector('input[name="longitude"]').value = position.coords.longitude;
                            setToast(`📍 Location set: ${position.coords.latitude}, ${position.coords.longitude}`);
                            setTimeout(() => setToast(null), 5000);
                          },
                          (error) => {
                           // console.error('Geolocation error:', error.message);
                            setToast('Failed to get your location');
                            setTimeout(() => setToast(null), 5000);
                          }
                        );
                      }}
                      className="update-location-button"
                    >
                      <MapPin size={16} /> Use My Location
                    </button>
                    <button type="submit" className="create-button">
                      Create Spot
                    </button>
                  </form>
                </div>
              </main>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <main className="main-content">
                <div className="section-header">
                  <h2>User Profile</h2>
                  <button onClick={() => navigate('/')} className="back-button">
                    Back to Spots
                  </button>
                </div>
                <ProfileWrapper userId={userId} token={token} fetchUsername={fetchUsername} />
              </main>
            }
          />
          <Route
            path="/profile"
            element={
              <main className="main-content">
                <div className="section-header">
                  <h2>Your Profile</h2>
                </div>
                <Profile
                  userId={userId}
                  username={username}
                  token={token}
                  statusMoods={statusMoods}
                  onUpdate={updateProfile}
                />
              </main>
            }
          />
          <Route
            path="/friends"
            element={
              <main className="main-content">
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
              </main>
            }
          />
          <Route
            path="/chats"
            element={
              <main className="main-content">
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
              </main>
            }
          />
          <Route
            path="/chat/:userId"
            element={
              <main className="main-content">
                <div className="section-header">
                  <h2>
                    Chat with {friends.find((f) => f.userId === location.pathname.split('/')[2])?.username || 'User'}
                  </h2>
                  <button onClick={() => navigate('/')} className="back-button">
                    Back to Spots
                  </button>
                </div>
                <div className="chat-container">
                  <div className="typing-indicator">
                    {dmTypingUsers[location.pathname.split('/')[2]] && (
                      <p>{dmTypingUsers[location.pathname.split('/')[2]].username} is typing...</p>
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
                          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        } else if (diffInHours < 168) {
                          return date.toLocaleDateString([], {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          });
                        }
                        return date.toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        });
                      };

                      return (
                        <div key={msg._id || idx} className={`message ${msg.senderId === userId ? 'own' : ''}`}>
                          <div className="message-bubble">
                            <span
                              className="message-user"
                              onClick={() => navigate(`/profile/${msg.senderId}`)}
                              style={{ cursor: 'pointer', color: '#d4af37', textDecoration: 'underline' }}
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
          <Route
            path="/search"
            element={
              <main className="main-content">
                <div className="section-header">
                  <h2>Search Results</h2>
                  <button onClick={() => navigate('/')} className="back-button">
                    Back to Spots
                  </button>
                </div>
                <SearchResults token={token} fetchUsername={fetchUsername} />
              </main>
            }
          />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <div className="nav-items">
          {[
            { id: 'spots', label: 'Spots', icon: MessageCircle, path: '/' },
            {
              id: 'chats',
              label: 'Chats',
              icon: MessageCircle,
              badge: unreadMessages > 0 ? unreadMessages : null,
              path: '/chats',
            },
            {
              id: 'friends',
              label: 'Friends',
              icon: Users,
              badge: friendRequests.length > 0 ? friendRequests.length : null,
              path: '/friends',
            },
            { id: 'profile', label: 'You', icon: Smile, path: '/profile' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'chats' || tab.id === 'friends') {
                  setUnreadMessages(0);
                }
                navigate(tab.path);
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

      <div className="bottom-padding" />
    </div>
  );
}

export default App;