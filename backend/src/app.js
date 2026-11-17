const express = require('express');
const cors = require('cors');
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '16kb' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use((_req, res) => res.status(404).json({ message: 'API không tồn tại.' }));
app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ message: 'Email đã được sử dụng.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors).map(item => item.message).join(' ') });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON không hợp lệ.' });
  if (error.status === 413) return res.status(413).json({ message: 'Dữ liệu quá lớn.' });
  console.error(error);
  res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
});
module.exports = app;
