import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, LogOut, Settings, Layout, Plus, Folder, FolderOpen, Bell, Trash2, Menu, Upload, User as UserIcon, Mail, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Search, Copy, Edit2, Check, X } from 'lucide-react';
import axios from 'axios';
import AvatarEditor from 'react-avatar-editor';
import { io } from 'socket.io-client';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [trashProjects, setTrashProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('projects');
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [adminActionModal, setAdminActionModal] = useState({ show: false, status: '' });
  const [adminProjectDeletedModal, setAdminProjectDeletedModal] = useState(false);
  const [projectErrorModal, setProjectErrorModal] = useState({ show: false, message: '' });
  const location = useLocation();

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('/uploads/')) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${url}`;
    }
    return url;
  };

  const getFallbackAvatar = (username) => {
    if (!username) return '';
    const hash = Array.from(username).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = (hash * 137) % 360;
    const initial = username[0].toUpperCase();
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${hue}, 70%, 40%)"/><text x="50" y="50" dominant-baseline="central" text-anchor="middle" font-size="45" font-family="sans-serif" fill="hsl(${hue}, 70%, 90%)" font-weight="bold">${initial}</text></svg>`;
  };

  const [invitations, setInvitations] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('My 3D Project');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: '', title: '', message: '', onConfirm: null, isProcessing: false });
  const [editUsername, setEditUsername] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [selectedTrashIds, setSelectedTrashIds] = useState([]);
  const [newProjectColor, setNewProjectColor] = useState('#ec4899');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const [editorScale, setEditorScale] = useState(1.2);
  const avatarInputRef = useRef(null);
  const editorRef = useRef(null);
  const importFileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleImportDesign = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedObjects = JSON.parse(event.target.result);
        if (Array.isArray(importedObjects)) {
          let newName = file.name;
          newName = newName.replace(/\.collab3d/gi, '').replace(/\.json/gi, '');
          newName = newName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
          
          if (!newName) newName = 'Imported Design';
          
          const isDuplicate = projects.some(p => p.name.trim().toLowerCase() === newName.toLowerCase());
          if (isDuplicate) {
            setModalConfig({
              isOpen: true,
              type: 'error',
              title: 'Import Failed',
              message: `A project with the name "${newName}" already exists. Please rename your existing project or the file before importing.`,
              onConfirm: () => setModalConfig({ ...modalConfig, isOpen: false })
            });
            if (importFileInputRef.current) importFileInputRef.current.value = '';
            return;
          }
          
          const token = localStorage.getItem('token');
          const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`, { 
            name: newName,
            data: { objects: importedObjects }
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setProjects([res.data, ...projects]);
          
          setModalConfig({
            isOpen: true,
            type: 'info',
            title: 'Import Successful',
            message: `Import file "${newName}" has been successfully imported to your dashboard!`,
            onConfirm: () => setModalConfig({ ...modalConfig, isOpen: false })
          });
          
        } else {
          setSettingsError('Invalid file format. Must be an array of objects.');
          setTimeout(() => setSettingsError(''), 3000);
        }
      } catch (err) {
        console.error('Failed to parse file:', err);
        setSettingsError('Failed to read the .collab3d file.');
        setTimeout(() => setSettingsError(''), 3000);
      }
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDuplicateProject = async (project, e) => {
    e.stopPropagation();
    try {
      let baseName = project.name;
      const copyMatch = project.name.match(/^(.*?)\s*\(\s*Copy(?:\s+\d+)?\s*\)$/i);
      if (copyMatch) {
        baseName = copyMatch[1];
      }

      let newName = `${baseName} (Copy)`;
      let copyNumber = 1;

      while (projects.some(p => p.name === newName)) {
        copyNumber++;
        newName = `${baseName} (Copy ${copyNumber})`;
      }

      const token = localStorage.getItem('token');
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`, { 
        name: newName,
        data: project.data || { objects: [] }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects([res.data, ...projects]);
      setModalConfig({
        isOpen: true, type: 'info', title: 'Project Duplicated',
        message: `Successfully duplicated "${project.name}"!`,
        onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) { console.error('Failed to duplicate:', err); }
  };

  const startRenameProject = (project, e) => {
    e.stopPropagation();
    setEditingProjectId(project._id);
    setEditingProjectName(project.name);
  };

  const submitRenameProject = async (projectId, e) => {
    if (e) e.stopPropagation();
    if (!editingProjectName.trim()) { setEditingProjectId(null); return; }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        name: editingProjectName.trim()
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setProjects(projects.map(p => p._id === projectId ? { ...p, name: editingProjectName.trim() } : p));
      setEditingProjectId(null);
    } catch (err) { console.error('Failed to rename:', err); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (location.state?.projectDeletedByAdmin) {
      setAdminProjectDeletedModal(true);
      window.history.replaceState({}, document.title); // clear state so it doesn't pop up again on refresh
    }

    if (location.state?.projectError) {
      setProjectErrorModal({ show: true, message: location.state.projectError });
      window.history.replaceState({}, document.title);
    }

    if (!token || !userData) {
      navigate('/login');
    } else {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchInvitations(token);

      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
      newSocket.on('user-status-changed', (data) => {
        if (data.userId === parsedUser.id && (data.status === 'banned' || data.status === 'deleted' || data.status === 'suspended')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setAdminActionModal({ show: true, status: data.status });
        }
      });
      newSocket.on('user-role-changed', (data) => {
        if (data.userId === parsedUser.id) {
          localStorage.setItem('token', data.newToken);
          localStorage.setItem('user', JSON.stringify(data.user));
          alert(`Your role has been updated to ${data.role.toUpperCase()} by an administrator.`);
          if (data.role === 'admin') {
            navigate('/admin-dashboard');
          } else {
            window.location.reload();
          }
        }
      });
      return () => newSocket.disconnect();
    }
  }, [navigate]);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const fetchTrash = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/trash`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrashProjects(res.data);
    } catch (err) {
      console.error('Failed to fetch trash', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'projects') fetchProjects();
    if (activeTab === 'trash') fetchTrash();
  }, [activeTab]);

  const fetchInvitations = async (token) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/invitations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvitations(res.data);
    } catch (err) {
      console.error('Error fetching invitations', err);
    }
  };

  const handleAcceptInvite = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/invitations/${projectId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInvitations(token);
      fetchProjects(token);
    } catch (err) {
      console.error('Error accepting invitation', err);
    }
  };

  const handleCreateProject = () => {
    setNewProjectName('My 3D Project');
    setNewProjectColor('#ec4899');
    setShowCreateModal(true);
  };

  const confirmCreateProject = async () => {
    if (!newProjectName.trim()) return;

    const isDuplicate = projects.some(p => p.name.trim().toLowerCase() === newProjectName.trim().toLowerCase());
    if (isDuplicate) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Project Name Exists',
        message: 'A project with this name already exists. Please choose a different name.',
        onConfirm: () => setModalConfig({ ...modalConfig, isOpen: false })
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`, { 
        name: newProjectName.trim(),
        folderColor: newProjectColor
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreateModal(false);
      navigate(`/workspace/${res.data._id}`);
    } catch (err) {
      console.error('Error creating project', err);
    }
  };

  const openConfirmModal = (type, title, message, onConfirm) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm, isProcessing: false });
  };
  
  const closeConfirmModal = () => {
    setModalConfig({ isOpen: false, type: '', title: '', message: '', onConfirm: null, isProcessing: false });
  };

  const handleDeleteProject = (id, e) => {
    e.stopPropagation();
    openConfirmModal(
      'trash',
      'Move to Trash',
      'Are you sure you want to move this project to the trash?',
      async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setProjects(projects.filter(p => p._id !== id));
          fetchTrash();
        } catch (err) {
          console.error('Failed to delete project', err);
        }
      }
    );
  };

  const handleRestoreProject = async (e, id) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrashProjects(trashProjects.filter(p => p._id !== id));
      fetchProjects();
    } catch (err) {
      console.error('Failed to restore project', err);
    }
  };

  const handlePermanentDelete = (e, id) => {
    e.stopPropagation();
    openConfirmModal(
      'permanent',
      'Delete Permanently',
      'Are you sure you want to PERMANENTLY delete this project? This action cannot be undone.',
      async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${id}/permanent`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setTrashProjects(trashProjects.filter(p => p._id !== id));
        } catch (err) {
          console.error('Failed to permanently delete project', err);
        }
      }
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleOpenSettings = () => {
    setEditUsername(user.username);
    setEditEmail(user.email || '');
    setEditAvatarUrl(user.avatarUrl || '');
    setEditPassword('');
    setSettingsError('');
    setSettingsSuccess('');
    setActiveTab('settings');
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditorFile(file);
    e.target.value = null;
  };

  const handleApplyCrop = () => {
    if (editorRef.current) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      setEditAvatarUrl(base64Image);
      setEditorFile(null);
      setEditorScale(1.2);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsError('');
    setSettingsSuccess('');
    setIsUpdatingProfile(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        username: editUsername,
        email: editEmail,
        avatarUrl: editAvatarUrl
      };
      if (editPassword.trim() !== '') {
        payload.password = editPassword;
      }

      const res = await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      
      setSettingsSuccess('Profile updated successfully!');
    } catch (err) {
      setSettingsError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleDeleteAccountClick = () => {
    setShowDeleteAccountModal(true);
  };

  const confirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setSettingsError('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setShowDeleteSuccess(true);
    } catch (err) {
      setSettingsError(err.response?.data?.message || 'Failed to delete account.');
      setIsDeletingAccount(false);
      setShowDeleteAccountModal(false);
    }
  };

  if (!user) return null;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar" style={{
        width: isSidebarOpen ? '260px' : '0px',
        padding: isSidebarOpen ? '1.5rem' : '0',
        opacity: isSidebarOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}>
        <div className="sidebar-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="brand" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem', fontWeight: 'bold', color: 'white' }}>
            <Box size={24} color="#6366f1" /> Collab 3D
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 'bold', marginLeft: '0.2rem' }}>
            <UserIcon color="#6366f1" size={18} strokeWidth={2.5} style={{ marginTop: '-1px' }} /> User Console
          </div>
        </div>
        <nav>
          <button 
            onClick={() => setActiveTab('projects')}
            className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
            style={{ width: '100%', background: activeTab === 'projects' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: activeTab === 'projects' ? '#6366f1' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}
          >
            <Layout size={20} /> Projects
          </button>
          <button 
            onClick={handleOpenSettings}
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ width: '100%', background: activeTab === 'settings' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: activeTab === 'settings' ? '#6366f1' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}
          >
            <Settings size={20} /> User Settings
          </button>
          <button 
            onClick={() => setActiveTab('trash')}
            className={`nav-item ${activeTab === 'trash' ? 'active' : ''}`}
            style={{ width: '100%', background: activeTab === 'trash' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: activeTab === 'trash' ? '#6366f1' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}
          >
            <Trash2 size={20} /> Trash
          </button>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <button 
            onClick={handleLogout} 
            className="nav-item" 
            style={{ width: '100%', background: 'transparent', color: '#6366f1', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <header className="main-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1rem 2rem' }}>
          <div style={{ width: '24px' }}></div> {/* Spacer */}
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontSize: '1.25rem', padding: '0.4rem 1.5rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '2rem', boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: 'linear-gradient(135deg, #c7d2fe, #818cf8, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(99,102,241,0.3))' }}>User Administration</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '0.25rem 0.75rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserIcon size={14}/> User Mode</span>
            <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#6d28d9', padding: '0.35rem 1rem 0.35rem 0.35rem', borderRadius: '2rem', border: 'none', transition: 'all 0.2s', cursor: 'pointer', boxShadow: '0 4px 15px rgba(109, 40, 217, 0.4)' }} onMouseOver={e => { e.currentTarget.style.background = '#5b21b6'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(109, 40, 217, 0.6)'; }} onMouseOut={e => { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(109, 40, 217, 0.4)'; }}>
              <div className="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '1rem' }}>
                <img 
                  src={user?.avatarUrl?.startsWith('data:') ? user.avatarUrl : (user?.avatarUrl ? getMediaUrl(user.avatarUrl) : getFallbackAvatar(user?.username))} 
                  alt="User Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(user?.username); }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '0.25rem' }}>
                <span style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem', lineHeight: '1.2' }}>{user.username}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', lineHeight: '1.2' }}>{user.email}</span>
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'projects' ? (
          <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Menu size={20} />
                </button>
                <h2 style={{ margin: 0, color: 'white' }}>My Projects</h2>
              </div>
              <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Search projects..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '2rem', outline: 'none', transition: 'border-color 0.2s' }} 
                  onFocus={e => e.target.style.borderColor = '#6366f1'} 
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} 
                />
              </div>
            </div>
            {invitations.length > 0 && (
              <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.4)', borderRadius: '0.5rem' }}>
                <h3 style={{ marginBottom: '1rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bell size={18} /> Pending Invitations ({invitations.length})
                </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {invitations.map(inv => (
                <div key={inv._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>
                    <strong>{inv.senderName}</strong> invited you to collaborate on <strong>"{inv.projectName}"</strong>
                  </span>
                  <button 
                    onClick={() => handleAcceptInvite(inv.projectId)}
                    style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.target.style.background = '#4338ca'}
                    onMouseOut={(e) => e.target.style.background = '#4f46e5'}
                  >
                    Accept & Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div 
            className="glass-card" 
            onClick={handleCreateProject}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', transition: 'all 0.3s ease' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Create New Project</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Start modeling from scratch</p>
          </div>

          <input 
            type="file" 
            ref={importFileInputRef} 
            onChange={handleImportDesign} 
            accept=".collab3d,.json" 
            style={{ display: 'none' }} 
          />
          <div 
            onClick={() => importFileInputRef.current?.click()}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', transition: 'all 0.3s ease', background: 'rgba(245, 158, 11, 0.05)', border: '2px dashed rgba(245, 158, 11, 0.4)', borderRadius: '1rem' }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'; e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.8)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.05)'; e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)'; }}
          >
            <Upload size={40} color="#f59e0b" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fcd34d' }}>Import Design</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload a .collab3d file</p>
          </div>

          {projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project) => (
            <div 
              key={project._id}
              className="glass-card" 
              onDoubleClick={() => navigate(`/workspace/${project._id}`)}
              style={{ position: 'relative', cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', minHeight: '200px', transition: 'all 0.3s ease' }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {user.id === project.owner && (
                <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.5)', padding: '0.25rem', borderRadius: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <button onClick={(e) => startRenameProject(project, e)} style={{ background: 'transparent', border: 'none', color: '#a78bfa', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Rename Project"><Edit2 size={16} /></button>
                  <button onClick={(e) => handleDuplicateProject(project, e)} style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Duplicate Project"><Copy size={16} /></button>
                  <button onClick={(e) => handleDeleteProject(project._id, e)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete Project"><Trash2 size={16} /></button>
                </div>
              )}
              <Folder size={40} color={project.folderColor || "#ec4899"} style={{ marginBottom: '1rem' }} />
              {editingProjectId === project._id ? (
                <div style={{ width: '100%', display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <input type="text" value={editingProjectName} onChange={e => setEditingProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitRenameProject(project._id, e)} style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid #6366f1', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', outline: 'none' }} autoFocus />
                  <button onClick={e => submitRenameProject(project._id, e)} style={{ background: '#10b981', border: 'none', color: 'white', borderRadius: '0.25rem', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16}/></button>
                  <button onClick={e => { e.stopPropagation(); setEditingProjectId(null); }} style={{ background: '#ef4444', border: 'none', color: 'white', borderRadius: '0.25rem', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16}/></button>
                </div>
              ) : (
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{project.name}</h3>
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>Last modified: {new Date(project.updatedAt).toLocaleDateString()}</p>
              
              <div style={{ width: '100%', marginTop: 'auto' }}>
                <button 
                  onClick={() => navigate(`/workspace/${project._id}`)}
                  style={{ width: '100%', background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.5)', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(236, 72, 153, 0.3)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(236, 72, 153, 0.2)'}
                >
                  Open Project
                </button>
              </div>
            </div>
          ))}
        </div>
          </div>
        ) : activeTab === 'trash' ? (
          <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Menu size={20} />
                </button>
                <h2 style={{ margin: 0, color: 'white' }}>Trash</h2>
              </div>
              
              {trashProjects.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={() => {
                      if (selectedTrashIds.length === trashProjects.length) {
                        setSelectedTrashIds([]);
                      } else {
                        setSelectedTrashIds(trashProjects.map(p => p._id));
                      }
                    }}
                    style={{ background: 'transparent', color: '#818cf8', border: '1px solid #818cf8', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
                  >
                    {selectedTrashIds.length === trashProjects.length ? 'Deselect All' : 'Select All'}
                  </button>
                  
                  {selectedTrashIds.length > 0 && (
                    <>
                      <button 
                        onClick={async () => {
                          setModalConfig({
                            isOpen: true,
                            type: 'info',
                            title: `Restore ${selectedTrashIds.length} Projects?`,
                            message: `Are you sure you want to restore ${selectedTrashIds.length} projects?`,
                            onConfirm: async () => {
                              try {
                                const token = localStorage.getItem('token');
                                await Promise.all(selectedTrashIds.map(id => 
                                  axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } })
                                ));
                                const resActive = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
                                const resTrash = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/trash`, { headers: { Authorization: `Bearer ${token}` } });
                                setProjects(resActive.data);
                                setTrashProjects(resTrash.data);
                                setSelectedTrashIds([]);
                              } catch (err) { console.error(err); }
                              setModalConfig(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        Restore Selected
                      </button>
                      <button 
                        onClick={async () => {
                          setModalConfig({
                            isOpen: true,
                            type: 'permanent',
                            title: `Delete ${selectedTrashIds.length} Projects?`,
                            message: `Are you sure you want to PERMANENTLY delete ${selectedTrashIds.length} projects? This cannot be undone.`,
                            onConfirm: async () => {
                              try {
                                const token = localStorage.getItem('token');
                                await Promise.all(selectedTrashIds.map(id => 
                                  axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${id}/permanent`, { headers: { Authorization: `Bearer ${token}` } })
                                ));
                                const resTrash = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/trash`, { headers: { Authorization: `Bearer ${token}` } });
                                setTrashProjects(resTrash.data);
                                setSelectedTrashIds([]);
                              } catch (err) { console.error(err); }
                              setModalConfig(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        Delete Selected
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {trashProjects.length > 0 ? (
              trashProjects.map(project => (
                <div 
                  key={project._id} 
                  className="glass-card" 
                  onClick={() => {
                    if (selectedTrashIds.includes(project._id)) {
                      setSelectedTrashIds(prev => prev.filter(id => id !== project._id));
                    } else {
                      setSelectedTrashIds(prev => [...prev, project._id]);
                    }
                  }}
                  style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', minHeight: '200px', border: `2px solid ${selectedTrashIds.includes(project._id) ? '#6366f1' : 'rgba(239, 68, 68, 0.3)'}`, background: selectedTrashIds.includes(project._id) ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.02)', transition: 'all 0.2s' }}
                >
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', width: '24px', height: '24px', borderRadius: '4px', border: `2px solid ${selectedTrashIds.includes(project._id) ? '#6366f1' : 'rgba(255,255,255,0.3)'}`, background: selectedTrashIds.includes(project._id) ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                    {selectedTrashIds.includes(project._id) && <Check size={16} color="white" />}
                  </div>
                  <Trash2 size={40} color={selectedTrashIds.includes(project._id) ? '#818cf8' : 'rgba(239, 68, 68, 0.5)'} style={{ marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{project.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>Deleted: {new Date(project.updatedAt).toLocaleDateString()}</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                    <button 
                      onClick={(e) => handleRestoreProject(e, project._id)}
                      style={{ flex: 1, background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.5)', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'}
                    >
                      Restore
                    </button>
                    <button 
                      onClick={(e) => handlePermanentDelete(e, project._id)}
                      style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ width: '100%', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <Trash2 size={48} style={{ opacity: 0.5, marginBottom: '1rem', display: 'inline-block' }} />
                <h2>Trash is Empty</h2>
                <p>Deleted projects will appear here.</p>
              </div>
            )}
          </div>
          </div>
        ) : null}

        {activeTab === 'settings' && (
          <div className="tab-content fade-in" style={{ padding: '2rem', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Menu size={20} />
              </button>
              <h2 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
                <Settings color="#6366f1" /> User Settings
              </h2>
            </div>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: 'rgba(30, 32, 47, 0.8)', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                {settingsError && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{settingsError}</div>}
                {settingsSuccess && <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#86efac', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>{settingsSuccess}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#6366f1', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 'bold', color: 'white', border: '4px solid rgba(99, 102, 241, 0.3)' }}>
                      {editAvatarUrl ? <img src={getMediaUrl(editAvatarUrl)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(user?.username); }} /> : user.username?.[0].toUpperCase()}
                    </div>
                    
                    <input type="file" id="user-avatar-upload" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                    <label htmlFor="user-avatar-upload" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', transition: 'all 0.2s' }}>
                      <Upload size={16} /> Upload New Avatar
                    </label>

                    {editorFile && (
                      <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <AvatarEditor
                          ref={editorRef}
                          image={editorFile}
                          width={200}
                          height={200}
                          border={20}
                          borderRadius={100}
                          color={[0, 0, 0, 0.6]}
                          scale={editorScale}
                          rotate={0}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Zoom</span>
                          <input type="range" min="1" max="3" step="0.01" value={editorScale} onChange={(e) => setEditorScale(parseFloat(e.target.value))} style={{ flex: 1 }} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button onClick={() => setEditorFile(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={handleApplyCrop} style={{ background: '#6366f1', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Apply Crop</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Username</label>
                    <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email</label>
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Change Password (leave blank to keep current)</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? "text" : "password"} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="New password" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', paddingRight: '2.5rem', borderRadius: '0.5rem', outline: 'none' }} onFocus={(e) => e.target.parentElement.style.borderColor = '#6366f1'} onBlur={(e) => e.target.parentElement.style.borderColor = 'rgba(255,255,255,0.1)'} />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button onClick={handleSaveSettings} disabled={isUpdatingProfile} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '1rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: isUpdatingProfile ? 'not-allowed' : 'pointer', marginTop: '1rem', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}>
                    {isUpdatingProfile ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div style={{ background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.05) 0%, rgba(153, 27, 27, 0.1) 100%)', borderRadius: '1rem', padding: '2rem', border: '1px solid rgba(239, 68, 68, 0.3)', marginTop: '2rem', boxShadow: '0 10px 30px -10px rgba(239, 68, 68, 0.15)', backdropFilter: 'blur(10px)' }}>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 'bold' }}>
                  <Trash2 size={24} color="#ef4444" /> Danger Zone
                </h3>
                <p style={{ color: '#cbd5e1', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  Once you delete your account, there is no going back. Please be certain. You will no longer be able to log in, and all your data and projects will be <strong style={{ color: '#ef4444' }}>permanently eradicated</strong>.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button 
                    onClick={handleDeleteAccountClick}
                    disabled={isDeletingAccount}
                    style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', border: 'none', padding: '0.85rem 1.75rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: isDeletingAccount ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.6)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)'; }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(239, 68, 68, 0.4)'; }}
                  >
                    <Trash2 size={18} /> {isDeletingAccount ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="fade-in" style={{ background: 'linear-gradient(145deg, rgba(30, 32, 47, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)', padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.4)', width: '450px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(153, 27, 27, 0.2) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)' }}>
              <Trash2 size={36} color="#ef4444" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Delete Account</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              Are you absolutely sure you want to <strong style={{ color: '#ef4444' }}>PERMANENTLY</strong> delete your account? You will no longer be able to log in, all your data will be eradicated, and you will need to create a new account to use the system again.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setShowDeleteAccountModal(false)} 
                disabled={isDeletingAccount}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', cursor: isDeletingAccount ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s', flex: 1 }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteAccount}
                disabled={isDeletingAccount}
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', border: 'none', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', cursor: isDeletingAccount ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.6)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)'; }}
              >
                {isDeletingAccount ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'rgba(25, 27, 40, 0.95)', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', width: '400px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'white' }}>Create New Project</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Project Name</label>
              <input 
                type="text" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '1rem', outline: 'none', marginBottom: '1.5rem' }}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmCreateProject(); }}
              />
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Folder Color</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f43f5e'].map(color => (
                  <button
                    key={color}
                    onClick={() => setNewProjectColor(color)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%', background: color,
                      border: newProjectColor === color ? '3px solid white' : 'none',
                      cursor: 'pointer', transition: 'transform 0.2s',
                      transform: newProjectColor === color ? 'scale(1.1)' : 'scale(1)'
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmCreateProject} style={{ background: '#4f46e5', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Create Project</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalConfig.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'linear-gradient(145deg, rgba(30, 32, 47, 0.95), rgba(20, 22, 33, 0.98))', padding: '2.5rem', borderRadius: '1.5rem', border: `1px solid ${modalConfig.type === 'permanent' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, width: '420px', maxWidth: '90%', boxShadow: `0 25px 50px -12px ${modalConfig.type === 'permanent' ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.5)'}` }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {modalConfig.type === 'permanent' ? <Trash2 color="#ef4444" size={24} /> : modalConfig.type === 'info' ? <CheckCircle color="#10b981" size={24} /> : modalConfig.type === 'error' ? <AlertTriangle color="#ef4444" size={24} /> : <Trash2 color="#6366f1" size={24} />} 
              {modalConfig.title}
            </h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              {modalConfig.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {modalConfig.type !== 'info' && modalConfig.type !== 'error' && (
                <button 
                  onClick={closeConfirmModal} 
                  disabled={modalConfig.isProcessing}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: modalConfig.isProcessing ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontWeight: '500' }}
                  onMouseOver={e => !modalConfig.isProcessing && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseOut={e => !modalConfig.isProcessing && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                >
                  Cancel
                </button>
              )}
              <button 
                onClick={async () => {
                  setModalConfig(prev => ({ ...prev, isProcessing: true }));
                  if (modalConfig.onConfirm) await modalConfig.onConfirm();
                  closeConfirmModal();
                }} 
                disabled={modalConfig.isProcessing}
                style={{ background: modalConfig.type === 'permanent' || modalConfig.type === 'error' ? '#ef4444' : modalConfig.type === 'info' ? '#10b981' : '#6366f1', border: 'none', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: modalConfig.isProcessing ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: `0 4px 12px ${modalConfig.type === 'permanent' || modalConfig.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : modalConfig.type === 'info' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}` }}
                onMouseOver={e => !modalConfig.isProcessing && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={e => !modalConfig.isProcessing && (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {modalConfig.isProcessing ? 'Processing...' : (modalConfig.type === 'permanent' ? 'Delete Permanently' : (modalConfig.type === 'info' || modalConfig.type === 'error') ? 'Okay' : 'Yes, Move to Trash')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Cropper Modal */}
      {editorFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'rgba(25, 27, 40, 0.95)', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', width: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: 'white', marginBottom: '1.5rem', fontSize: '1.2rem' }}>Adjust Profile Picture</h3>
            <AvatarEditor
              ref={editorRef}
              image={editorFile}
              width={200}
              height={200}
              border={50}
              borderRadius={100}
              color={[0, 0, 0, 0.8]}
              scale={editorScale}
              rotate={0}
              style={{ background: '#000', borderRadius: '0.5rem' }}
            />
            <div style={{ width: '100%', marginTop: '1.5rem' }}>
              <label style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Zoom</span>
                <span>{Math.round(editorScale * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.01" 
                value={editorScale} 
                onChange={(e) => setEditorScale(parseFloat(e.target.value))} 
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', width: '100%', justifyContent: 'flex-end' }}>
              <button onClick={() => { setEditorFile(null); setEditorScale(1.2); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleApplyCrop} style={{ background: '#4f46e5', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSuccess && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <CheckCircle size={40} color="#22c55e" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Account Deleted</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              You have successfully deleted your account.
            </p>
            <button 
              onClick={() => {
                setShowDeleteSuccess(false);
                navigate('/register');
              }}
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', padding: '0.85rem 2rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)'; }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {adminActionModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: adminActionModal.status === 'suspended' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: `1px solid ${adminActionModal.status === 'suspended' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
              <AlertTriangle size={40} color={adminActionModal.status === 'suspended' ? "#eab308" : "#ef4444"} />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Account {adminActionModal.status === 'banned' ? 'Banned' : adminActionModal.status === 'suspended' ? 'Suspended' : 'Deleted'}</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              {adminActionModal.status === 'banned' ? 'Your account has been banned by an administrator.' : adminActionModal.status === 'suspended' ? 'Your account is temporarily suspended by an administrator.' : 'Your account has been deleted by an administrator.'}
            </p>
            <button 
              onClick={() => {
                setAdminActionModal({ show: false, status: '' });
                navigate(adminActionModal.status === 'deleted' ? '/register' : '/login');
              }}
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', padding: '0.85rem 2rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)'; }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {adminProjectDeletedModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={40} color="#ef4444" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Project Deleted</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              This project was deleted by the administrator due to violated terms or restrictions and is no longer accessible.
            </p>
            <button 
              onClick={() => {
                setAdminProjectDeletedModal(false);
                fetchInvitations(localStorage.getItem('token')); // Refresh data just in case
              }}
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', padding: '0.85rem 2rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)'; }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {projectErrorModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={40} color="#ef4444" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Access Denied</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              {projectErrorModal.message}
            </p>
            <button 
              onClick={() => setProjectErrorModal({ show: false, message: '' })}
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', padding: '0.85rem 2rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
