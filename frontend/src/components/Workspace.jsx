import React, { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Box, Circle, Move, RotateCw, Scaling, ArrowLeft, Image as ImageIcon, Video, Save, Trash2, UserPlus, Users, MessageSquare, Triangle, Database, CircleDashed, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Undo, Edit2, PlaySquare } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import ThreeCanvas from './ThreeCanvas';
import InviteModal from './InviteModal';
import ReportModal from './ReportModal';
import { io } from 'socket.io-client';
import ReactPlayer from 'react-player';

export default function Workspace() {
  const { projectId } = useParams();
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [transformMode, setTransformMode] = useState('translate');
  const [socket, setSocket] = useState(null);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [saving, setSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(window.innerWidth >= 768);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [history, setHistory] = useState([]);
  const lastEmitTime = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const getYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    // Fetch project state
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    const fetchProject = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProjectName(res.data.name);
        setObjects(res.data.data?.objects || []);
        setChatMessages(res.data.data?.chatMessages || []);
      } catch (err) {
        console.error('Error fetching project', err);
        navigate('/dashboard');
      }
    };
    fetchProject();

    const newSocket = io((import.meta.env.VITE_API_URL || 'http://localhost:5000'));
    setSocket(newSocket);

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : { id: uuidv4(), username: 'Guest' };

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId: projectId, user });
    });

    newSocket.on('active-users', (users) => {
      setActiveUsers(users);
    });

    newSocket.on('user-left', (socketId) => {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    newSocket.on('cursor-move', (data) => {
      setCursors((prev) => ({
        ...prev,
        [data.socketId]: { x: data.x, y: data.y, user: data.user }
      }));
    });

    newSocket.on('object-added', (newObj) => {
      setObjects((prev) => [...prev, newObj]);
    });

    newSocket.on('object-transformed', (data) => {
      setObjects((prev) => 
        prev.map((obj) => 
          obj.id === data.id ? { ...obj, ...data } : obj
        )
      );
    });

    newSocket.on('object-deleted', (id) => {
      setObjects((prev) => prev.filter((obj) => obj.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    });

    newSocket.on('chat-message', (data) => {
      setChatMessages((prev) => [...prev, data]);
    });

    newSocket.on('typing', (user) => {
      setTypingUsers((prev) => ({ ...prev, [user.id]: user.username }));
    });

    newSocket.on('stop-typing', (data) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    });

    return () => {
      newSocket.close();
      window.removeEventListener('resize', handleResize);
    };
  }, [projectId, navigate]);

  const saveHistory = () => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(objects))].slice(-30));
    setHistoryIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setObjects(previousState);
    
    if (socket) {
      previousState.forEach(obj => {
        socket.emit('object-transformed', { roomId: projectId, transformData: obj });
      });
      const prevIds = previousState.map(o => o.id);
      objects.forEach(obj => {
        if (!prevIds.includes(obj.id)) {
          socket.emit('object-deleted', { roomId: projectId, id: obj.id });
        }
      });
    }
  };

  const handleAddObject = (type, url = null) => {
    try {
      saveHistory();
      const offsetX = (Math.random() - 0.5) * 2;
      const offsetY = (Math.random() - 0.5) * 2;
      const offsetZ = (Math.random() - 0.5) * 2;
      
      const newObj = {
        id: uuidv4(),
        type,
        url,
        position: [offsetX, offsetY, offsetZ],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: type === 'cube' ? '#4f46e5' : '#ec4899'
      };
      setObjects((prev) => [...prev, newObj]);
      setSelectedId(newObj.id);
      
      if (socket) {
        socket.emit('object-added', { roomId: projectId, object: newObj });
      }
    } catch (err) {
      showToast("Error adding shape: " + err.message, 'error');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('media', file);

    try {
      saveHistory();
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const absoluteUrl = res.data.url.startsWith('http') ? res.data.url : `${apiUrl}${res.data.url}`;
      
      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      handleAddObject(fileType, absoluteUrl);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleAddVideoClick = () => {
    setVideoUrlInput('');
    setShowVideoModal(true);
  };

  const handleVideoSubmit = (e) => {
    e.preventDefault();
    let url = videoUrlInput.trim();
    if (url) {
      // If user pasted an iframe embed code, extract the src URL
      const iframeMatch = url.match(/src=["'](.*?)["']/);
      if (iframeMatch && iframeMatch[1]) {
        url = iframeMatch[1];
      }

      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      handleAddObject('video', url);
    }
    setShowVideoModal(false);
    setVideoUrlInput('');
  };

  const handleSaveProject = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        data: { objects }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Project saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving project', err);
      showToast('Failed to save project.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameProject = async () => {
    if (!projectName.trim()) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        name: projectName.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Project renamed!', 'success');
    } catch (err) {
      console.error('Error renaming project', err);
      showToast('Failed to rename project.', 'error');
    }
  };

  const handleDeleteObject = () => {
    if (!selectedId) return;
    saveHistory();
    setObjects((prev) => prev.filter((obj) => obj.id !== selectedId));
    if (socket) {
      socket.emit('object-deleted', { roomId: projectId, id: selectedId });
    }
    setSelectedId(null);
  };

  const handleInvite = () => {
    setShowInviteModal(true);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    
    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : { username: 'Guest' };
    const myColor = activeUsers.find(u => u.socketId === socket.id)?.color || '#4f46e5';

    const msgData = {
      roomId: projectId,
      message: newMessage,
      user: { ...userObj, color: myColor }
    };

    socket.emit('chat-message', msgData);
    setNewMessage('');
    socket.emit('stop-typing', { roomId: projectId, userId: userObj.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket) return;
    
    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : { id: 'guest', username: 'Guest' };
    
    if (e.target.value === '') {
      socket.emit('stop-typing', { roomId: projectId, userId: userObj.id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }
    
    socket.emit('typing', { roomId: projectId, id: userObj.id, username: userObj.username });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { roomId: projectId, userId: userObj.id });
    }, 2000);
  };

  const handleBlur = () => {
    if (!socket) return;
    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : { id: 'guest' };
    socket.emit('stop-typing', { roomId: projectId, userId: userObj.id });
  };

  const handlePointerMove = (e) => {
    if (!socket) return;
    const now = Date.now();
    if (now - lastEmitTime.current < 50) return; // Throttle to ~20fps
    lastEmitTime.current = now;

    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : { username: 'Guest' };
    
    socket.emit('cursor-move', { roomId: projectId, x, y, user });
  };

  const handlePropertyChange = (property, value) => {
    if (!selectedId || !socket) return;
    
    setObjects(prev => prev.map(obj => {
      if (obj.id === selectedId) {
        const updatedObj = { ...obj, [property]: value };
        socket.emit('object-transformed', {
          roomId: projectId,
          transformData: { id: selectedId, [property]: value }
        });
        return updatedObj;
      }
      return obj;
    }));
  };

  const handleDimensionChange = (axisIndex, value) => {
    if (!selectedId || !socket) return;
    const numValue = parseFloat(value) || 0.1;
    
    setObjects(prev => prev.map(obj => {
      if (obj.id === selectedId) {
        const newScale = [...obj.scale];
        newScale[axisIndex] = numValue;
        const updatedObj = { ...obj, scale: newScale };
        socket.emit('object-transformed', {
          roomId: projectId,
          transformData: { id: selectedId, scale: newScale }
        });
        return updatedObj;
      }
      return obj;
    }));
  };

  const selectedObj = objects.find(o => o.id === selectedId);
  const isShapeSelected = selectedObj && selectedObj.type !== 'image' && selectedObj.type !== 'video';

  return (
    <div className="workspace-container" onPointerMove={handlePointerMove}>
      <header className="workspace-header">
        <button className="icon-btn" onClick={() => navigate(currentUser.role === 'admin' ? '/admin-dashboard' : '/dashboard')} title={currentUser.role === 'admin' ? "Back to Admin Console" : "Back to Dashboard"}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'} onMouseOut={e => { if (document.activeElement !== e.currentTarget.querySelector('input')) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)'; }} onFocus={e => e.currentTarget.style.border = '1px solid #6366f1'} onBlur={e => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)'}>
          <input 
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={handleRenameProject}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none', padding: '0', width: '250px', cursor: 'text' }}
            title="Click to rename project"
          />
          <Edit2 size={16} color="#94a3b8" style={{ marginLeft: '0.5rem', cursor: 'pointer' }} title="Rename Project" onClick={(e) => e.currentTarget.previousSibling.focus()} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex' }}>
            {activeUsers.map(u => (
              <div 
                key={u.socketId} 
                title={u.username}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: u.color || '#6366f1', color: 'white', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center',
                  marginLeft: '-8px', border: '2px solid #191b28',
                  fontSize: '0.8rem', fontWeight: 'bold'
                }}
              >
                {u.username.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <button 
            onClick={handleInvite}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500' }}
          >
            <UserPlus size={16} /> Share
          </button>
          <button 
            onClick={handleSaveProject}
            disabled={saving}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Project'}
          </button>
          <button 
            onClick={() => setShowReportModal(true)}
            title="Report Inappropriate Content"
            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <AlertCircle size={16} />
          </button>
        </div>
      </header>

      <div className="workspace-main" style={{ position: 'relative' }}>
        <aside className="workspace-toolbar" style={{ 
          width: isLeftSidebarOpen ? '85px' : '0px', 
          minWidth: isLeftSidebarOpen ? '85px' : '0px',
          padding: isLeftSidebarOpen ? '1.5rem 0' : '0', 
          opacity: isLeftSidebarOpen ? 1 : 0,
          overflowX: 'hidden',
          overflowY: isLeftSidebarOpen ? 'auto' : 'hidden',
          transition: 'all 0.3s ease',
          direction: 'rtl',
          position: isMobile ? 'fixed' : 'relative',
          left: 0,
          top: isMobile ? '60px' : 'auto',
          bottom: isMobile ? '0' : 'auto',
          zIndex: isMobile ? 40 : 10,
          backgroundColor: isMobile ? 'rgba(25, 27, 40, 0.95)' : 'rgba(25, 27, 40, 0.9)'
        }}>
          <div className="toolbar-section" style={{ direction: 'ltr' }}>
            <span className="toolbar-label">Shapes</span>
            <button className="tool-btn" onClick={() => handleAddObject('cube')} title="Add Cube">
              <Box size={24} />
            </button>
            <button className="tool-btn" onClick={() => handleAddObject('sphere')} title="Add Sphere">
              <Circle size={24} />
            </button>
            <button className="tool-btn" onClick={() => handleAddObject('cone')} title="Add Cone">
              <Triangle size={24} />
            </button>
            <button className="tool-btn" onClick={() => handleAddObject('cylinder')} title="Add Cylinder">
              <Database size={24} />
            </button>
            <button className="tool-btn" onClick={() => handleAddObject('torus')} title="Add Torus">
              <CircleDashed size={24} />
            </button>
          </div>

          <div className="toolbar-section" style={{ marginTop: '2rem', direction: 'ltr' }}>
            <span className="toolbar-label">Media</span>
            <button className="tool-btn" onClick={() => fileInputRef.current?.click()} title="Upload Image">
              <ImageIcon size={24} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            <button className="tool-btn" onClick={handleAddVideoClick} title="Add Video">
              <PlaySquare size={24} />
            </button>
          </div>

          <div className="toolbar-section" style={{ marginTop: '2rem', direction: 'ltr' }}>
            <span className="toolbar-label">Transform</span>
            <button 
              className={`tool-btn ${transformMode === 'translate' ? 'active' : ''}`}
              onClick={() => setTransformMode('translate')} title="Translate"
            >
              <Move size={24} />
            </button>
            <button 
              className={`tool-btn ${transformMode === 'rotate' ? 'active' : ''}`}
              onClick={() => setTransformMode('rotate')} title="Rotate"
            >
              <RotateCw size={24} />
            </button>
            <button 
              className={`tool-btn ${transformMode === 'scale' ? 'active' : ''}`}
              onClick={() => setTransformMode('scale')} title="Scale"
            >
              <Scaling size={24} />
            </button>
          </div>

          <div className="toolbar-section" style={{ marginTop: '2rem', direction: 'ltr' }}>
            <span className="toolbar-label">Actions</span>
            <button 
              className="tool-btn" 
              onClick={handleUndo} 
              title="Undo Last Action"
              disabled={history.length === 0}
              style={{ opacity: history.length === 0 ? 0.3 : 1, color: '#f59e0b' }}
            >
              <Undo size={24} />
            </button>
            <button 
              className="tool-btn" 
              onClick={handleDeleteObject} 
              title="Delete Selected"
              disabled={!selectedId}
              style={{ opacity: selectedId ? 1 : 0.5, color: '#ef4444' }}
            >
              <Trash2 size={24} />
            </button>
          </div>
        </aside>

        {/* Left Sidebar Toggle Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsLeftSidebarOpen(!isLeftSidebarOpen);
          }}
          title="Toggle Left Sidebar"
          style={{
            position: 'fixed',
            left: isLeftSidebarOpen ? '85px' : '0px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '32px',
            height: '70px',
            background: '#4f46e5',
            border: '1px solid rgba(255,255,255,0.2)',
            borderLeft: 'none',
            color: 'white',
            cursor: 'pointer',
            zIndex: 99999,
            borderTopRightRadius: '8px',
            borderBottomRightRadius: '8px',
            transition: 'left 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '4px 0 15px rgba(0,0,0,0.5)'
          }}
        >
          {isLeftSidebarOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
        </button>

        {/* Right Sidebar Toggle Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsRightSidebarOpen(!isRightSidebarOpen);
          }}
          title="Toggle Right Sidebar"
          style={{
            position: 'fixed',
            right: isRightSidebarOpen ? '320px' : '0px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '32px',
            height: '70px',
            background: '#4f46e5',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRight: 'none',
            color: 'white',
            cursor: 'pointer',
            zIndex: 99999,
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
            transition: 'right 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.5)'
          }}
        >
          {isRightSidebarOpen ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
        </button>

        <div className="workspace-viewport" style={{ minWidth: 0, overflow: 'hidden' }}>
          <ThreeCanvas 
            objects={objects} 
            selectedId={selectedId} 
            setSelectedId={setSelectedId}
            transformMode={transformMode}
            socket={socket}
            roomId={projectId}
          />

          {isShapeSelected && (
            <div className="properties-panel" style={{
              position: 'absolute', top: '1rem', left: '1rem',
              background: 'rgba(25, 27, 40, 0.9)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem',
              padding: '1rem', width: '220px', zIndex: 20, color: 'white',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
            }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Properties</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="color" 
                    value={selectedObj.color || '#ffffff'} 
                    onChange={(e) => handlePropertyChange('color', e.target.value)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', height: '30px', width: '30px', padding: 0 }}
                  />
                  <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{selectedObj.color}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Dimensions (Scale)</label>
                
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ width: '20px', fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>X</span>
                  <input type="number" step="0.1" value={selectedObj.scale[0]} onChange={(e) => handleDimensionChange(0, e.target.value)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem' }} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ width: '20px', fontSize: '0.75rem', color: '#22c55e', fontWeight: 'bold' }}>Y</span>
                  <input type="number" step="0.1" value={selectedObj.scale[1]} onChange={(e) => handleDimensionChange(1, e.target.value)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '20px', fontSize: '0.75rem', color: '#3b82f6', fontWeight: 'bold' }}>Z</span>
                  <input type="number" step="0.1" value={selectedObj.scale[2]} onChange={(e) => handleDimensionChange(2, e.target.value)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="workspace-media-panel" style={{
          width: isRightSidebarOpen ? (isMobile ? '100%' : '320px') : '0px',
          minWidth: isRightSidebarOpen ? (isMobile ? '100%' : '320px') : '0px',
          padding: isRightSidebarOpen ? '1.5rem' : '0',
          opacity: isRightSidebarOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          position: isMobile ? 'fixed' : 'relative',
          right: 0,
          top: isMobile ? '60px' : 'auto',
          bottom: isMobile ? '0' : 'auto',
          zIndex: isMobile ? 40 : 10,
          backgroundColor: isMobile ? 'rgba(25, 27, 40, 0.95)' : 'rgba(25, 27, 40, 0.9)'
        }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'white', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', flexShrink: 0 }}>
            Media Gallery
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {objects.filter(o => o.type === 'image' || o.type === 'video').map(obj => (
              <div key={obj.id} className="media-item">
              <button 
                className="media-item-delete"
                title="Delete Media"
                onClick={() => {
                  setObjects(prev => prev.filter(o => o.id !== obj.id));
                  if (socket) socket.emit('object-deleted', { roomId: projectId, id: obj.id });
                }}
              >
                <Trash2 size={14} />
              </button>
              {obj.type === 'image' && <img src={obj.url} alt="Uploaded" />}
              {obj.type === 'video' && (
                <div style={{ width: '100%', borderRadius: '0.5rem', overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', position: 'relative', paddingTop: '56.25%' }}>
                  <ReactPlayer 
                    url={obj.url} 
                    width="100%" 
                    height="100%" 
                    controls={true}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  />
                </div>
              )}
            </div>
          ))}

            {objects.filter(o => o.type === 'image' || o.type === 'video').length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                <ImageIcon size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>No media uploaded yet.</p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Upload images or videos from the left toolbar.</p>
              </div>
            )}
          </div>

          <div className="workspace-chat-container" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', height: '300px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem', color: 'white', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={16} /> Real-Time Chat
            </h3>
            
            <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem', paddingRight: '0.5rem' }}>
              {chatMessages.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', margin: 'auto' }}>No messages yet. Say hi!</div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: '600', color: msg.user.color, marginBottom: '0.2rem', fontSize: '0.75rem' }}>
                      {msg.user.username}
                    </div>
                    <div style={{ color: 'white', wordBreak: 'break-word' }}>
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
              {/* Auto-scroll anchor */}
              <div ref={(el) => { if (el) el.scrollIntoView({ behavior: 'smooth' }); }} />
            </div>
            
            <div style={{ minHeight: '20px', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
              {Object.keys(typingUsers).length > 0 && (
                <span>
                  💬 {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                </span>
              )}
            </div>
            
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newMessage} 
                onChange={handleTyping} 
                onBlur={handleBlur}
                placeholder="Type a message..." 
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: '0.5rem', outline: 'none', fontSize: '0.85rem' }}
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()}
                style={{ background: newMessage.trim() ? '#4f46e5' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0 0.75rem', borderRadius: '0.5rem', cursor: newMessage.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              >
                Send
              </button>
            </form>
          </div>
        </aside>

        {/* Render Remote Cursors */}
        {Object.entries(cursors).map(([socketId, cursor]) => {
          const activeUser = activeUsers.find(u => u.socketId === socketId);
          const color = activeUser?.color || '#ec4899';
          return (
            <div
              key={socketId}
              style={{
                position: 'absolute',
                left: cursor.x * window.innerWidth,
                top: cursor.y * window.innerHeight,
                pointerEvents: 'none',
                zIndex: 1000,
                transition: 'left 0.1s linear, top 0.1s linear'
              }}
            >
              <svg width="24" height="36" viewBox="0 0 24 36" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
                <path d="M5.65376 21.1597L2.39999 3.01347L20.899 15.654L13.1491 16.6341L17.5028 25.1065L14.3541 26.7208L10.0261 18.2721L5.65376 21.1597Z" fill={color}/>
              </svg>
              <div style={{
                background: color,
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                position: 'absolute',
                top: '24px',
                left: '12px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                {cursor.user.username}
              </div>
            </div>
          );
        })}
      </div>

      <InviteModal 
        isOpen={showInviteModal} 
        onClose={() => setShowInviteModal(false)} 
        projectId={projectId} 
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        projectId={projectId}
        projectName={projectName}
      />

      {/* Video URL Modal */}
      {showVideoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div style={{ background: 'linear-gradient(145deg, rgba(30, 32, 47, 0.95), rgba(20, 22, 33, 0.98))', padding: '2.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', width: '450px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative' }}>
            <h2 style={{ color: 'white', marginBottom: '1.5rem', fontSize: '1.4rem', fontWeight: '600' }}>Add Video URL</h2>
            <form onSubmit={handleVideoSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>YouTube or Direct Video Link</label>
                <input 
                  type="text" 
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem', color: 'white', fontSize: '1rem', outline: 'none' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setShowVideoModal(false)} 
                  style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '0.75rem 1.5rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  Add Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div style={{
        position: 'fixed',
        top: toast.show ? '20px' : '-100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: '2rem',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
        zIndex: 100000,
        transition: 'top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        pointerEvents: 'none',
        fontSize: '0.9rem'
      }}>
        {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />} 
        {toast.message}
      </div>
    </div>
  );
}
