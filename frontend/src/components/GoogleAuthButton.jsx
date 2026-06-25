import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const GoogleAuthButton = ({ onError }) => {
  const [showModal, setShowModal] = useState(false);
  const [role, setRole] = useState('user');
  const [adminCode, setAdminCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`, {
        token: credentialResponse.credential,
        role: role,
        adminSecretCode: adminCode
      });
      
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setShowModal(false);
      
      if (user.role === 'admin') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Google Authentication failed.';
      if (onError) {
        onError(message);
      } else {
        setErrorMsg(message);
      }
      setShowModal(false);
      setLoading(false);
    }
  };

  const handleError = () => {
    const message = 'Google Sign-In was unsuccessful. Try again later.';
    if (onError) {
      onError(message);
    } else {
      setErrorMsg(message);
    }
    setShowModal(false);
  };

  return (
    <>
      <button 
        type="button"
        onClick={() => setShowModal(true)}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '15px',
          backgroundColor: '#fff',
          color: '#333',
          border: '1px solid #ccc',
          borderRadius: '8px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          transition: 'background-color 0.2s',
          fontFamily: "'Inter', sans-serif"
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f1f1'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
      >
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI0IDkuNWMzLjU0IDAgNi43MSAxLjIyIDkuMjEgMy42bDYuODUtNi44NUMzNS45IDIuMzggMzAuNDcgMCAyNCAwIDE0LjYyIDAgNi41MSA1LjM4IDIuNTYgMTMuMjJsNy45OCA2LjE5QzEyLjQzIDEzLjcwIDE3Ljc0IDkuNSAyNCA5LjV6Ii8+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTQ2Ljk4IDI0LjU1YzAtMS41Ny0uMTUtMy4wOS0uMzgtNC41NUgyNHY5LjAyaDEyLjk0Yy0uNTggMi45Ni0yLjI2IDUuNDgtNC43OCA3LjE4bDcuNzMgNmM0LjUxLTQuMTggNy4wOS0xMC4zNiA3LjA5LTE3LjY1eiIvPjxwYXRoIGZpbGw9IiNGQkJDMDUiIGQ9Ik0xMC41MyAyOC41OWMtLjQ4LTEuNDUtLjc2LTIuOTktLjc2LTQuNTlzLjI3LTMuMTQuNzYtNC41OWwtNy45OC02LjE5Qy45MiAxNi40NiAwIDIwLjEyIDAgMjRjMCAzLjg4LjkyIDcuNTQgMi41NiAxMC43OGw3Ljk3LTYuMTl6Ii8+PHBhdGggZmlsbD0iIzM0QTg1MyIgZD0iTTI0IDQ4YzYuNDggMCAxMS45My0yLjEzIDE1Ljg5LTUuODFsLTcuNzMtNmMtMi4xNSAxLjQ1LTQuOTIgMi4zLTguMTYgMi4zLTYuMjYgMC0xMS41Ny00LjIyLTEzLjQ3LTkuOTFsLTcuOTggNi4xOUM2LjUxIDQyLjYyIDE0LjYyIDQ4IDI0IDQ4eiIvPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoNDh2NDhIMHoiLz48L3N2Zz4=" alt="Google logo" style={{width: '20px', height: '20px'}} />
        Sign in with Google
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'radial-gradient(circle at 50% 50%, rgba(66, 133, 244, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          fontFamily: "'Inter', 'Roboto', sans-serif"
        }}>
          <div style={{
            backgroundColor: 'rgba(30, 41, 59, 0.85)',
            padding: '40px',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '420px',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(66, 133, 244, 0.15)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px', justifyContent: 'center' }}>
              <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI0IDkuNWMzLjU0IDAgNi43MSAxLjIyIDkuMjEgMy42bDYuODUtNi44NUMzNS45IDIuMzggMzAuNDcgMCAyNCAwIDE0LjYyIDAgNi41MSA1LjM4IDIuNTYgMTMuMjJsNy45OCA2LjE5QzEyLjQzIDEzLjcwIDE3Ljc0IDkuNSAyNCA5LjV6Ii8+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTQ2Ljk4IDI0LjU1YzAtMS41Ny0uMTUtMy4wOS0uMzgtNC41NUgyNHY5LjAyaDEyLjk0Yy0uNTggMi45Ni0yLjI2IDUuNDgtNC43OCA3LjE4bDcuNzMgNmM0LjUxLTQuMTggNy4wOS0xMC4zNiA3LjA5LTE3LjY1eiIvPjxwYXRoIGZpbGw9IiNGQkJDMDUiIGQ9Ik0xMC41MyAyOC41OWMtLjQ4LTEuNDUtLjc2LTIuOTktLjc2LTQuNTlzLjI3LTMuMTQuNzYtNC41OWwtNy45OC02LjE5Qy45MiAxNi40NiAwIDIwLjEyIDAgMjRjMCAzLjg4LjkyIDcuNTQgMi41NiAxMC43OGw3Ljk3LTYuMTl6Ii8+PHBhdGggZmlsbD0iIzM0QTg1MyIgZD0iTTI0IDQ4YzYuNDggMCAxMS45My0yLjEzIDE1Ljg5LTUuODFsLTcuNzMtNmMtMi4xNSAxLjQ1LTQuOTIgMi4zLTguMTYgMi4zLTYuMjYgMC0xMS41Ny00LjIyLTEzLjQ3LTkuOTFsLTcuOTggNi4xOUM2LjUxIDQyLjYyIDE0LjYyIDQ4IDI0IDQ4eiIvPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoNDh2NDhIMHoiLz48L3N2Zz4=" alt="Google" style={{ width: '28px', height: '28px' }} />
              <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Sign in securely</h2>
            </div>
            
            {errorMsg && (
              <div style={{ backgroundColor: 'rgba(255, 50, 50, 0.1)', color: '#ff6b6b', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>Select your Role</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRole('user')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: role === 'user' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${role === 'user' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    color: role === 'user' ? '#60a5fa' : '#94a3b8',
                    fontWeight: role === 'user' ? '600' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: role === 'admin' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${role === 'admin' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    color: role === 'admin' ? '#60a5fa' : '#94a3b8',
                    fontWeight: role === 'admin' ? '600' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                >
                  Admin
                </button>
              </div>
            </div>

            {role === 'admin' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Admin Passcode:</label>
                <input 
                  type="password" 
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="Enter secret passcode"
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit',
                    fontSize: '1rem'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1 }}>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap
              />
            </div>

            <button 
              onClick={() => setShowModal(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                fontFamily: "'Inter', 'Roboto', sans-serif",
                fontSize: '1rem'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleAuthButton;
