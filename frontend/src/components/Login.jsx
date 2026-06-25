import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { LogIn, Box, Eye, EyeOff } from 'lucide-react';
import GoogleAuthButton from './GoogleAuthButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState('user');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotTempPass, setForgotTempPass] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`, {
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

      const redirectUrl = localStorage.getItem('redirectAfterLogin');
      
      if (redirectUrl) {
        localStorage.removeItem('redirectAfterLogin');
        navigate(redirectUrl);
      } else if (location.state?.from) {
        navigate(location.state.from);
      } else if (user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');
    setForgotTempPass('');
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/forgot-password`, { email: forgotEmail });
      setForgotMessage(res.data.message);
      if (res.data.tempPassword) {
        setForgotTempPass(res.data.tempPassword);
      }
    } catch (err) {
      setForgotMessage(err.response?.data?.message || 'Error processing request.');
    } finally {
      setForgotLoading(false);
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

        {error && (
          <div className="error-message" style={{ 
            color: error.toLowerCase().includes('banned') ? '#fca5a5' : (error.toLowerCase().includes('suspended') ? '#fde047' : '#fca5a5'),
            background: error.toLowerCase().includes('banned') ? 'rgba(239, 68, 68, 0.2)' : (error.toLowerCase().includes('suspended') ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
            border: `1px solid ${error.toLowerCase().includes('banned') ? 'rgba(239, 68, 68, 0.4)' : (error.toLowerCase().includes('suspended') ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.2)')}`
          }}>
            {error}
          </div>
        )}

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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => { setShowForgotModal(true); setForgotMessage(''); setForgotTempPass(''); setForgotEmail(email); }} 
                style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
              >
                Forgot Password?
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ background: accountType === 'admin' ? '#ef4444' : '#4f46e5' }}>
            {loading ? 'Signing in...' : <><LogIn size={18} /> Sign In as {accountType === 'admin' ? 'Admin' : 'User'}</>}
          </button>
        </form>

        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ padding: '0 10px', color: '#64748b', fontSize: '0.9rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        <GoogleAuthButton onError={setError} />

        <div className="auth-links" style={{ marginTop: '1.5rem' }}>
          Don't have an account? <Link to="/register" state={location.state}>Create one now</Link>
        </div>
      </div>

      {showForgotModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'rgba(25, 27, 40, 0.95)', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', width: '400px' }}>
            <h3 style={{ color: 'white', marginTop: 0, marginBottom: '1rem' }}>Forgot Password</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Enter your email address to receive a temporary password.</p>
            
            <form onSubmit={handleForgotPassword}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <input type="email" className="form-control" placeholder="Enter your email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
              </div>
              
              {forgotMessage && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: forgotTempPass ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${forgotTempPass ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '0.5rem', color: forgotTempPass ? '#4ade80' : '#f87171', fontSize: '0.9rem' }}>
                  {forgotMessage}
                  {forgotTempPass && (
                    <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <code style={{ fontSize: '1.1rem', fontWeight: 'bold', letterSpacing: '2px', color: 'white' }}>{forgotTempPass}</code>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setShowForgotModal(false)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Close</button>
                <button type="submit" disabled={forgotLoading} style={{ flex: 1, background: '#4f46e5', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {forgotLoading ? 'Processing...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
