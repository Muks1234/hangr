import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { BACKEND_URL } from './App';
import './App.css';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle form input changes
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  // Handle email-based login or sign-up
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/users/login' : '/api/users/register';
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      console.log('Email auth response:', data);
      if (data.token && data.userId && data.username) {
        onLogin({
          userId: data.userId,
          username: data.username,
          token: data.token,
        });
      } else {
        throw new Error('Invalid response: missing token, userId, or username');
      }
    } catch (err) {
      console.error('Error during email auth:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth success
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      console.log('Google login success:', credentialResponse);
      const response = await fetch(`${BACKEND_URL}/api/users/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await response.json();
      console.log('Google auth response:', data);
      if (!response.ok) {
        throw new Error(data.error || 'Google login failed');
      }
      if (data.token && data.userId && data.username) {
        onLogin({
          userId: data.userId,
          username: data.username,
          token: data.token,
        });
      } else {
        throw new Error('Invalid Google auth response: missing token, userId, or username');
      }
    } catch (err) {
      console.error('Error during Google auth:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth failure
  const handleGoogleFailure = () => {
    console.error('Google login failed');
    setError('Google login failed. Please try again.');
  };

  return (
    <div className="auth-container">
      <div className="auth-card fade-in">
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        <p>{isLogin ? 'Hangr – Chatrooms where your city hangs out.' : 'Join the Hangr vibe!'}</p>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleInputChange}
              className="auth-input"
              required
            />
          )}
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            className="auth-input"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleInputChange}
            className="auth-input"
            required
          />
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <div className="auth-toggle">
          <p>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ username: '', email: '', password: '' });
              }}
              className="toggle-button"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
        <div className="google-login">
          <p>Or sign {isLogin ? 'in' : 'up'} with Google:</p>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleFailure}
            theme="filled_blue"
            shape="pill"
            text={isLogin ? 'signin_with' : 'signup_with'}
            useOneTap
          />
        </div>
      </div>
    </div>
  );
}

export default Auth;