require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8, // 100 MB limit
  pingInterval: 5000, // Check for connection every 5 seconds
  pingTimeout: 5000 // Disconnect if no response within 5 seconds
});
app.set('io', io);

const PORT = process.env.PORT || 5000;

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

app.post('/api/upload', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Socket.IO real-time collaboration
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, user }) => {
    socket.join(roomId);
    
    // Assign a random color if not present
    const color = user.color || `hsl(${Math.floor(Math.random() * 360)}, 70%, 75%)`;
    const userData = { ...user, color, socketId: socket.id };
    
    activeUsers.set(socket.id, { roomId, user: userData });
    
    console.log(`User ${user.username} (${socket.id}) joined room: ${roomId}`);
    
    // Broadcast to others that this user joined
    socket.to(roomId).emit('user-joined', userData);
    
    // Send current active users in this room to everyone
    const usersInRoom = Array.from(activeUsers.values())
      .filter(u => u.roomId === roomId)
      .map(u => u.user);
    io.to(roomId).emit('active-users', usersInRoom);
  });

  socket.on('cursor-move', (data) => {
    socket.to(data.roomId).emit('cursor-move', { ...data, socketId: socket.id });
  });

  socket.on('object-added', (data) => {
    socket.to(data.roomId).emit('object-added', data.object);
  });

  socket.on('object-transformed', (data) => {
    socket.to(data.roomId).emit('object-transformed', data.transformData);
  });

  socket.on('object-deleted', (data) => {
    socket.to(data.roomId).emit('object-deleted', data);
  });

  socket.on('workspace-state-sync', (data) => {
    socket.to(data.roomId).emit('workspace-state-sync', data.objects);
    if (data.username) {
      socket.to(data.roomId).emit('toast-notification', {
        message: `${data.username} performed an Undo.`,
        type: 'info',
        username: data.username,
        color: '#3b82f6'
      });
    }
  });

  socket.on('project-renamed', (data) => {
    socket.to(data.roomId).emit('project-renamed', data.newName);
  });

  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('typing', data);
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.roomId).emit('stop-typing', data);
  });

  socket.on('chat-message', async (data) => {
    io.to(data.roomId).emit('chat-message', data);
    try {
      const Project = require('./models/Project');
      await Project.findByIdAndUpdate(data.roomId, {
        $push: { 'data.chatMessages': data }
      });
    } catch (err) {
      console.error('Error saving chat message:', err);
    }
  });

  socket.on('edit-message', async ({ roomId, messageId, newText }) => {
    try {
      const Project = require('./models/Project');
      const project = await Project.findById(roomId);
      if (project && project.data && project.data.chatMessages) {
        const msg = project.data.chatMessages.find(m => m.id === messageId || m.timestamp === messageId || m.message === messageId);
        const socketData = activeUsers.get(socket.id);
        const currentUser = socketData ? socketData.user : null;
        
        if (msg && currentUser && (msg.user.id === currentUser.id || msg.user._id === currentUser._id || msg.user._id === currentUser.id || msg.user.id === currentUser._id)) {
          msg.message = newText;
          project.markModified('data.chatMessages');
          await project.save();
          io.to(roomId).emit('message-edited', { messageId, newText });
        }
      }
    } catch (err) {
      console.error('Error editing chat message:', err);
    }
  });

  socket.on('delete-message', async ({ roomId, messageId }) => {
    try {
      const Project = require('./models/Project');
      const project = await Project.findById(roomId);
      if (project && project.data && project.data.chatMessages) {
        const msg = project.data.chatMessages.find(m => m.id === messageId || m.timestamp === messageId || m.message === messageId);
        const socketData = activeUsers.get(socket.id);
        const currentUser = socketData ? socketData.user : null;
        
        if (msg && currentUser && (msg.user.id === currentUser.id || msg.user._id === currentUser._id || msg.user._id === currentUser.id || msg.user.id === currentUser._id)) {
          msg.isUnsent = true;
          msg.message = "This message was unsent.";
          msg.fileUrl = null;
          msg.type = 'text';
          project.markModified('data.chatMessages');
          await project.save();
          io.to(roomId).emit('message-unsent', { messageId: msg.id || msg.timestamp || msg.message, message: msg.message });
        }
      }
    } catch (err) {
      console.error('Error deleting chat message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const data = activeUsers.get(socket.id);
    if (data) {
      activeUsers.delete(socket.id);
      socket.to(data.roomId).emit('user-left', { socketId: socket.id, user: data.user });
      
      const usersInRoom = Array.from(activeUsers.values())
        .filter(u => u.roomId === data.roomId)
        .map(u => u.user);
      io.to(data.roomId).emit('active-users', usersInRoom);
    }
  });
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/3d-saas')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
