// Báo cho các thành viên còn lại biết có tin nhắn mới.
// Gửi vào room riêng "user:<id>" nên mọi tab của người nhận đều thấy,
// kể cả khi họ không mở đúng hội thoại đó.
const notifyNewMessage = (io, conversation, message, senderSocketId) => {
  const sender = message.sender?._id
    ? message.sender._id.toString()
    : message.sender.toString();

  for (const member of conversation.members) {
    const memberId = member.toString();
    if (memberId === sender) continue; // không thông báo cho chính người gửi

    io.to('user:' + memberId)
      .except(senderSocketId)
      .emit('notification:new', {
        conversationId: conversation._id.toString(),
        message
      });
  }
};

module.exports = { notifyNewMessage };
