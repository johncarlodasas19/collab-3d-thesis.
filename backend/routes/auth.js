const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, adminSecretCode } = req.body;
    
    let assignedRole = 'user';
    if (role === 'admin') {
      if (adminSecretCode !== (process.env.ADMIN_SECRET_CODE || 'SECRET_ADMIN_123')) {
        return res.status(403).json({ message: 'Invalid Admin Passcode' });
      }
      assignedRole = 'admin';
    }
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ username, email, password, role: assignedRole });
    await user.save();

    res.status(201).json({ message: 'User registered successfully', role: assignedRole });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ message: 'Your account has been permanently banned.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Your account is temporarily suspended. Please contact support.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    res.json({ token, user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role, status: user.status } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const authMiddleware = require('../middleware/authMiddleware');
const Project = require('../models/Project');

// Get user invitations
router.get('/invitations', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json(user.invitations || []);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invitations', error: error.message });
  }
});

// Accept invitation
router.post('/invitations/:projectId/accept', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const user = await User.findById(req.user.userId);
    const project = await Project.findById(projectId);

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Remove invitation from user
    user.invitations = user.invitations.filter(inv => inv.projectId.toString() !== projectId);
    await user.save();

    // Add user to project collaborators if not already there
    if (!project.collaborators.some(id => id.toString() === user._id.toString())) {
      project.collaborators.push(user._id);
      await project.save();
    }

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting invitation', error: error.message });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, email, avatarUrl, password } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if new username or email already exists for a DIFFERENT user
    const orQuery = [];
    if (username && username.trim() !== '') orQuery.push({ username });
    if (email && email.trim() !== '') orQuery.push({ email });

    if (orQuery.length > 0) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: req.user.userId } },
          { $or: orQuery }
        ]
      });
      
      if (existingUser) {
        if (username && existingUser.username === username) return res.status(400).json({ message: 'Username already taken' });
        if (email && existingUser.email === email) return res.status(400).json({ message: 'Email already in use' });
      }
    }

    if (username && username.trim() !== '') user.username = username;
    if (email && email.trim() !== '') user.email = email;
    if (avatarUrl !== undefined && avatarUrl !== '') user.avatarUrl = avatarUrl;
    if (password && password.trim() !== '') user.password = password;

    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    res.json({ 
      message: 'Profile updated successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role, status: user.status } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});
// Forgot Password (Mock Flow)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    // Generate a temporary 6-digit password
    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
    user.password = tempPassword;
    await user.save();

    res.json({ 
      message: 'Please enter this as your new password.', 
      tempPassword 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing forgot password', error: error.message });
  }
});
// Delete own account
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    const io = req.app.get('io');
    if (io) {
      io.emit('user-status-changed', { userId: userId, status: 'self-deleted' });
    }
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting account', error: error.message });
  }
});

module.exports = router;
