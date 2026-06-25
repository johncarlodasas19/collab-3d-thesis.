import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const GoogleAuthButton = () => {
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
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Google Authentication failed.');
      setLoading(false);
    }
  };

  const handleError = () => {
    setErrorMsg('Google Sign-In was unsuccessful. Try again later.');
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
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google logo" style={{width: '20px', height: '20px'}} />
        Sign in with Google
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1E1E1E',
            padding: '30px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '400px',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h2 style={{marginTop: 0, marginBottom: '20px', fontSize: '1.5rem', fontWeight: 600}}>Continue with Google</h2>
            
            {errorMsg && (
              <div style={{ backgroundColor: 'rgba(255, 50, 50, 0.1)', color: '#ff6b6b', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Select your Role:</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '5px',
                  color: 'white',
                  outline: 'none'
                }}
              >
                <option value="user" style={{color: 'black'}}>User</option>
                <option value="admin" style={{color: 'black'}}>Admin</option>
              </select>
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
                    padding: '10px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '5px',
                    color: 'white',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
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
                marginTop: '15px',
                padding: '10px',
                backgroundColor: 'transparent',
                color: '#aaa',
                border: 'none',
                cursor: 'pointer'
              }}
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
