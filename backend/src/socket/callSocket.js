/**
 * WebRTC 1-1 and Group Audio / Video Call Signaling Module over Socket.IO
 * Facilitates 1-1 direct calling and Mesh WebRTC group calling with SDP Offer/Answer negotiation.
 */

// In-memory registry of active group calls:
// conversationId -> Map(userId -> { userId, socketId, name, avatar, isVideo })
const activeGroupCalls = new Map();

const initCallSocket = (io, socket) => {
  const userId = socket.userId || socket.user?._id?.toString();

  /* ===================== 1-1 DIRECT CALL SIGNALING ===================== */

  // 1. Caller initiates a 1-1 call: relays offer to recipient's private user room
  socket.on('call:start', (data) => {
    const { recipientId, conversationId, offer, isVideo, callerName, callerAvatar } = data || {};
    if (!recipientId || !offer) return;

    io.to('user:' + recipientId).emit('call:incoming', {
      callerId: userId,
      callerName: callerName || socket.user?.displayName || socket.user?.username || 'Thành viên PTITChat',
      callerAvatar: callerAvatar || socket.user?.avatar,
      conversationId,
      offer,
      isVideo: !!isVideo
    });
  });

  // 2. Callee accepts 1-1 call: relays answer back to caller
  socket.on('call:accept', (data) => {
    const { callerId, answer } = data || {};
    if (!callerId || !answer) return;

    io.to('user:' + callerId).emit('call:accepted', {
      calleeId: userId,
      answer
    });
  });

  // 3. Exchange ICE Candidates for 1-1 call
  socket.on('call:ice-candidate', (data) => {
    const { targetUserId, candidate } = data || {};
    if (!targetUserId || !candidate) return;

    io.to('user:' + targetUserId).emit('call:ice-candidate', {
      senderId: userId,
      candidate
    });
  });

  // 4. Callee rejects 1-1 call
  socket.on('call:reject', (data) => {
    const { callerId, reason } = data || {};
    if (!callerId) return;

    io.to('user:' + callerId).emit('call:rejected', {
      calleeId: userId,
      reason: reason || 'Cuộc gọi đã bị từ chối'
    });
  });

  // 5. Either party ends 1-1 call
  socket.on('call:end', (data) => {
    const { targetUserId } = data || {};
    if (!targetUserId) return;

    io.to('user:' + targetUserId).emit('call:ended', {
      endedBy: userId
    });
  });

  /* ===================== GROUP MESH CALL SIGNALING ===================== */

  // 6. Join or start a group call in conversation
  socket.on('group-call:join', (data) => {
    const { conversationId, isVideo, groupName } = data || {};
    if (!conversationId) return;

    const convId = conversationId.toString();
    if (!activeGroupCalls.has(convId)) {
      activeGroupCalls.set(convId, new Map());
    }

    const room = activeGroupCalls.get(convId);
    const userInfo = {
      userId,
      socketId: socket.id,
      name: socket.user?.displayName || socket.user?.username || 'Thành viên',
      avatar: socket.user?.avatar,
      isVideo: !!isVideo
    };

    // Existing participants before this user joined
    const existingParticipants = Array.from(room.values()).filter(p => p.userId !== userId);

    room.set(userId, userInfo);
    socket.join('call:' + convId);

    // Send back existing participants to newcomer so they can initiate peer connections
    socket.emit('group-call:existing-users', {
      conversationId: convId,
      participants: existingParticipants
    });

    // Notify other participants in the call room
    socket.to('call:' + convId).emit('group-call:user-joined', {
      user: userInfo
    });

    // Broadcast ring / active notification to the whole conversation room
    io.to(convId).emit('group-call:ring', {
      conversationId: convId,
      callerId: userId,
      callerName: userInfo.name,
      callerAvatar: userInfo.avatar,
      groupName: groupName || 'Nhóm học tập',
      isVideo: !!isVideo,
      participantCount: room.size
    });
  });

  // 7. Relay peer-to-peer WebRTC signals (Offer, Answer, ICE Candidates)
  socket.on('group-call:signal', (data) => {
    const { conversationId, toUserId, signal } = data || {};
    if (!toUserId || !signal) return;

    io.to('user:' + toUserId).emit('group-call:signal', {
      conversationId,
      fromUserId: userId,
      signal
    });
  });

  // 8. Leave group call
  const leaveGroupCall = (convId) => {
    if (!convId || !activeGroupCalls.has(convId)) return;
    const room = activeGroupCalls.get(convId);
    if (!room.has(userId)) return;

    room.delete(userId);
    socket.leave('call:' + convId);

    // Notify remaining participants
    io.to('call:' + convId).emit('group-call:user-left', {
      userId,
      participantCount: room.size
    });

    if (room.size === 0) {
      activeGroupCalls.delete(convId);
      io.to(convId).emit('group-call:ended', { conversationId: convId });
    } else {
      io.to(convId).emit('group-call:updated', {
        conversationId: convId,
        participantCount: room.size
      });
    }
  };

  socket.on('group-call:leave', (data) => {
    leaveGroupCall(data?.conversationId?.toString());
  });

  // 9. Clean up on socket disconnect
  socket.on('disconnect', () => {
    for (const [convId, room] of activeGroupCalls.entries()) {
      if (room.has(userId)) {
        leaveGroupCall(convId);
      }
    }
  });
};

module.exports = initCallSocket;
