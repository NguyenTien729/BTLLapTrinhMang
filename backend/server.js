require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const initSocketIO = require('./src/socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.IO
  const io = initSocketIO(server);
  app.set('io', io);

  // Start listening
  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` PTITChat Backend Server running on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`===============================================`);
  });

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('\nShutting down server gracefully...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
};

// Start the application if executed directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer };

