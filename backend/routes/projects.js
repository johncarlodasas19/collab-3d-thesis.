const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all project routes
router.use(authMiddleware);

// Get all projects for the logged-in user (owned and collaborated)
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ 
      $and: [
        { $or: [{ owner: req.user.userId }, { collaborators: req.user.userId }] },
        { isDeleted: { $ne: true } }
      ]
    }).sort({ updatedAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching projects', error: err.message });
  }
});

// Create a new project
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const newProject = new Project({
      name: name || 'Untitled Project',
      owner: req.user.userId,
      data: { objects: [] }
    });
    await newProject.save();
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ message: 'Error creating project', error: err.message });
  }
});

// Get trashed projects
router.get('/trash', async (req, res) => {
  try {
    const projects = await Project.find({ 
      owner: req.user.userId,
      isDeleted: true
    }).sort({ updatedAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trash', error: err.message });
  }
});

// Get a specific project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Allow access if owner, collaborator, or admin
    const isOwner = project.owner.toString() === req.user.userId;
    const isCollaborator = project.collaborators && project.collaborators.some(id => id.toString() === req.user.userId);
    const isAdmin = req.user.role === 'admin';

    // Auto-Join via Link: If they have the link and are logged in, add them as a collaborator!
    if (!isOwner && !isCollaborator && !isAdmin) {
      if (!project.collaborators) project.collaborators = [];
      project.collaborators.push(req.user.userId);
      await project.save();
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching project', error: err.message });
  }
});

const nodemailer = require('nodemailer');

// Update project state or name
router.put('/:id', async (req, res) => {
  try {
    const { data, name } = req.body;
    let updateFields = { updatedAt: Date.now() };
    if (data) updateFields.data = data;
    if (name) updateFields.name = name;

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.userId },
      updateFields,
      { new: true }
    );
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: 'Error saving project', error: err.message });
  }
});

// Invite user to project via email
router.post('/:id/invite', async (req, res) => {
  try {
    const { email, projectUrl } = req.body;
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.userId });
    
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!email) return res.status(400).json({ message: 'Email address is required' });

    // Check if user exists to send in-app notification
    const targetUser = await User.findOne({ email });
    if (targetUser && targetUser._id.toString() !== req.user.userId) {
      // Check if they are already a collaborator
      const isCollaborator = project.collaborators && project.collaborators.some(id => id.toString() === targetUser._id.toString());
      
      // Check if they already have a pending invite
      const hasInvite = targetUser.invitations.some(inv => inv.projectId.toString() === project._id.toString());
      
      if (!isCollaborator && !hasInvite) {
        targetUser.invitations.push({
          projectId: project._id,
          projectName: project.name,
          senderName: req.user.username
        });
        await targetUser.save();
      }
    }

    let transporter;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Use real SMTP (e.g., Gmail)
      transporter = nodemailer.createTransport({
        service: 'gmail', // You can change this if using Outlook/SendGrid
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Generate test SMTP service account from ethereal.email if no credentials provided
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, 
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"3D Workspace" <no-reply@3dworkspace.com>`,
      to: email,
      subject: `You're invited to collaborate on "${project.name}"!`,
      text: `Hello! You've been invited by ${req.user.username} to collaborate on the 3D project "${project.name}". Join here: ${projectUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #4f46e5; margin-top: 0;">Collaboration Invitation</h2>
          <p>Hello!</p>
          <p>You have been invited by <strong>${req.user.username}</strong> to collaborate on the 3D project <strong>"${project.name}"</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="${projectUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Join Workspace Now
            </a>
          </div>
          <p style="font-size: 12px; color: #777;">If the button doesn't work, copy and paste this link: <br/> <a href="${projectUrl}">${projectUrl}</a></p>
        </div>
      `,
    });

    // Get the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);

    res.json({ 
      message: 'Invitation sent successfully!', 
      previewUrl 
    });

  } catch (err) {
    console.error("Email Error:", err);
    res.status(500).json({ message: 'Error sending invitation', error: err.message });
  }
});

// Soft delete a project (move to trash)
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.userId },
      { isDeleted: true, updatedAt: Date.now() },
      { new: true }
    );
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project moved to trash' });
  } catch (err) {
    res.status(500).json({ message: 'Error moving to trash', error: err.message });
  }
});

// Restore a project from trash
router.put('/:id/restore', async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.userId },
      { isDeleted: false, updatedAt: Date.now() },
      { new: true }
    );
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project restored', project });
  } catch (err) {
    res.status(500).json({ message: 'Error restoring project', error: err.message });
  }
});

// Permanently delete a project
router.delete('/:id/permanent', async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user.userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or you are not the owner' });
    }
    
    // Also remove any pending invitations to this project
    await User.updateMany(
      { 'invitations.projectId': req.params.id },
      { $pull: { invitations: { projectId: req.params.id } } }
    );

    res.json({ message: 'Project deleted permanently' });
  } catch (err) {
    res.status(500).json({ message: 'Error permanently deleting project', error: err.message });
  }
});

module.exports = router;
