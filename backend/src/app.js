const express = require('express');
const cors = require('cors');
const path = require('path');
<<<<<<< HEAD
=======

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const { updateMe } = require('./controllers/userController');
const { protect } = require('./middleware/authMiddleware');

>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
const app = express();

// Middlewares
app.disable('x-powered-by');
<<<<<<< HEAD
app.use(cors({ origin: require('./config/origins')() }));
app.use(express.json({ limit: '16kb' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); } }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', message: 'PTITChat Backend API is running', timestamp: new Date() }));
app.use('/api/conversations', require('./routes/conversationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use((_req, res) => res.status(404).json({ message: 'API không tồn tại.' }));
app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ message: 'Email đã được sử dụng.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors).map(item => item.message).join(' ') });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON không hợp lệ.' });
  if (error.status === 413) return res.status(413).json({ message: 'Dữ liệu quá lớn.' });
  if (error.name === 'CastError') return res.status(400).json({ message: 'ID không hợp lệ.' });
  if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ message: error.message });
  console.error(error);
  res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
=======
app.use(
  cors({
    origin: process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'PTITChat Backend API is running',
    timestamp: new Date()
  });
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
});

// Mount API routes
app.patch('/api/me', protect, updateMe);
app.get('/api/me', protect, (req, res) => res.json({ success: true, user: req.user, data: req.user }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn không tồn tại: ${req.method} ${req.originalUrl}`
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Dữ liệu đã tồn tại trong hệ thống.' });
  }
  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map((item) => item.message).join(' ');
    return res.status(400).json({ success: false, message: msg });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'JSON không hợp lệ.' });
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Lỗi hệ thống máy chủ',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
