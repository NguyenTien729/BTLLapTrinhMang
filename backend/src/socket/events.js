const id = value => String(value?._id || value);
function publishMessage(io, conversation, event, message) {
  if (!io) return;
  io.to(conversation.members.map(member => 'user:' + id(member))).emit(event, message);
  if (event === 'message:new') for (const member of conversation.members) {
    if (id(member) !== id(message.sender)) io.to('user:' + id(member)).emit('notification:new', { conversationId: id(conversation), message });
  }
}
function publishConversation(io, conversation, previousMembers = []) {
  if (!io) return;
  const members = conversation.members.map(id);
  io.to(members.map(member => 'user:' + member)).emit('conversation:updated', conversation);
  for (const member of previousMembers.map(id).filter(member => !members.includes(member))) {
    io.in('user:' + member).socketsLeave(id(conversation));
    io.to('user:' + member).emit('conversation:removed', { conversationId: id(conversation) });
  }
}
module.exports = { publishMessage, publishConversation };
