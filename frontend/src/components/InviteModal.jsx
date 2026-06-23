import React, { useState } from 'react';
import { Link, X, Copy, CheckCircle2 } from 'lucide-react';

export default function InviteModal({ isOpen, onClose, projectId }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const projectUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(projectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: 'rgba(25, 27, 40, 0.95)', border: '1px solid rgba(255,255,255,0.1)',
        padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '450px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontSize: '1.25rem' }}>
            <Link size={20} color="#6366f1" /> Share via Link
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          Anyone with this link can instantly join this 3D workspace and collaborate with you in real-time. Just copy and send it to them!
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="text" 
            value={projectUrl}
            readOnly
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '0.5rem',
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', outline: 'none', fontSize: '0.85rem'
            }}
          />
          <button 
            onClick={handleCopyLink}
            style={{
              padding: '0 1.25rem', borderRadius: '0.5rem',
              background: copied ? '#10b981' : '#4f46e5', color: 'white', border: 'none',
              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'background 0.2s'
            }}
          >
            {copied ? <><CheckCircle2 size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
          </button>
        </div>
      </div>
    </div>
  );
}
