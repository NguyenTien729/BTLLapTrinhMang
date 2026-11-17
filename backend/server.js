const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const initSocketIO = require('./src/socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Kết nối Database
    await connectDB();

    // 2. Tạo HTTP server
    const server = http.createServer(app);

    // 3. Khởi tạo Socket.IO thời gian thực
    const io = initSocketIO(server);
    app.set('io', io);

    // 4. Bắt đầu lắng nghe kết nối
    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 PTITChat Server đang chạy tại cổng ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
      console.log(`⚡ Socket.IO : Sẵn sàng đón kết nối`);
      console.log(`🌐 Môi trường: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================================`);
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('\nĐang dừng server an toàn...');
      server.close(() => {
        console.log('Server đã dừng.');
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    console.error('Lỗi khởi động server:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
