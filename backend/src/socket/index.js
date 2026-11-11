const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const initChatSocket = require('./chatSocket');
const { initPresenceSocket } = require('./presenceSocket');

const initSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true
    }
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/, '') ||
        socket.handshake.query?.token;

      if (!token) {
        // Allow unauthenticated connection or reject:
        // We reject if strict auth is required
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'ptitchat_secret_key_2026'
      );

      const user = await User.findById(decoded.id || decoded.userId).select(
        '_id username displayName avatar email'
      );

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.user?.username} (${socket.id})`);

    // Attach modules
    initChatSocket(io, socket);
    initPresenceSocket(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

module.exports = initSocketIO;

