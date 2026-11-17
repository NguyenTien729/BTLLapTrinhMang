require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const initSocketIO = require('./src/socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);

  // Khởi tạo Socket.IO (đã bao gồm xác thực JWT + CORS + presence + chat).
  const io = initSocketIO(server);

  // Cho phép controller REST phát sự kiện realtime khi cần (vd: tạo nhóm mới).
  app.set('io', io);

  server.listen(PORT, () => {
    console.log('===============================================');
    console.log(` PTITChat Backend + Socket.IO : cổng ${PORT}`);
    console.log(` Health check : http://localhost:${PORT}/api/health`);
    console.log(` Socket.IO    : ws://localhost:${PORT}`);
    console.log(` Môi trường   : ${process.env.NODE_ENV || 'development'}`);
    console.log('===============================================');
  });

  const gracefulShutdown = (signal) => {
    console.log(`\n[Server] Nhận ${signal}, đang đóng kết nối...`);
    io.close(() => {
      server.close(() => {
        console.log('[Server] Đã dừng.');
        process.exit(0);
      });
    });
    // Không để tiến trình treo mãi nếu client không đóng.
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  return { server, io };
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('[Server] Không thể khởi động:', error.message);
    process.exit(1);
  });
}

module.exports = { startServer };
