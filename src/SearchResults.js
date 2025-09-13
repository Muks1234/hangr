import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BACKEND_URL } from './App';
import './App.css';

const SearchResults = ({ token, fetchUsername }) => {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const query = new URLSearchParams(location.search).get('query')?.toLowerCase() || '';
    if (!query || !token) {
      setResults([]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${BACKEND_URL}/api/users/search?query=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status}`);
        }
        const data = await response.json();
        const usersWithUsernames = await Promise.all(
          data.map(async (user) => ({
            userId: user._id,
            username: await fetchUsername(user._id),
            avatar: user.avatar || 'https://via.placeholder.com/40', // Fallback avatar
          }))
        );
        setResults(usersWithUsernames);
      } catch (err) {
        console.error('Error fetching search results:', err.message);
        setError('Failed to load search results');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [location.search, token, fetchUsername]);

  const handleResultClick = (userId) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="search-results-container fade-in">
      {isLoading ? (
        <div className="loading">Loading users...</div>
      ) : error ? (
        <div className="no-results-message">{error}</div>
      ) : results.length > 0 ? (
        results.map((user) => (
          <div
            key={user.userId}
            className="search-result-item"
            onClick={() => handleResultClick(user.userId)}
          >
            <img src={user.avatar} alt={user.username} />
            <span>{user.username}</span>
          </div>
        ))
      ) : (
        <div className="no-results-message">No users found</div>
      )}
    </div>
  );
};

export default SearchResults;