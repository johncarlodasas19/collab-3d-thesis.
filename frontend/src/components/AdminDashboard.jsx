import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Box, Menu, Users, AlertTriangle, Activity, LogOut, ShieldAlert, CheckCircle2, XCircle, Trash2, Shield, UserX, BarChart3, Clock, Database, Globe, Eye, EyeOff, Search, Filter, Download, Mail, ShieldCheck, ShieldOff, Settings, Upload, PieChart, CheckCircle, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import AvatarEditor from 'react-avatar-editor';
import { io } from 'socket.io-client';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ totalUsers: 0, activeProjects: 0, pendingReports: 0, totalDeletedProjects: 0 });
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [reportFilter, setReportFilter] = useState('all');
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [adminActionModal, setAdminActionModal] = useState({ show: false, status: '' });
  const [deletedProjectIds, setDeletedProjectIds] = useState([]);
  const [adminActionSuccessModal, setAdminActionSuccessModal] = useState({ show: false, message: '' });
  const [checkWorkspaceWarningModal, setCheckWorkspaceWarningModal] = useState({ show: false, message: '' });
  
  // Pagination & Sort State
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportPage, setReportPage] = useState(1);
  const [reportSortOrder, setReportSortOrder] = useState('newest');
  const reportsPerPage = 10;
  
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [activitySortOrder, setActivitySortOrder] = useState('newest');
  const activityPerPage = 15;
  
  // Custom Modal State
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, projectId: null });
  const [evidenceModal, setEvidenceModal] = useState({ isOpen: false, url: null, error: false });
  const [bulkDeleteModal, setBulkDeleteModal] = useState({ isOpen: false, type: null, title: '', message: '' });
  const [suspensionModal, setSuspensionModal] = useState({ isOpen: false, userId: null, hours: 24, minutes: 0 });
  
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location]);

  // Settings State
  const [editUsername, setEditUsername] = useState(currentUser.username || '');
  const [editEmail, setEditEmail] = useState(currentUser.email || '');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const [editorScale, setEditorScale] = useState(1.2);
  const [showPassword, setShowPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const chartRef = useRef(null);

  const formatPHTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', { 
      timeZone: 'Asia/Manila', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }) + ' (PHT)';
  };

  const editorRef = React.useRef(null);

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      navigate('/dashboard'); // Kick out non-admins
      return;
    }
    fetchData();

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    newSocket.on('user-status-changed', (data) => {
      if (data.userId === currentUser.id && (data.status === 'banned' || data.status === 'deleted' || data.status === 'suspended')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAdminActionModal({ show: true, status: data.status });
      } else {
        fetchData(); // Refresh list automatically when another user's status changes
      }
    });
    newSocket.on('user-role-changed', (data) => {
      if (data.userId === currentUser.id) {
        localStorage.setItem('token', data.newToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        alert(`Your role has been updated to ${data.role.toUpperCase()} by an administrator.`);
        if (data.role === 'user') {
          navigate('/dashboard');
        } else {
          window.location.reload();
        }
      } else {
        fetchData(); // Refresh list automatically when another user's role changes
      }
    });
    newSocket.on('new-report-submitted', (newReport) => {
      setReports(prev => [newReport, ...prev]);
      setStats(prev => ({ ...prev, pendingReports: prev.pendingReports + 1 }));

    });
    return () => newSocket.disconnect();
  }, [navigate]);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, usersRes, reportsRes, logsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/stats`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/reports`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/activity`, { headers })
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setReports(reportsRes.data);
      setActivityLogs(logsRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
      if (err.response?.status === 403) navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, role) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users/${userId}/role`, { role }, { headers: { Authorization: `Bearer ${token}` } });
      setAdminActionSuccessModal({ show: true, message: `User role has been successfully updated to ${role.toUpperCase()}.` });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleUpdateStatus = async (userId, status) => {
    if (status === 'suspended') {
      setSuspensionModal({ isOpen: true, userId, hours: 24, minutes: 0 });
      return;
    }
    executeStatusUpdate(userId, status);
  };

  const executeStatusUpdate = async (userId, status, hours = null, customMessage = null) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users/${userId}/status`, { status, suspensionHours: hours }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      if (status === 'suspended') {
        setAdminActionSuccessModal({ show: true, message: customMessage || `User account suspended for ${hours} hours.` });
      } else {
        setAdminActionSuccessModal({ show: true, message: `User status successfully updated to ${status}.` });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const confirmSuspension = () => {
    if (!suspensionModal.userId) return;
    const { hours, minutes } = suspensionModal;
    const totalHours = hours + (minutes / 60);
    
    let timeParts = [];
    if (hours > 0) timeParts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) timeParts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    const timeString = timeParts.join(' and ');
    const customMessage = `User account suspended for ${timeString}.`;

    executeStatusUpdate(suspensionModal.userId, 'suspended', totalHours, customMessage);
    setSuspensionModal({ isOpen: false, userId: null, hours: 24, minutes: 0 });
  };

  const handleDeleteUserClick = (userId, username) => {
    setUserToDelete({ id: userId, username });
    setShowDeleteUserModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users/${userToDelete.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setShowDeleteUserModal(false);
      setAdminActionSuccessModal({ show: true, message: 'User has been successfully deleted.' });
      fetchData();
      setUserToDelete(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleResolveReport = async (reportId, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/reports/${reportId}/resolve`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert('Failed to resolve report');
    }
  };

  const handleForceDeleteProject = (projectId) => {
    setDeleteModal({ isOpen: true, projectId });
  };

  const handleClearOldActivity = () => {
    setBulkDeleteModal({
      isOpen: true,
      type: 'activity',
      title: 'Clear Old Activity Logs',
      message: 'Are you sure you want to permanently delete all activity logs older than 30 days? This action cannot be undone.'
    });
  };

  const handleClearResolvedReports = () => {
    setBulkDeleteModal({
      isOpen: true,
      type: 'reports',
      title: 'Clear Resolved Reports',
      message: 'Are you sure you want to permanently delete all resolved and dismissed reports? This action cannot be undone.'
    });
  };

  const confirmBulkDelete = async () => {
    const { type } = bulkDeleteModal;
    setBulkDeleteModal({ ...bulkDeleteModal, isOpen: false });

    if (type === 'activity') {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/activity/cleanup`, { headers: { Authorization: `Bearer ${token}` } });
        setAdminActionSuccessModal({ show: true, message: 'Old activity logs cleared successfully.' });
        fetchData();
      } catch (err) {
        alert('Failed to clean up activity logs');
      }
    } else if (type === 'reports') {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/reports/cleanup`, { headers: { Authorization: `Bearer ${token}` } });
        setAdminActionSuccessModal({ show: true, message: 'Resolved reports cleared successfully.' });
        fetchData();
      } catch (err) {
        alert('Failed to clean up resolved reports');
      }
    }
  };

  const handleCheckWorkspace = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      localStorage.setItem('adminReturnTab', 'reports');
      window.open(`/workspace/${projectId}?from=reports`, '_blank');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setCheckWorkspaceWarningModal({ show: true, message: 'You can no longer check the workspace because the project was deleted by the administrator due to violated terms.' });
      } else {
        setCheckWorkspaceWarningModal({ show: true, message: 'You can no longer check the workspace because it is no longer accessible.' });
      }
    }
  };

  const confirmForceDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/projects/${deleteModal.projectId}/force`, { headers: { Authorization: `Bearer ${token}` } });
      const deletedId = deleteModal.projectId;
      setDeleteModal({ isOpen: false, projectId: null });
      setDeletedProjectIds(prev => [...prev, deletedId]);
      fetchData(false); // Refresh without full screen loading
      setAdminActionSuccessModal({ show: true, message: 'Project successfully deleted.' });
    } catch (err) {
      console.error('Failed to force delete project');
      alert('Error Force Deleting: ' + (err.response?.data?.message || err.message));
      setDeleteModal({ isOpen: false, projectId: null });
    }
  };

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
      setCurrentUserData(res.data.user);
      
      setSettingsSuccess('Profile updated successfully!');
      
      // Update local state if needed
      if (res.data.user.username !== currentUser.username) {
        window.location.reload(); // Quick refresh to update all displays if username changes
      }
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

  const downloadCSV = () => {
    const headers = ['Date', 'User', 'Action', 'Details'];
    const rows = activityLogs.map(log => [
      formatPHTime(log.createdAt).replace(/,/g, ''),
      log.username,
      log.action,
      `"${log.details || ''}"` // Wrap in quotes to prevent comma issues
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `system_activity_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', zIndex: 99999 }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #ef4444', borderRadius: '50%', animation: 'spin 0.3s linear infinite', marginBottom: '1.5rem' }}></div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', margin: 0, letterSpacing: '0.3em', paddingLeft: '0.3em' }}>
          LOADING
        </h2>
      </div>
    );
  }

  // Filter & Search & Paginate Reports
  let filteredReports = reports.filter(r => {
    const matchesFilter = reportFilter === 'all' || r.status === reportFilter;
    const searchLower = reportSearchQuery.toLowerCase();
    const matchesSearch = (r.reportedProjectName || '').toLowerCase().includes(searchLower) ||
                          (r.reporterName || '').toLowerCase().includes(searchLower) ||
                          (r.reason || '').toLowerCase().includes(searchLower) ||
                          (r.reportedProjectId || '').toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  if (reportSortOrder === 'oldest') {
    filteredReports = filteredReports.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    filteredReports = filteredReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const totalReportPages = Math.ceil(filteredReports.length / reportsPerPage) || 1;
  const paginatedReports = filteredReports.slice((reportPage - 1) * reportsPerPage, reportPage * reportsPerPage);

  // Filter & Search & Paginate Activity
  let filteredActivity = activityLogs.filter(log => {
    const searchLower = activitySearchQuery.toLowerCase();
    return (log.username || '').toLowerCase().includes(searchLower) ||
           (log.action || '').toLowerCase().includes(searchLower) ||
           (log.details || '').toLowerCase().includes(searchLower);
  });

  if (activitySortOrder === 'oldest') {
    filteredActivity = filteredActivity.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    filteredActivity = filteredActivity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const totalActivityPages = Math.ceil(filteredActivity.length / activityPerPage) || 1;
  const paginatedActivity = filteredActivity.slice((activityPage - 1) * activityPerPage, activityPage * activityPerPage);

  return (
    <div className="dashboard-layout" style={{ background: '#0f172a' }}>
      <aside className="sidebar" style={{ 
        background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)', 
        borderRight: '1px solid rgba(99, 102, 241, 0.2)',
        width: isSidebarOpen ? '260px' : '0px',
        opacity: isSidebarOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}>
        <div className="sidebar-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', paddingBottom: '1.5rem' }}>
          <div className="brand" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem', fontWeight: 'bold', color: 'white' }}>
            <Box size={24} color="#ef4444" /> Collab 3D
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 'bold', marginLeft: '0.2rem' }}>
            <Shield color="#ef4444" size={18} strokeWidth={2.5} style={{ marginTop: '-1px' }} /> Admin Console
          </div>
        </div>
        <nav>
          <button onClick={() => setActiveTab('overview')} className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} style={{ width: '100%', background: activeTab === 'overview' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activeTab === 'overview' ? '#ef4444' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
            <BarChart3 size={20} /> Overview
          </button>
          <button onClick={() => setActiveTab('users')} className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} style={{ width: '100%', background: activeTab === 'users' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activeTab === 'users' ? '#ef4444' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
            <Users size={20} /> User Management
          </button>
          <button onClick={() => setActiveTab('reports')} className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} style={{ width: '100%', background: activeTab === 'reports' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activeTab === 'reports' ? '#ef4444' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem', position: 'relative' }}>
            <AlertTriangle size={20} /> Flagged Content
            {stats.pendingReports > 0 && <span style={{ position: 'absolute', right: '1rem', background: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontWeight: 'bold' }}>{stats.pendingReports}</span>}
          </button>
          <button onClick={() => setActiveTab('activity')} className={`nav-item ${activeTab === 'activity' ? 'active' : ''}`} style={{ width: '100%', background: activeTab === 'activity' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activeTab === 'activity' ? '#ef4444' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
            <Activity size={20} /> System Activity
          </button>
          <button onClick={() => setActiveTab('settings')} className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} style={{ width: '100%', background: activeTab === 'settings' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activeTab === 'settings' ? '#ef4444' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
            <Settings size={20} /> Admin Settings
          </button>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content" style={{ overflowY: 'auto' }}>
        <header className="main-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1rem 2rem' }}>
          <div style={{ width: '24px' }}></div> {/* Spacer to keep profile on the right */}
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontSize: '1.25rem', padding: '0.4rem 1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '2rem', boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: 'linear-gradient(135deg, #fca5a5, #ef4444, #b91c1c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(239,68,68,0.3))' }}>System Administration</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.25rem 0.75rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldAlert size={14}/> Admin Mode</span>
            <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#dc2626', padding: '0.35rem 1rem 0.35rem 0.35rem', borderRadius: '2rem', border: 'none', transition: 'all 0.2s', cursor: 'pointer', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)' }} onMouseOver={e => { e.currentTarget.style.background = '#b91c1c'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(220, 38, 38, 0.6)'; }} onMouseOut={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.4)'; }}>
              <div className="avatar" style={{ width: '36px', height: '36px', background: 'rgba(0,0,0,0.15)', overflow: 'hidden', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '1rem', color: 'white' }}>
                {currentUser.avatarUrl ? <img src={getMediaUrl(currentUser.avatarUrl)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(currentUser.username); }} /> : currentUser.username?.[0]?.toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '0.25rem' }}>
                <span style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem', lineHeight: '1.2' }}>{currentUser.username}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', lineHeight: '1.2' }}>{currentUser.email}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'overview' && (
            <div className="tab-content fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Menu size={20} />
                </button>
                <h2 style={{ margin: 0, color: 'white' }}>System Overview</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(30, 32, 47, 0.8), rgba(20, 22, 33, 0.9))', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={16}/> Total Users</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>{stats.totalUsers}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, rgba(30, 32, 47, 0.8), rgba(20, 22, 33, 0.9))', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Database size={16}/> Active Projects</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>{stats.activeProjects}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, rgba(30, 32, 47, 0.8), rgba(20, 22, 33, 0.9))', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={16}/> Pending Reports</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.pendingReports}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, rgba(30, 32, 47, 0.8), rgba(20, 22, 33, 0.9))', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Trash2 size={16}/> Trashed Projects</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>{stats.totalDeletedProjects}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 100%', background: 'rgba(30, 32, 47, 0.8)', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ color: 'white', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                    <PieChart size={20} color="#6366f1" /> System Overview Distribution (Live Updates)
                  </h3>
                  
                  {(() => {
                    const u = stats.totalUsers || 0;
                    const p = stats.activeProjects || 0;
                    const r = stats.pendingReports || 0;
                    const t = stats.totalDeletedProjects || 0;
                    const total = u + p + r + t;
                    
                    const uPct = total === 0 ? 0 : (u / total) * 100;
                    const pPct = total === 0 ? 0 : (p / total) * 100;
                    const rPct = total === 0 ? 0 : (r / total) * 100;
                    const tPct = total === 0 ? 0 : (t / total) * 100;
                    
                    // Colors
                    const cU = '#3b82f6'; // Blue for Users
                    const cP = '#8b5cf6'; // Purple for Projects
                    const cR = '#ef4444'; // Red for Reports
                    const cT = '#f59e0b'; // Amber for Trashed
                    
                    return (
                      <div style={{ display: 'flex', gap: '4rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {/* Huge Dynamic CSS Doughnut Chart */}
                        <div style={{ 
                          width: '240px', height: '240px', borderRadius: '50%', 
                          background: total === 0 ? 'rgba(255,255,255,0.1)' : `conic-gradient(${cU} 0% ${uPct}%, ${cP} ${uPct}% ${uPct + pPct}%, ${cR} ${uPct + pPct}% ${uPct + pPct + rPct}%, ${cT} ${uPct + pPct + rPct}% 100%)`, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          boxShadow: '0 0 30px rgba(0,0,0,0.4)',
                          transition: 'background 0.5s ease'
                        }}>
                          {/* Inner circle */}
                          <div style={{ width: '170px', height: '170px', borderRadius: '50%', background: 'rgba(30, 32, 47, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)' }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>{total}</span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Total Items</span>
                          </div>
                        </div>

                        {/* Chart Legend & Live Stats */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '300px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', borderLeft: `4px solid ${cU}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Users size={18} color={cU} />
                              <span style={{ color: 'white', fontSize: '1rem' }}>Total Users</span>
                            </div>
                            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>{u} <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'normal' }}>({uPct.toFixed(1)}%)</span></span>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', borderLeft: `4px solid ${cP}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Database size={18} color={cP} />
                              <span style={{ color: 'white', fontSize: '1rem' }}>Active Projects</span>
                            </div>
                            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>{p} <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'normal' }}>({pPct.toFixed(1)}%)</span></span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', borderLeft: `4px solid ${cR}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <AlertTriangle size={18} color={cR} />
                              <span style={{ color: 'white', fontSize: '1rem' }}>Pending Reports</span>
                            </div>
                            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>{r} <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'normal' }}>({rPct.toFixed(1)}%)</span></span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', borderLeft: `4px solid ${cT}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Trash2 size={18} color={cT} />
                              <span style={{ color: 'white', fontSize: '1rem' }}>Trashed Projects</span>
                            </div>
                            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>{t} <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'normal' }}>({tPct.toFixed(1)}%)</span></span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="tab-content fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Menu size={20} />
                  </button>
                  <h2 style={{ color: 'white', margin: 0 }}>User Management</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '2rem', width: '300px' }}>
                  <Search size={18} color="#94a3b8" style={{ marginRight: '0.5rem' }} />
                  <input 
                    type="text" 
                    placeholder="Search username or email..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
              <div style={{ background: 'rgba(30, 32, 47, 0.8)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '1rem' }}>Username</th>
                      <th style={{ padding: '1rem' }}>Email</th>
                      <th style={{ padding: '1rem' }}>Role</th>
                      <th style={{ padding: '1rem' }}>Status</th>
                      <th style={{ padding: '1rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                      <tr key={u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)', border: `2px solid ${u.role === 'admin' ? '#ef4444' : '#6366f1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden' }}>
                            {u.avatarUrl ? (
                              <img src={getMediaUrl(u.avatarUrl)} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(u.username); }} />
                            ) : (
                              <span style={{ color: u.role === 'admin' ? '#fca5a5' : '#818cf8', fontSize: '1.2rem' }}>{u.username[0].toUpperCase()}</span>
                            )}
                          </div>
                          <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>{u.username}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Mail size={14} /> {u.email}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)', color: u.role === 'admin' ? '#fca5a5' : '#818cf8', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select 
                            value={u.status} 
                            onChange={(e) => handleUpdateStatus(u._id, e.target.value)}
                            disabled={u._id === currentUser.id}
                            style={{ 
                              background: 'rgba(15, 23, 42, 0.9)', 
                              color: u.status === 'active' ? '#4ade80' : (u.status === 'suspended' ? '#fbbf24' : '#f87171'), 
                              border: '1px solid rgba(255,255,255,0.2)', 
                              padding: '0.5rem', 
                              borderRadius: '0.5rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              outline: 'none',
                              fontSize: '0.9rem'
                            }}
                          >
                            <option value="active" style={{ background: '#1e293b', color: '#4ade80', fontWeight: 'bold' }}>Active</option>
                            <option value="suspended" style={{ background: '#1e293b', color: '#fbbf24', fontWeight: 'bold' }}>Suspended</option>
                            <option value="banned" style={{ background: '#1e293b', color: '#f87171', fontWeight: 'bold' }}>Banned</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {u._id !== currentUser.id && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={() => handleUpdateRole(u._id, u.role === 'admin' ? 'user' : 'admin')}
                                style={{ 
                                  background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
                                  border: `1px solid ${u.role === 'admin' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`, 
                                  color: u.role === 'admin' ? '#fca5a5' : '#4ade80', 
                                  padding: '0.5rem 1rem', 
                                  borderRadius: '2rem', 
                                  cursor: 'pointer', 
                                  fontSize: '0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  fontWeight: 'bold',
                                  transition: 'all 0.2s',
                                  flex: 1,
                                  justifyContent: 'center'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = u.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)' }}
                                onMouseOut={(e) => { e.currentTarget.style.background = u.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)' }}
                              >
                                {u.role === 'admin' ? <><ShieldOff size={14}/> Revoke Admin</> : <><ShieldCheck size={14}/> Make Admin</>}
                              </button>

                              <button 
                                onClick={() => handleDeleteUserClick(u._id, u.username)}
                                style={{ 
                                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(153, 27, 27, 0.2) 100%)', 
                                  border: '1px solid rgba(239, 68, 68, 0.3)', 
                                  color: '#fca5a5', 
                                  padding: '0.5rem 1rem', 
                                  borderRadius: '2rem', 
                                  cursor: 'pointer', 
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.4rem',
                                  fontWeight: 'bold',
                                  fontSize: '0.85rem',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  width: '110px'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(185, 28, 28, 0.9) 100%)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(153, 27, 27, 0.2) 100%)'; e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                title="Permanently Delete User"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="tab-content fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Menu size={20} />
                  </button>
                  <h2 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle color="#ef4444" /> Review Flagged Content</h2>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text" 
                      placeholder="Search reports..." 
                      value={reportSearchQuery}
                      onChange={(e) => { setReportSearchQuery(e.target.value); setReportPage(1); }}
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '0.5rem', fontSize: '0.85rem', outline: 'none', width: '200px' }}
                    />
                  </div>

                  <button 
                    onClick={() => setReportSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    <ArrowUpDown size={14} /> {reportSortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button onClick={() => { setReportFilter('all'); setReportPage(1); }} style={{ padding: '0.4rem 0.75rem', background: reportFilter === 'all' ? '#6366f1' : 'transparent', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>All</button>
                    <button onClick={() => { setReportFilter('pending'); setReportPage(1); }} style={{ padding: '0.4rem 0.75rem', background: reportFilter === 'pending' ? '#ef4444' : 'transparent', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>Pending</button>
                    <button onClick={() => { setReportFilter('resolved'); setReportPage(1); }} style={{ padding: '0.4rem 0.75rem', background: reportFilter === 'resolved' ? '#22c55e' : 'transparent', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>Resolved</button>
                  </div>

                  <button 
                    onClick={handleClearResolvedReports}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                    title="Delete all resolved and dismissed reports permanently"
                  >
                    <Trash2 size={14} /> Clear Resolved
                  </button>
                </div>
              </div>
              
              {paginatedReports.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(30, 32, 47, 0.8)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <CheckCircle2 size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto', display: 'block' }} />
                  <p>All caught up! There are no records to show here.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                    {paginatedReports.map(report => (
                    <div key={report._id} style={{ background: 'rgba(30, 32, 47, 0.8)', borderRadius: '1rem', border: '1px solid', borderColor: report.status === 'pending' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: 'white', fontWeight: 'bold' }}>Project: {report.reportedProjectName || report.reportedProjectId}</span>
                            <span style={{ background: report.status === 'pending' ? '#ef4444' : (report.status === 'resolved' ? '#22c55e' : '#64748b'), color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontWeight: 'bold' }}>{report.status.toUpperCase()}</span>
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Reported by: <strong>{report.reporterName}</strong> on {formatPHTime(report.createdAt)}</div>
                        </div>
                        {report.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'stretch', flexWrap: 'nowrap' }}>
                            <button 
                              onClick={() => handleResolveReport(report._id, 'dismissed')} 
                              style={{ flex: 1, whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.6rem 0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '500', transition: 'all 0.2s' }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                            >
                              <XCircle size={16} /> Dismiss
                            </button>
                            <button 
                              onClick={() => handleResolveReport(report._id, 'resolved')} 
                              style={{ flex: 1, whiteSpace: 'nowrap', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', padding: '0.6rem 0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '500', transition: 'all 0.2s' }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'; e.currentTarget.style.color = '#22c55e'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)'; e.currentTarget.style.color = '#4ade80'; }}
                            >
                              <CheckCircle2 size={16} /> Resolve
                            </button>
                            <button 
                              onClick={() => handleCheckWorkspace(report.reportedProjectId)} 
                              style={{ flex: 1, whiteSpace: 'nowrap', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '0.6rem 0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '500', transition: 'all 0.2s' }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; e.currentTarget.style.color = '#3b82f6'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = '#60a5fa'; }}
                              title="Enter Workspace to Investigate"
                            >
                              <Eye size={16} /> Check Workspace
                            </button>
                            <button 
                              onClick={() => !(report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) && handleForceDeleteProject(report.reportedProjectId)} 
                              style={{ flex: 1, whiteSpace: 'nowrap', background: (report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid', borderColor: (report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.3)', color: (report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) ? '#64748b' : '#f87171', padding: '0.6rem 0.5rem', borderRadius: '0.5rem', cursor: (report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '500', transition: 'all 0.2s', opacity: (report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) ? 0.5 : 1 }}
                              onMouseOver={(e) => { if (!(report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId))) { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#ef4444'; } }}
                              onMouseOut={(e) => { if (!(report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId))) { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#f87171'; } }}
                              title={(report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) ? "Already deleted" : ""}
                            >
                              <Trash2 size={16} /> {(report.isProjectDeleted || deletedProjectIds.includes(report.reportedProjectId)) ? 'Deleted' : 'Delete Project'}
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #ef4444', color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.5', flex: 1 }}>
                        <strong>Reason provided:</strong><br />
                        {report.reason}
                        
                        {report.proofUrl && (
                          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center' }}>
                            <button 
                              onClick={() => setEvidenceModal({ isOpen: true, url: report.proofUrl, error: false })}
                              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold', width: '100%', maxWidth: '300px' }}
                            >
                              <AlertTriangle size={16} /> Preview Attached Evidence
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                  {totalReportPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 32, 47, 0.8)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Showing {((reportPage - 1) * reportsPerPage) + 1} to {Math.min(reportPage * reportsPerPage, filteredReports.length)} of {filteredReports.length} reports</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => setReportPage(p => Math.max(1, p - 1))} 
                          disabled={reportPage === 1}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: reportPage === 1 ? 'rgba(255,255,255,0.2)' : 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: reportPage === 1 ? 'not-allowed' : 'pointer' }}
                        >
                          <ChevronLeft size={16} /> Prev
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'white', padding: '0 0.5rem', fontSize: '0.9rem' }}>Page {reportPage} of {totalReportPages}</span>
                        <button 
                          onClick={() => setReportPage(p => Math.min(totalReportPages, p + 1))} 
                          disabled={reportPage === totalReportPages}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: reportPage === totalReportPages ? 'rgba(255,255,255,0.2)' : 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: reportPage === totalReportPages ? 'not-allowed' : 'pointer' }}
                        >
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="tab-content fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Menu size={20} />
                  </button>
                  <h2 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity color="#6366f1" /> System Activity Log</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text" 
                      placeholder="Search activity..." 
                      value={activitySearchQuery}
                      onChange={(e) => { setActivitySearchQuery(e.target.value); setActivityPage(1); }}
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '0.5rem', fontSize: '0.85rem', outline: 'none', width: '200px' }}
                    />
                  </div>

                  <button 
                    onClick={() => setActivitySortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    <ArrowUpDown size={14} /> {activitySortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                  </button>

                  <button 
                    onClick={downloadCSV}
                    style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                  >
                    <Download size={14} /> Export
                  </button>

                  <button 
                    onClick={handleClearOldActivity}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                    title="Delete activity logs older than 30 days"
                  >
                    <Trash2 size={14} /> Clear Old Logs
                  </button>
                </div>
              </div>
              <div style={{ background: 'rgba(30, 32, 47, 0.8)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', padding: '1.5rem' }}>
                {paginatedActivity.length === 0 ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No activity logs found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                      {paginatedActivity.map((log, index) => (
                        <div key={log._id || index} style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ color: '#6366f1', paddingTop: '0.2rem' }}><Globe size={20} /></div>
                          <div>
                            <div style={{ color: 'white', fontWeight: '500' }}>
                              <span style={{ color: '#818cf8' }}>{log.username}</span> {log.action}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>{log.details}</div>
                            <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} /> {formatPHTime(log.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalActivityPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', marginTop: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Showing {((activityPage - 1) * activityPerPage) + 1} to {Math.min(activityPage * activityPerPage, filteredActivity.length)} of {filteredActivity.length} logs</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => setActivityPage(p => Math.max(1, p - 1))} 
                            disabled={activityPage === 1}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: activityPage === 1 ? 'rgba(255,255,255,0.2)' : 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: activityPage === 1 ? 'not-allowed' : 'pointer' }}
                          >
                            <ChevronLeft size={16} /> Prev
                          </button>
                          <span style={{ display: 'flex', alignItems: 'center', color: 'white', padding: '0 0.5rem', fontSize: '0.9rem' }}>Page {activityPage} of {totalActivityPages}</span>
                          <button 
                            onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))} 
                            disabled={activityPage === totalActivityPages}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: activityPage === totalActivityPages ? 'rgba(255,255,255,0.2)' : 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: activityPage === totalActivityPages ? 'not-allowed' : 'pointer' }}
                          >
                            Next <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="tab-content fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Menu size={20} />
                </button>
                <h2 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Settings color="#ef4444" /> Admin Settings
                </h2>
              </div>
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ background: 'rgba(30, 32, 47, 0.8)', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {settingsError && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{settingsError}</div>}
                  {settingsSuccess && <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>{settingsSuccess}</div>}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#ef4444', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 'bold', color: 'white', border: '4px solid rgba(239, 68, 68, 0.3)' }}>
                        {editAvatarUrl ? <img src={getMediaUrl(editAvatarUrl)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(currentUser.username); }} /> : currentUser.username?.[0].toUpperCase()}
                      </div>
                      
                      <input type="file" id="admin-avatar-upload" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                      <label htmlFor="admin-avatar-upload" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', transition: 'all 0.2s' }}>
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
                            <button onClick={handleApplyCrop} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Apply Crop</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Username</label>
                      <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = '#ef4444'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    </div>

                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email</label>
                      <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = '#ef4444'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    </div>

                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Change Password (leave blank to keep current)</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPassword ? "text" : "password"} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="New password" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', paddingRight: '2.5rem', borderRadius: '0.5rem', outline: 'none' }} onFocus={(e) => e.target.parentElement.style.borderColor = '#ef4444'} onBlur={(e) => e.target.parentElement.style.borderColor = 'rgba(255,255,255,0.1)'} />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)} 
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button onClick={handleSaveSettings} disabled={isUpdatingProfile} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '1rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: isUpdatingProfile ? 'not-allowed' : 'pointer', marginTop: '1rem', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}>
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
                    Once you delete your admin account, there is no going back. You will no longer be able to log in, and all your data and history will be <strong style={{ color: '#ef4444' }}>permanently eradicated</strong>.
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

        </div>
      </main>

      {/* Custom Delete User Modal */}
      {showDeleteUserModal && userToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="fade-in" style={{ background: 'linear-gradient(145deg, rgba(30, 32, 47, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)', padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.4)', width: '450px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(153, 27, 27, 0.2) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)' }}>
              <UserX size={36} color="#ef4444" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Delete User</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              Are you sure you want to permanently delete user <strong style={{ color: '#ef4444' }}>"{userToDelete.username}"</strong>? They will no longer be able to log in and will be permanently removed from the system.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button 
                onClick={() => { setShowDeleteUserModal(false); setUserToDelete(null); }} 
                disabled={isDeletingUser}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', cursor: isDeletingUser ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s', flex: 1 }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteUser}
                disabled={isDeletingUser}
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', border: 'none', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', cursor: isDeletingUser ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.6)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)'; }}
              >
                {isDeletingUser ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="fade-in" style={{ background: 'linear-gradient(145deg, rgba(30, 32, 47, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)', padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.4)', width: '450px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(153, 27, 27, 0.2) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)' }}>
              <Trash2 size={36} color="#ef4444" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Delete Admin Account</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              Are you absolutely sure you want to <strong style={{ color: '#ef4444' }}>PERMANENTLY</strong> delete your Admin account? You will no longer be able to log in, your data will be eradicated, and you will need to create a new account to access the system.
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

      {/* Custom Force Delete Modal */}
      {deleteModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="modal-content fade-in" style={{ background: '#1e202f', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '400px', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 1.5rem auto' }}>
              <Trash2 size={32} color="#ef4444" />
            </div>
            <h3 style={{ color: 'white', marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>Delete Project</h3>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Are you sure you want to completely delete this project from the platform? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setDeleteModal({ isOpen: false, projectId: null })} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmForceDelete} 
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', flex: 1, boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.39)' }}
              >
                Yes, Delete It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Viewer Modal */}
      {evidenceModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 100000 }}>
          <button 
            onClick={() => setEvidenceModal({ isOpen: false, url: null, error: false })}
            style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}
          >
            <XCircle size={20} /> Close Preview
          </button>
          
          {!evidenceModal.error ? (
            <img 
              src={getMediaUrl(evidenceModal.url)} 
              alt="Evidence Preview" 
              style={{ maxWidth: '90%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '0.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)' }} 
              onError={() => setEvidenceModal(prev => ({ ...prev, error: true }))}
            />
          ) : (
            <div style={{ background: 'rgba(30, 32, 47, 0.9)', padding: '3rem', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center', maxWidth: '400px' }}>
              <ShieldOff size={48} color="#ef4444" style={{ marginBottom: '1.5rem', display: 'inline-block' }} />
              <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.3rem', fontWeight: 'bold' }}>Evidence Unavailable</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
                The uploaded evidence for this old report has expired and was automatically cleared by the server to save storage space. 
                <br/><br/>
                <span style={{ color: '#34d399', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <CheckCircle size={22} strokeWidth={2.5} style={{ flexShrink: 0 }} /> <span>All new reports will now have permanent evidence previews.</span>
                </span>
              </p>
            </div>
          )}
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

      {checkWorkspaceWarningModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'rgba(30, 32, 47, 0.95)', border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '1.5rem', padding: '2rem', maxWidth: '400px', width: '90%',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'modalSlideUp 0.3s ease-out'
          }}>
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <AlertTriangle size={32} color="#eab308" />
            </div>
            <h3 style={{ color: 'white', fontSize: '1.25rem', marginBottom: '1rem' }}>Notice</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              {checkWorkspaceWarningModal.message}
            </p>
            <button 
              onClick={() => setCheckWorkspaceWarningModal({ show: false, message: '' })}
              style={{
                background: '#eab308', color: 'black', border: 'none', padding: '0.75rem 2rem',
                borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer',
                transition: 'background 0.2s', width: '100%'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#facc15'}
              onMouseOut={(e) => e.currentTarget.style.background = '#eab308'}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {adminActionSuccessModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <CheckCircle size={40} color="#22c55e" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Success</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              {adminActionSuccessModal.message}
            </p>
            <button 
              onClick={() => setAdminActionSuccessModal({ show: false, message: '' })}
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', padding: '0.85rem 2rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)'; }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {bulkDeleteModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <Trash2 size={40} color="#ef4444" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>{bulkDeleteModal.title}</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>
              {bulkDeleteModal.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setBulkDeleteModal({ ...bulkDeleteModal, isOpen: false })}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.85rem 1.5rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', flex: 1, transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmBulkDelete}
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', border: 'none', padding: '0.85rem 1.5rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', flex: 1, transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)'; }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {suspensionModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
              <AlertTriangle size={40} color="#eab308" />
            </div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>Suspend Account</h3>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
              How long should this user be suspended?
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Hours</label>
                <input 
                  type="number" 
                  min="0"
                  value={suspensionModal.hours} 
                  onChange={(e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val) || val < 0) val = 0;
                    setSuspensionModal({ ...suspensionModal, hours: val });
                  }}
                  style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.8)', color: 'white', fontSize: '1.2rem', textAlign: 'center', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Minutes</label>
                <input 
                  type="number" 
                  min="0"
                  max="59"
                  value={suspensionModal.minutes} 
                  onChange={(e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val) || val < 0) val = 0;
                    setSuspensionModal({ ...suspensionModal, minutes: val });
                  }}
                  style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.8)', color: 'white', fontSize: '1.2rem', textAlign: 'center', outline: 'none' }}
                />
              </div>
            </div>
            {suspensionModal.minutes > 59 && (
              <div style={{ color: '#ef4444', fontSize: '0.95rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                Maximum allowed minutes is 59.
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setSuspensionModal({ isOpen: false, userId: null, hours: 24, minutes: 0 })}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.85rem 1.5rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', flex: 1, transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmSuspension}
                disabled={(suspensionModal.hours <= 0 && suspensionModal.minutes <= 0) || suspensionModal.minutes > 59}
                style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: 'white', border: 'none', padding: '0.85rem 1.5rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: ((suspensionModal.hours <= 0 && suspensionModal.minutes <= 0) || suspensionModal.minutes > 59) ? 'not-allowed' : 'pointer', flex: 1, transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(234, 179, 8, 0.4)', opacity: ((suspensionModal.hours <= 0 && suspensionModal.minutes <= 0) || suspensionModal.minutes > 59) ? 0.5 : 1 }}
                onMouseEnter={(e) => { if (!((suspensionModal.hours <= 0 && suspensionModal.minutes <= 0) || suspensionModal.minutes > 59)) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(234, 179, 8, 0.6)'; } }}
                onMouseLeave={(e) => { if (!((suspensionModal.hours <= 0 && suspensionModal.minutes <= 0) || suspensionModal.minutes > 59)) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(234, 179, 8, 0.4)'; } }}
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
