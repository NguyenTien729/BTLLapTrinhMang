const User = require('../models/User');

const onlineUsers = new Map(); // userId -> Set of socketIds

const initPresenceSocket = (io, socket) => {
  const user = socket.user;
  if (!user) return;

  const userId = user._id.toString();

  // Track socket connection
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // Mark user online in DB
  User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() }).catch(
    (err) => console.error('[Presence] Error marking online:', err.message)
  );

  // Broadcast user online status
  io.emit('user_online', {
    userId,
    isOnline: true
  });

  socket.on('disconnect', async () => {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen
        }).catch((err) =>
          console.error('[Presence] Error marking offline:', err.message)
        );

        io.emit('user_offline', {
          userId,
          isOnline: false,
          lastSeen
        });
      }
    }
  });
};

module.exports = {
  initPresenceSocket,
  onlineUsers
};

