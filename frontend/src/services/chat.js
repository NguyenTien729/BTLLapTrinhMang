export const idOf = value => String(value?._id || value?.id || value || '');
export const toUser = user => ({ ...user, id:idOf(user), name:user.displayName || user.username, online:!!user.isOnline });
export const toMessage = message => ({
  ...message, id:idOf(message), sender:idOf(message.sender), time:message.createdAt || message.time,
  files:(message.attachments || []).map(file=>({ ...file, name:file.fileName, type:file.mimeType, size:file.fileSize, data:file.url })),
  file:message.attachments?.[0] ? { ...message.attachments[0], name:message.attachments[0].fileName, type:message.attachments[0].mimeType, size:message.attachments[0].fileSize, data:message.attachments[0].url } : null,
  replyTo:message.replyTo ? { ...message.replyTo, id:idOf(message.replyTo), text:message.replyTo.isRecall ? 'Tin nhắn đã bị thu hồi' : message.replyTo.text } : null,
});
export const toConversation = (conversation, previous) => ({
  ...conversation, id:idOf(conversation), members:conversation.members.map(idOf), admin:idOf(conversation.admin),
  messages:previous?.messages || (conversation.lastMessage ? [toMessage(conversation.lastMessage)] : []),
  page:previous?.page || 0, totalPages:previous?.totalPages || 0,
  unread:conversation.unread ?? previous?.unread ?? 0,
});
export function mergeMessages(current, incoming) {
  const messages = new Map(current.map(message=>[message.id,message]));
  for (const message of incoming) {
    if (message.pending && [...messages.values()].some(old=>!old.pending && old.sender===message.sender && old.clientTempId===message.clientTempId)) continue;
    if (message.clientTempId) for (const [id,old] of messages) {
      if (old.pending && old.sender === message.sender && old.clientTempId === message.clientTempId) messages.delete(id);
    }
    messages.set(message.id,message);
  }
  return [...messages.values()].sort((a,b)=>new Date(a.time)-new Date(b.time) || a.id.localeCompare(b.id));
}
