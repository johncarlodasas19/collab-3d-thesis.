const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const Report = require('../models/Report');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Protect all admin routes
router.use(authMiddleware, adminMiddleware);

// ---------------------------
// System Statistics
// ---------------------------
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeProjects = await Project.countDocuments({ isDeleted: false });
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const totalDeletedProjects = await Project.countDocuments({ isDeleted: true });

    res.json({ totalUsers, activeProjects, pendingReports, totalDeletedProjects });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats', error: err.message });
  }
});

// ---------------------------
// User Management
// ---------------------------
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    
    // Prevent admin from removing their own role
    if (req.params.id === req.user.userId && role === 'user') {
      return res.status(400).json({ message: 'You cannot remove your own admin role.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    
    // Generate new token with updated role
    const newToken = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    // Emit real-time role change to seamlessly switch UI without forcing logout
    if (req.app.get('io')) {
      req.app.get('io').emit('user-role-changed', { 
        userId: req.params.id, 
        role, 
        newToken, 
        user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role, status: user.status } 
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating role', error: err.message });
  }
});

router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    // Prevent admin from banning themselves
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ message: 'You cannot suspend or ban yourself.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
    
    // Emit real-time status change to force kick users
    if (req.app.get('io') && (status === 'banned' || status === 'suspended')) {
      req.app.get('io').emit('user-status-changed', { userId: req.params.id, status });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating status', error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Delete all projects owned by this user
    await Project.deleteMany({ owner: req.params.id });
    
    // Remove this user from collaborators arrays in other people's projects
    await Project.updateMany(
      { collaborators: req.params.id },
      { $pull: { collaborators: req.params.id } }
    );
    
    // Create activity log
    await ActivityLog.create({
      userId: req.user.userId,
      username: req.user.username,
      action: 'Deleted User',
      details: `Deleted user: ${user.username} (${user.email})`
    });

    // If user is currently online, emit a status change to kick them
    if (req.app.get('io')) {
      req.app.get('io').emit('user-status-changed', { userId: req.params.id, status: 'deleted' });
    }

    res.json({ message: 'User deleted successfully', user });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

// ---------------------------
// Report Management
// ---------------------------
router.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reports', error: err.message });
  }
});

router.put('/reports/:id/resolve', async (req, res) => {
  try {
    const { status } = req.body; // 'resolved' or 'dismissed'
    if (!['resolved', 'dismissed'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const report = await Report.findByIdAndUpdate(req.params.id, { status, resolvedAt: Date.now() }, { new: true });
    
    await ActivityLog.create({
      userId: req.user.userId,
      username: req.user.username,
      action: `Report ${status}`,
      details: `Report ID: ${report._id}`
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Error resolving report', error: err.message });
  }
});

// Admin can force delete a project
router.delete('/projects/:id/force', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    
    await ActivityLog.create({
      userId: req.user.userId,
      username: req.user.username,
      action: 'Force Deleted Project',
      details: `Project ID: ${req.params.id}`
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('project-deleted-by-admin', { projectId: req.params.id });
    }

    res.json({ message: 'Project permanently deleted by Admin.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting project', error: err.message });
  }
});

// ---------------------------
// Activity Logs
// ---------------------------
router.get('/activity', async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(2000);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching activity logs', error: err.message });
  }
});

router.delete('/reports/cleanup', async (req, res) => {
  try {
    await Report.deleteMany({ status: { $in: ['resolved', 'dismissed'] } });
    
    await ActivityLog.create({
      userId: req.user.userId,
      username: req.user.username,
      action: 'Cleared Resolved Reports',
      details: 'Deleted all resolved and dismissed reports.'
    });

    res.json({ message: 'Resolved reports cleared.' });
  } catch (err) {
    res.status(500).json({ message: 'Error cleaning reports', error: err.message });
  }
});

router.delete('/activity/cleanup', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await ActivityLog.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });

    await ActivityLog.create({
      userId: req.user.userId,
      username: req.user.username,
      action: 'Cleared Old Activity Logs',
      details: 'Deleted logs older than 30 days.'
    });

    res.json({ message: 'Old activity logs cleared.' });
  } catch (err) {
    res.status(500).json({ message: 'Error cleaning activity logs', error: err.message });
  }
});

module.exports = router;
