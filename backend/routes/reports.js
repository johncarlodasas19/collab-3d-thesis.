const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Project = require('../models/Project');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Submit a new report for inappropriate content
router.post('/', async (req, res) => {
  try {
    const { reportedProjectId, reason, proofUrl } = req.body;
    
    if (!reason || !reportedProjectId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const project = await Project.findById(reportedProjectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const newReport = new Report({
      reporterId: req.user.userId,
      reporterName: req.user.username,
      reportedProjectId: project._id,
      reportedProjectName: project.name,
      reason,
      proofUrl: proofUrl || null
    });

    await newReport.save();

    await ActivityLog.create({
      userId: req.user.userId,
      username: req.user.username,
      action: 'Reported Content',
      details: `Reported Project: ${project.name}`
    });

    res.status(201).json(newReport);
  } catch (err) {
    res.status(500).json({ message: 'Error submitting report', error: err.message });
  }
});

module.exports = router;
