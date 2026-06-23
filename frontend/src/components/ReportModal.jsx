import React, { useState, useRef } from 'react';
import axios from 'axios';
import { AlertTriangle, X, Upload, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

export default function ReportModal({ isOpen, onClose, projectId, projectName }) {
  const [reason, setReason] = useState('');
  const [proofUrl, setProofUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for your report.');
      return;
    }
    
    if (!proofUrl) {
      setError('Please attach proof/evidence before submitting.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reports`, {
        reportedProjectId: projectId,
        reason: reason.trim(),
        proofUrl: proofUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setReason('');
        setProofUrl(null);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('media', file);
      
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setProofUrl(res.data.url);
    } catch (err) {
      console.error('Upload failed', err);
      setError('Failed to upload proof image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
      <div style={{ background: 'linear-gradient(145deg, rgba(30, 32, 47, 0.95), rgba(20, 22, 33, 0.98))', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)', width: '400px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.15)', position: 'relative' }}>
        
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <h3 style={{ marginBottom: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
          <AlertTriangle color="#ef4444" size={24} /> 
          Report Content
        </h3>
        
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          You are reporting the project <strong>{projectName}</strong>. Please describe why this content is inappropriate or violates community guidelines.
        </p>

        {success ? (
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            Report submitted successfully. Thank you for keeping the community safe.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
            
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide specific details about the violation..."
              rows={4}
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', resize: 'none', fontFamily: 'inherit', fontSize: '0.9rem' }}
              onFocus={(e) => e.target.style.borderColor = '#ef4444'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Attach Proof/Evidence <span style={{ color: '#ef4444' }}>*</span></span>
                {proofUrl && <span style={{ color: '#22c55e', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={12}/> Attached</span>}
              </div>
              
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />
              
              {!proofUrl ? (
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', color: '#cbd5e1', padding: '1rem', borderRadius: '0.5rem', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {uploading ? 'Uploading...' : <><Upload size={16} /> Select Image Proof</>}
                </button>
              ) : (
                <div style={{ position: 'relative', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: '120px' }}>
                  <img src={proofUrl} alt="Attached Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    type="button" 
                    onClick={() => setProofUrl(null)}
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', padding: '0.25rem', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                type="button" 
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading || uploading}
                style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '0.5rem', cursor: (loading || uploading) ? 'not-allowed' : 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
