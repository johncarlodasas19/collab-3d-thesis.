const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const crypto = require('crypto');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '794547424764-vn9qg94v80pog8odcr4b7kfgotpg5oha.apps.googleusercontent.com');

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
      if (user.suspensionEnd && Date.now() > user.suspensionEnd) {
        user.status = 'active';
        user.suspensionEnd = null;
        await user.save();
      } else {
        const timeStr = user.suspensionEnd ? new Date(user.suspensionEnd).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'an indefinite time';
        return res.status(403).json({ message: `Your account is temporarily suspended until ${timeStr}.` });
      }
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

// Google Login / Register
router.post('/google', async (req, res) => {
  try {
    const { token, role, adminSecretCode } = req.body;
    
    // Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID || '794547424764-vn9qg94v80pog8odcr4b7kfgotpg5oha.apps.googleusercontent.com',
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (user) {
      if (user.status === 'banned') {
        return res.status(403).json({ message: 'Your account has been banned by an administrator.' });
      }
      if (user.status === 'suspended') {
        if (user.suspensionEnd && Date.now() > user.suspensionEnd) {
          user.status = 'active';
          user.suspensionEnd = null;
          await user.save();
        } else {
          const timeStr = user.suspensionEnd ? new Date(user.suspensionEnd).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'an indefinite time';
          return res.status(403).json({ message: `Your account is temporarily suspended until ${timeStr}.` });
        }
      }

      // User exists, log them in
      const jwtToken = jwt.sign(
        { userId: user._id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'fallback_secret_key',
        { expiresIn: '1d' }
      );
      return res.json({ token: jwtToken, user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role, status: user.status } });
    }

    // User doesn't exist, register them
    let assignedRole = 'user';
    if (role === 'admin') {
      if (adminSecretCode !== (process.env.ADMIN_SECRET_CODE || 'SECRET_ADMIN_123')) {
        return res.status(403).json({ message: 'Invalid Admin Passcode' });
      }
      assignedRole = 'admin';
    }

    // Generate a random secure password for Google users
    const randomPassword = crypto.randomBytes(16).toString('hex');
    
    // Check if username (from Google name) already exists
    let finalUsername = name;
    let usernameExists = await User.findOne({ username: finalUsername });
    if (usernameExists) {
      finalUsername = `${name}_${crypto.randomBytes(4).toString('hex')}`;
    }

    user = new User({ 
      username: finalUsername, 
      email, 
      password: randomPassword, 
      role: assignedRole,
      avatarUrl: picture
    });
    await user.save();

    const jwtToken = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );
    res.status(201).json({ token: jwtToken, user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role, status: user.status } });
  } catch (error) {
    res.status(500).json({ message: 'Google Authentication failed', error: error.message });
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
    
    // Delete all projects owned by this user
    await Project.deleteMany({ owner: userId });
    
    // Remove this user from collaborators arrays in other people's projects
    await Project.updateMany(
      { collaborators: userId },
      { $pull: { collaborators: userId } }
    );
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
