import React, { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Box, Circle, Move, RotateCw, Scaling, ArrowLeft, Image as ImageIcon, Video, Save, Trash2, UserPlus, Users, MessageSquare, Triangle, Database, CircleDashed, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Undo, Edit2, PlaySquare, Settings, MousePointer2, Hand, Type, Square, Cone, BoxSelect, Plus, FileUp, Flag, CheckCircle, Smile, Paperclip, X, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import ThreeCanvas from './ThreeCanvas';
import InviteModal from './InviteModal';
import ReportModal from './ReportModal';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';

let globalAudioCtx = null;
const playTone = (type) => {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }
    const osc = globalAudioCtx.createOscillator();
    const gain = globalAudioCtx.createGain();
    osc.type = 'sine';
    if (type === 'join') {
      osc.frequency.setValueAtTime(440, globalAudioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, globalAudioCtx.currentTime + 0.1);
    } else {
      osc.frequency.setValueAtTime(660, globalAudioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, globalAudioCtx.currentTime + 0.1);
    }
    gain.gain.setValueAtTime(0, globalAudioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(1.0, globalAudioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, globalAudioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(globalAudioCtx.destination);
    osc.start();
    osc.stop(globalAudioCtx.currentTime + 0.5);
  } catch (e) {
    console.error('Audio failed', e);
  }
};

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
  const [statusKick, setStatusKick] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [deletedProjectModal, setDeletedProjectModal] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(window.innerWidth >= 768);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState([]);
  const lastEmitTime = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const chatAttachmentRef = useRef(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const fromReports = new URLSearchParams(location.search).get('from') === 'reports';

  const handleGoBack = () => {
    if (currentUser.role === 'admin') {
      const returnTab = localStorage.getItem('adminReturnTab');
      if (returnTab || fromReports) {
        localStorage.removeItem('adminReturnTab');
        navigate('/admin-dashboard?tab=reports');
      } else {
        navigate('/admin-dashboard');
      }
    } else {
      navigate('/dashboard');
    }
  };

  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('/uploads/')) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${url}`;
    }
    return url;
  };

  const hasValidAvatar = (url) => typeof url === 'string' && url !== 'null' && url !== 'undefined' && url.trim() !== '' && url !== 'admin-shield';

  const showToast = (message, type = 'success', user = null) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, user }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, (type === 'join' || type === 'leave' || type === 'upload' || type === 'delete') ? 4000 : 3000);
  };

  useEffect(() => {
    const unlockAudio = () => {
      if (!globalAudioCtx) {
        try { globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
      }
      if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
      document.body.removeEventListener('click', unlockAudio);
      document.body.removeEventListener('touchstart', unlockAudio);
      document.body.removeEventListener('keydown', unlockAudio);
    };
    document.body.addEventListener('click', unlockAudio);
    document.body.addEventListener('touchstart', unlockAudio);
    document.body.addEventListener('keydown', unlockAudio);

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
        if (err.response && err.response.status === 404) {
          setDeletedProjectModal(true);
        } else {
          navigate('/dashboard', { state: { projectError: 'This project is no longer accessible.' } });
        }
      }
    };
    fetchProject();

    const newSocket = io((import.meta.env.VITE_API_URL || 'http://localhost:5000'));
    setSocket(newSocket);

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : { id: uuidv4(), username: 'Guest' };
    if (user.role === 'admin') { user.username = 'ADMIN'; user.avatarUrl = 'admin-shield'; user.color = '#ef4444'; }

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId: projectId, user });
    });

    newSocket.on('active-users', (users) => {
      setActiveUsers(users);
    });

    newSocket.on('user-joined', (userData) => {
      playTone('join');
      showToast(`${userData.username} joined the workspace`, 'join', userData);
    });

    newSocket.on('user-left', (payload) => {
      const socketId = typeof payload === 'string' ? payload : payload.socketId;
      const leftUser = typeof payload === 'object' ? payload.user : null;
      
      if (leftUser) {
        playTone('leave');
        showToast(`${leftUser.username} left the workspace`, 'leave', leftUser);
      }
      
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
      if (newObj.uploadedBy) {
        const isMedia = newObj.type === 'image' || newObj.type === 'video';
        const typeName = newObj.type === 'image' ? 'photo' : newObj.type === 'video' ? 'video' : newObj.type;
        const message = isMedia 
          ? `${newObj.uploadedBy} uploaded a new ${typeName}! Check the Media Gallery.`
          : `${newObj.uploadedBy} added a new ${typeName} shape.`;
        showToast(message, 'upload', { username: newObj.uploadedBy, color: '#10b981' });
      }
    });

    newSocket.on('object-transformed', (data) => {
      setObjects((prev) => 
        prev.map((obj) => 
          obj.id === data.id ? { ...obj, ...data } : obj
        )
      );
    });

    newSocket.on('object-deleted', (data) => {
      if (typeof data === 'string') {
        setObjects((prev) => prev.filter((obj) => obj.id !== data));
      } else {
        setObjects((prev) => prev.filter((obj) => obj.id !== data.id));
        if (data.deletedBy) {
          const typeName = data.deletedObjType === 'image' ? 'photo' : data.deletedObjType === 'video' ? 'video' : data.deletedObjType || 'object';
          const isMedia = typeName === 'photo' || typeName === 'video';
          const message = isMedia 
            ? `${data.deletedBy} deleted a ${typeName} from the media gallery.`
            : `${data.deletedBy} deleted a ${typeName} shape.`;
          showToast(message, 'delete', { username: data.deletedBy, color: '#ef4444' });
        }
      }
    });

    newSocket.on('chat-message', (data) => {
      setChatMessages((prev) => [...prev, data]);
    });

    newSocket.on('message-edited', ({ messageId, newText }) => {
      setChatMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, message: newText } : msg));
    });

    newSocket.on('message-unsent', ({ messageId, message }) => {
      setChatMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isUnsent: true, message, fileUrl: null, type: 'text' } : msg));
    });

    newSocket.on('typing', (data) => {
      setTypingUsers((prev) => ({ ...prev, [data.id]: data.username }));
    });

    newSocket.on('stop-typing', (data) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    });

    newSocket.on('user-status-changed', (data) => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const currentUser = JSON.parse(userStr);
        if (currentUser.id === data.userId || currentUser._id === data.userId) {
          setStatusKick(data.status);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    });

    newSocket.on('project-deleted-by-admin', (data) => {
      if (data.projectId === projectId) {
        navigate('/dashboard', { state: { projectDeletedByAdmin: true } });
      }
    });

    return () => {
      newSocket.close();
      window.removeEventListener('resize', handleResize);
    };
  }, [projectId, navigate]);

  const saveHistory = () => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(objects))].slice(-30));
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
            const userStr = localStorage.getItem('user');
            const userObj = userStr ? JSON.parse(userStr) : { username: 'Someone' };
            socket.emit('object-deleted', { roomId: projectId, id: obj.id, deletedBy: userObj.username });
        }
      });
    }
  };

  const handleAddObject = (type, url = null, uploadedBy = null) => {
    try {
      saveHistory();
      const userStr = localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : { username: 'Someone' };
      const actualUser = uploadedBy || userObj.username;
      
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
        color: type === 'cube' ? '#4f46e5' : '#ec4899',
        uploadedBy: actualUser
      };
      setObjects((prev) => [...prev, newObj]);
      setSelectedId(newObj.id);
      
      if (socket) {
        socket.emit('object-added', { roomId: projectId, object: newObj });
      }

      if (actualUser) {
        const isMedia = newObj.type === 'image' || newObj.type === 'video';
        const typeName = newObj.type === 'image' ? 'photo' : newObj.type === 'video' ? 'video' : newObj.type;
        const message = isMedia 
          ? `You uploaded a new ${typeName}! Check the Media Gallery.`
          : `You added a new ${typeName} shape.`;
        showToast(message, 'upload', { username: 'You', color: '#10b981' });
      }
    } catch (err) {
      showToast("Error adding shape: " + err.message, 'error');
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('File is too large (max 10MB)', 'error');
      return;
    }

    try {
      saveHistory();
      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      const userStr = localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : { username: 'Someone' };
      
      let finalUrl;
      if (fileType === 'image') {
        finalUrl = await compressImage(file);
      } else {
        if (file.size > 3 * 1024 * 1024) {
          showToast('Video must be under 3MB to save permanently.', 'error');
          return;
        }
        finalUrl = await new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.readAsDataURL(file);
        });
      }
      
      handleAddObject(fileType, finalUrl, userObj.username);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleChatAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('File is too large (max 10MB)', 'error');
      return;
    }

    try {
      let fileType = 'file';
      if (file.type.startsWith('image/')) fileType = 'image';
      if (file.type.startsWith('video/')) fileType = 'video';
      
      const userStr = localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : { username: 'Someone' };

      let finalUrl;
      if (fileType === 'image') {
        finalUrl = await compressImage(file);
      } else if (fileType === 'video') {
        if (file.size > 3 * 1024 * 1024) {
          showToast('Video must be under 3MB to save permanently.', 'error');
          return;
        }
        finalUrl = await new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.readAsDataURL(file);
        });
      } else {
        finalUrl = await new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.readAsDataURL(file);
        });
      }

      if (userObj.role === 'admin') { userObj.username = 'ADMIN'; userObj.avatarUrl = 'admin-shield'; userObj.color = '#ef4444'; }
      const myColor = activeUsers.find(u => u.socketId === socket?.id)?.color || '#4f46e5';

      const msgData = {
        id: uuidv4(),
        roomId: projectId,
        message: fileType === 'file' ? `📎 Uploaded file: ${file.name}` : '',
        fileUrl: finalUrl,
        type: fileType,
        user: { ...userObj, color: myColor },
        timestamp: new Date().toISOString()
      };

      socket.emit('chat-message', msgData);
    } catch (err) {
      console.error('Chat attachment upload failed', err);
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
      const userStr = localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : { username: 'Someone' };
      handleAddObject('video', url, userObj.username);
    }
    setShowVideoModal(false);
    setVideoUrlInput('');
  };

  const handleSaveProject = () => {
    showToast('Project saved successfully!', 'success');
    
    // Yield to the main thread so the UI updates instantly
    setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
          data: { objects }
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Error saving project', err);
        showToast('Failed to save project.', 'error');
      }
    }, 100);
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
      showToast('Failed to rename project.', 'error', { position: 'top-right' });
    }
  };

  const handleDeleteObject = () => {
    if (!selectedId || !socket) return;
    saveHistory();
    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : { username: 'Someone' };
    
    const objToDelete = objects.find((o) => o.id === selectedId);
    const objType = objToDelete ? objToDelete.type : 'object';

    setObjects((prev) => prev.filter((obj) => obj.id !== selectedId));
    socket.emit('object-deleted', { roomId: projectId, id: selectedId, deletedBy: userObj.username, deletedObjType: objType });
    setSelectedId(null);

    const typeName = objType === 'image' ? 'photo' : objType === 'video' ? 'video' : objType || 'object';
    const isMedia = typeName === 'photo' || typeName === 'video';
    const message = isMedia 
      ? `You deleted a ${typeName} from the media gallery.`
      : `You deleted a ${typeName} shape.`;
    showToast(message, 'delete', { username: 'You', color: '#ef4444' });
  };

  const handleInvite = () => {
    setShowInviteModal(true);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    
    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : { username: 'Guest' };
    if (userObj.role === 'admin') { userObj.username = 'ADMIN'; userObj.avatarUrl = 'admin-shield'; userObj.color = '#ef4444'; }
    const myColor = activeUsers.find(u => u.socketId === socket.id)?.color || '#4f46e5';

    if (editingMessageId) {
      socket.emit('edit-message', { roomId: projectId, messageId: editingMessageId, newText: newMessage });
      setEditingMessageId(null);
      setNewMessage('');
      return;
    }

    const msgData = {
      id: uuidv4(),
      roomId: projectId,
      message: newMessage,
      type: 'text',
      user: { ...userObj, color: myColor },
      timestamp: new Date().toISOString()
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
    if (userObj.role === 'admin') { userObj.username = 'ADMIN'; userObj.avatarUrl = 'admin-shield'; userObj.color = '#ef4444'; }
    
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
    if (now - lastEmitTime.current < 5) return; // Throttle to 200fps for absolute ZERO delay
    lastEmitTime.current = now;

    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : { username: 'Guest' };
    if (user.role === 'admin') { user.username = 'ADMIN'; user.avatarUrl = 'admin-shield'; user.color = '#ef4444'; }
    
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
    <>
      {deletedProjectModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'rgba(30, 32, 47, 0.95)', border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '1.5rem', padding: '2.5rem', maxWidth: '450px', width: '90%',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'modalSlideUp 0.3s ease-out'
          }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle size={40} color="#ef4444" />
            </div>
            <h3 style={{ color: 'white', fontSize: '1.4rem', marginBottom: '1rem', fontWeight: 'bold' }}>Access Denied</h3>
            <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '2rem', lineHeight: '1.6' }}>
              This project is deleted and you can no longer join the collab workspace due to violated term by the administrator.
            </p>
            <button 
              onClick={() => {
                setDeletedProjectModal(false);
                navigate('/login');
              }}
              style={{
                background: '#ef4444', color: 'white', border: 'none', padding: '0.85rem 2rem',
                borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer',
                transition: 'background 0.2s', width: '100%', fontSize: '1rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
            >
              Okay
            </button>
          </div>
        </div>
      )}
    <div className="workspace-container" onPointerMove={handlePointerMove}>
      <header className="workspace-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={handleGoBack} title={currentUser.role === 'admin' ? "Back to Admin Console" : "Back to Dashboard"}>
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex' }}>
            {activeUsers.map(u => (
              <div 
                key={u.socketId} 
                title={u.username}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: u.avatarUrl === 'admin-shield' ? '#ef4444' : (u.color || '#6366f1'), color: 'white', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center',
                  marginLeft: '-8px', border: '2px solid #191b28',
                  fontSize: '0.8rem', fontWeight: 'bold',
                  position: 'relative', overflow: 'hidden'
                }}
              >
                {u.avatarUrl === 'admin-shield' ? (
                  <ShieldAlert size={18} color="white" />
                ) : (
                  <>
                    <span>{u.username?.charAt(0).toUpperCase()}</span>
                    {hasValidAvatar(u.avatarUrl) && (
                      <img 
                        src={getMediaUrl(u.avatarUrl)} 
                        alt={u.username}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </>
                )}
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
                  const userStr = localStorage.getItem('user');
                  const userObj = userStr ? JSON.parse(userStr) : { username: 'Someone' };
                  setObjects(prev => prev.filter(o => o.id !== obj.id));
                  if (socket) socket.emit('object-deleted', { roomId: projectId, id: obj.id, deletedBy: userObj.username, deletedObjType: obj.type });
                  
                  const typeName = obj.type === 'image' ? 'photo' : obj.type === 'video' ? 'video' : obj.type || 'object';
                  const isMedia = typeName === 'photo' || typeName === 'video';
                  const message = isMedia 
                    ? `You deleted a ${typeName} from the media gallery.`
                    : `You deleted a ${typeName} shape.`;
                  showToast(message, 'delete', { username: 'You', color: '#ef4444' });
                }}
              >
                <Trash2 size={14} />
              </button>
              {obj.type === 'image' && <img src={getMediaUrl(obj.url)} alt="Uploaded" />}
              {obj.type === 'video' && (
                <div style={{ width: '100%', borderRadius: '0.5rem', overflow: 'hidden', background: '#000', aspectRatio: '16/9', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                  {getYoutubeId(obj.url) ? (
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src={`https://www.youtube.com/embed/${getYoutubeId(obj.url)}`} 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                      style={{ display: 'block' }}
                    ></iframe>
                  ) : (
                    <video src={getMediaUrl(obj.url)} controls width="100%" height="100%" style={{ display: 'block', objectFit: 'contain' }} />
                  )}
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

          <div className="workspace-chat-container" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: '250px', maxHeight: '50vh', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', position: 'relative' }}>
            <h3 style={{ marginBottom: '0.5rem', color: 'white', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <MessageSquare size={16} /> Real-Time Chat
            </h3>
            
            <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem', paddingRight: '0.5rem', minHeight: 0 }}>
              {chatMessages.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', margin: 'auto' }}>No messages yet. Say hi!</div>
              ) : (
                chatMessages.map((msg, i) => {
                  const currentMsgId = msg.id || msg.timestamp;
                  return (
                  <div 
                    key={currentMsgId || i} 
                    onMouseEnter={() => setHoveredMessageId(currentMsgId)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                          background: msg.user.avatarUrl === 'admin-shield' ? '#ef4444' : (msg.user.color || '#6366f1'),
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', fontWeight: 'bold',
                          position: 'relative', overflow: 'hidden'
                        }}>
                          {msg.user.avatarUrl === 'admin-shield' ? (
                            <ShieldAlert size={12} color="white" />
                          ) : (
                            <>
                              <span>{msg.user.username?.charAt(0).toUpperCase()}</span>
                              {hasValidAvatar(msg.user.avatarUrl) && (
                                <img 
                                  src={getMediaUrl(msg.user.avatarUrl)} 
                                  alt={msg.user.username}
                                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              )}
                            </>
                          )}
                        </div>
                        <div style={{ fontWeight: '600', color: msg.user.avatarUrl === 'admin-shield' ? '#ef4444' : msg.user.color, fontSize: '0.75rem' }}>
                          {msg.user.username}
                        </div>
                      </div>
                      {msg.timestamp && (
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {(hoveredMessageId === currentMsgId && !msg.isUnsent && 
                            currentUser && msg.user && 
                            ((currentUser.id && (currentUser.id === msg.user.id || currentUser.id === msg.user._id)) || 
                             (currentUser._id && (currentUser._id === msg.user.id || currentUser._id === msg.user._id)))
                          ) && (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              {(new Date() - new Date(msg.timestamp)) <= 120000 && (
                                <>
                                  <button onClick={() => { setEditingMessageId(currentMsgId); setNewMessage(msg.message); }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}><Edit2 size={12} /></button>
                                  <button onClick={() => socket.emit('delete-message', { roomId: projectId, messageId: currentMsgId })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Unsend Message"><Trash2 size={12} /></button>
                                </>
                              )}
                            </div>
                          )}
                          {new Date(msg.timestamp).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div style={{ color: msg.isUnsent ? '#94a3b8' : 'white', fontStyle: msg.isUnsent ? 'italic' : 'normal', wordBreak: 'break-word' }}>
                      {msg.type === 'image' && !msg.isUnsent && <img src={getMediaUrl(msg.fileUrl)} alt="attachment" style={{ maxWidth: '100%', borderRadius: '0.25rem', marginTop: '0.25rem' }} />}
                      {msg.type === 'video' && !msg.isUnsent && <video src={getMediaUrl(msg.fileUrl)} controls style={{ maxWidth: '100%', borderRadius: '0.25rem', marginTop: '0.25rem' }} />}
                      {msg.type === 'file' && !msg.isUnsent && <a href={getMediaUrl(msg.fileUrl)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '0.25rem', color: '#60a5fa', textDecoration: 'underline' }}>Download Attachment</a>}
                      {msg.message}
                    </div>
                  </div>
                )})
              )}
              {/* Auto-scroll anchor */}
              <div ref={chatEndRef} />
            </div>
            
            <div style={{ minHeight: '20px', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
              {Object.keys(typingUsers).length > 0 && (
                <span>
                  💬 {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                </span>
              )}
            </div>
            
            <form onSubmit={handleSendMessage} style={{ position: 'relative', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {showEmojiPicker && (
                <>
                  <div 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                    onClick={() => setShowEmojiPicker(false)} 
                  />
                  <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '0.5rem', zIndex: 1000, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', width: '100%', maxWidth: '320px' }}>
                    <EmojiPicker 
                      onEmojiClick={(emoji) => { setNewMessage(prev => prev + emoji.emoji); setShowEmojiPicker(false); }} 
                      theme="dark" 
                      width="100%"
                    />
                  </div>
                </>
              )}
              <input type="file" ref={chatAttachmentRef} style={{ display: 'none' }} onChange={handleChatAttachmentUpload} />
              
              <button type="button" onClick={() => chatAttachmentRef.current?.click()} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }} title="Attach File">
                <Paperclip size={18} />
              </button>
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }} title="Emoji">
                <Smile size={18} />
              </button>

              <input 
                type="text" 
                value={newMessage} 
                onChange={handleTyping} 
                onBlur={handleBlur}
                placeholder={editingMessageId ? "Edit your message..." : "Type a message..."} 
                style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: '0.5rem', outline: 'none', fontSize: '0.85rem' }}
              />
              {editingMessageId && (
                <button type="button" onClick={() => { setEditingMessageId(null); setNewMessage(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={16} />
                </button>
              )}
              <button 
                type="submit" 
                disabled={!newMessage.trim()}
                style={{ background: newMessage.trim() ? '#4f46e5' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0 0.75rem', borderRadius: '0.5rem', cursor: newMessage.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, height: '34px' }}
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
                left: 0,
                top: 0,
                transform: `translate(${cursor.x * window.innerWidth}px, ${cursor.y * window.innerHeight}px)`,
                pointerEvents: 'none',
                zIndex: 1000,
                transition: 'transform 0.01s linear',
                willChange: 'transform'
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

      {statusKick && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999999 }}>
          <div style={{ background: statusKick === 'self-deleted' ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : (statusKick === 'banned' || statusKick === 'deleted') ? 'linear-gradient(145deg, rgba(127, 29, 29, 0.9), rgba(69, 10, 10, 0.95))' : 'linear-gradient(145deg, rgba(113, 63, 18, 0.9), rgba(66, 32, 6, 0.95))', padding: '3rem', borderRadius: '1.5rem', border: `1px solid ${statusKick === 'self-deleted' ? 'rgba(255, 255, 255, 0.1)' : (statusKick === 'banned' || statusKick === 'deleted') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`, width: '400px', maxWidth: '90%', textAlign: 'center', boxShadow: `0 25px 50px -12px ${statusKick === 'self-deleted' ? 'rgba(0, 0, 0, 0.5)' : (statusKick === 'banned' || statusKick === 'deleted') ? 'rgba(239, 68, 68, 0.25)' : 'rgba(234, 179, 8, 0.25)'}`, animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: statusKick === 'self-deleted' ? 'rgba(34, 197, 94, 0.1)' : (statusKick === 'banned' || statusKick === 'deleted') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)', color: statusKick === 'self-deleted' ? '#22c55e' : (statusKick === 'banned' || statusKick === 'deleted') ? '#ef4444' : '#fde047', marginBottom: '1.5rem', border: `1px solid ${statusKick === 'self-deleted' ? 'rgba(34, 197, 94, 0.2)' : 'transparent'}` }}>
              {statusKick === 'self-deleted' ? <CheckCircle size={40} /> : (statusKick === 'banned' || statusKick === 'deleted') ? <AlertTriangle size={40} /> : <AlertTriangle size={40} />}
            </div>
            <h2 style={{ color: 'white', fontSize: '1.4rem', marginBottom: '1rem', fontWeight: 'bold' }}>
              {statusKick === 'self-deleted' ? 'Account Deleted' : `Account ${(statusKick === 'banned' || statusKick === 'deleted') ? (statusKick.charAt(0).toUpperCase() + statusKick.slice(1)) : 'Suspended'}`}
            </h2>
            <p style={{ color: statusKick === 'self-deleted' ? '#94a3b8' : (statusKick === 'banned' || statusKick === 'deleted') ? '#fca5a5' : '#fef08a', fontSize: '1rem', marginBottom: '2rem', lineHeight: '1.6' }}>
              {statusKick === 'self-deleted' 
                ? 'You have successfully deleted your account.'
                : (statusKick === 'banned' || statusKick === 'deleted')
                  ? `Your account has been ${statusKick} by an administrator.`
                  : 'Your access to this workspace has been temporarily suspended. Please contact the administrator.'}
            </p>
            <button 
              onClick={() => navigate(statusKick === 'deleted' || statusKick === 'self-deleted' ? '/register' : '/login')}
              style={{ width: '100%', padding: '0.85rem 2rem', background: statusKick === 'self-deleted' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : (statusKick === 'banned' || statusKick === 'deleted') ? '#ef4444' : '#eab308', color: 'white', border: 'none', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: `0 4px 15px ${statusKick === 'self-deleted' ? 'rgba(59, 130, 246, 0.4)' : (statusKick === 'banned' || statusKick === 'deleted') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(234, 179, 8, 0.4)'}` }}
            >
              {statusKick === 'self-deleted' ? 'Continue' : 'Okay'}
            </button>
          </div>
        </div>
      )}

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
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>YouTube Video Link</label>
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

      {/* Toast Notification Stack */}
      <div style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 100000,
        pointerEvents: 'none',
        alignItems: 'center'
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${t.type === 'join' || t.type === 'upload' ? 'rgba(16, 185, 129, 0.6)' : t.type === 'leave' || t.type === 'delete' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(255,255,255,0.1)'}`,
            color: 'white',
            padding: (t.type === 'join' || t.type === 'leave' || t.type === 'upload' || t.type === 'delete') ? '0.75rem 1.5rem 0.75rem 0.75rem' : '1rem 1.5rem',
            borderRadius: '1rem',
            boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 30px ${t.type === 'join' || t.type === 'upload' ? 'rgba(16, 185, 129, 0.2)' : t.type === 'leave' || t.type === 'delete' ? 'rgba(239, 68, 68, 0.2)' : 'transparent'}`,
            transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            animation: 'toastSlideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '1.2rem',
            minWidth: '320px',
            maxWidth: '90vw',
            justifyContent: 'center'
          }}>
            {(t.type === 'join' || t.type === 'leave' || t.type === 'upload' || t.type === 'delete') && t.user ? (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${t.type === 'join' || t.type === 'upload' ? '#10b981' : '#ef4444'}` }}>
                  {t.user.avatarUrl ? (
                    <img src={getMediaUrl(t.user.avatarUrl)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${encodeURIComponent(t.user.color || '#6366f1')}"/><text x="50%" y="50%" font-family="Arial" font-size="18" fill="white" font-weight="bold" text-anchor="middle" dy=".3em">${(t.user.username || 'U')[0].toUpperCase()}</text></svg>`; }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: t.user.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                      {(t.user.username || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ position: 'absolute', bottom: '0', right: '0', width: '12px', height: '12px', borderRadius: '50%', background: t.type === 'join' || t.type === 'upload' ? '#10b981' : '#ef4444', border: '2px solid #0f172a' }}></div>
              </div>
            ) : (
              t.type === 'success' ? <CheckCircle2 size={24} color="#10b981" /> : <AlertCircle size={24} color="#ef4444" />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', flex: 1 }}>
              {(t.type === 'join' || t.type === 'leave' || t.type === 'upload' || t.type === 'delete') && (
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: t.type === 'join' || t.type === 'upload' ? '#10b981' : '#ef4444', fontWeight: '800' }}>
                  {t.type === 'join' ? '● Connected' : t.type === 'leave' ? '○ Disconnected' : t.type === 'upload' ? (t.message.includes('shape') ? '● Object Added' : '● Media Uploaded') : '○ Object Deleted'}
                </span>
              )}
              <span style={{ fontSize: '1rem', color: '#f8fafc', wordBreak: 'break-word' }}>{t.message}</span>
            </div>
          </div>
        ))}
        <style>{`
          @keyframes toastSlideDown {
            from { opacity: 0; transform: translateY(-30px) scale(0.9); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
    </>
  );
}
