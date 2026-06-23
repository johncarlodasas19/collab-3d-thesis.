import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { LogIn, Box, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState('user');
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5000')}/api/auth/login', {
        email,
        password
      });
      
      const { user, token } = response.data;
      
      if (accountType === 'admin' && user.role !== 'admin') {
        setError('This account does not have admin privileges.');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      if (location.state?.from) {
        navigate(location.state.from);
      } else if (user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '1rem', marginBottom: '1rem' }}>
            <Box size={48} color="#6366f1" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'white', margin: 0, letterSpacing: '1px' }}>Collab 3D</h1>
        </div>
        <h2>Welcome Back</h2>
        <p className="subtitle">Sign in to your {accountType === 'admin' ? 'Admin Panel' : '3D workspace'}</p>

        {error && <div className="error-message">{error}</div>}

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            type="button" 
            onClick={() => setAccountType('user')}
            style={{ flex: 1, padding: '0.5rem', border: 'none', background: accountType === 'user' ? '#6366f1' : 'transparent', color: 'white', borderRadius: '0.25rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500' }}
          >
            User
          </button>
          <button 
            type="button" 
            onClick={() => setAccountType('admin')}
            style={{ flex: 1, padding: '0.5rem', border: 'none', background: accountType === 'admin' ? '#ef4444' : 'transparent', color: 'white', borderRadius: '0.25rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500' }}
          >
            Admin
          </button>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex'
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ background: accountType === 'admin' ? '#ef4444' : '#4f46e5' }}>
            {loading ? 'Signing in...' : <><LogIn size={18} /> Sign In as {accountType === 'admin' ? 'Admin' : 'User'}</>}
          </button>
        </form>

        <div className="auth-links">
          Don't have an account? <Link to="/register" state={location.state}>Create one now</Link>
        </div>
      </div>
    </div>
  );
}
