import React, { useState, useEffect, useRef } from 'react';
import { request, authenticate, getToken, logout } from './services/api';
import {
  connect,
  disconnect,
  getSocket,
  joinConversation,
  leaveConversation,
  sendMessage,
  editMessage,
  revokeMessage,
  startTyping,
  stopTyping
} from './services/socket';

const PRESET_ACCOUNTS = [
  { username: 'ngotung05', label: 'Tùng (Nhóm trưởng)', role: 'Backend Leader' },
  { username: 'nguyentien05', label: 'Tiến', role: 'Auth / Frontend API' },
  { username: 'hoangson05', label: 'Sơn', role: 'Frontend UI' },
  { username: 'tranninh05', label: 'Ninh', role: 'Socket.IO Realtime' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('password123');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Chat states
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Check saved session on load
  useEffect(() => {
    const token = getToken();
    if (token) {
      request('/users/me')
        .then((res) => {
          const user = res.user || res.data;
          setCurrentUser(user);
          initSocket(token);
        })
        .catch(() => {
          logout();
          setCurrentUser(null);
        });
    }
  }, []);

  // Fetch initial conversations and users list once logged in
  useEffect(() => {
    if (currentUser) {
      loadConversations();
      loadUsers();
    }
  }, [currentUser]);

  // Handle active conversation change
  useEffect(() => {
    if (!activeConv) return;
    joinConversation(activeConv._id);
    loadMessages(activeConv._id);

    return () => {
      leaveConversation(activeConv._id);
    };
  }, [activeConv?._id]);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Setup Socket Listeners
  const initSocket = (token) => {
    const s = connect(token);
    if (!s) return;

    s.off('message:new');
    s.off('message:edited');
    s.off('message:revoked');
    s.off('typing:update');
    s.off('conversation:created');

    s.on('message:new', (newMsg) => {
      setMessages((prev) => {
        // Tránh trùng nếu tin nhắn đã có
        if (prev.some((m) => m._id === newMsg._id || (m.clientTempId && m.clientTempId === newMsg.clientTempId))) {
          return prev.map((m) => (m.clientTempId && m.clientTempId === newMsg.clientTempId ? newMsg : m));
        }
        return [...prev, newMsg];
      });

      // Cập nhật lastMessage ở danh sách cuộc trò chuyện
      setConversations((prev) =>
        prev.map((c) =>
          c._id === newMsg.conversation
            ? { ...c, lastMessage: newMsg, updatedAt: new Date().toISOString() }
            : c
        )
      );
    });

    s.on('message:edited', (editedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === editedMsg._id ? { ...m, ...editedMsg } : m))
      );
    });

    s.on('message:revoked', (revokedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === revokedMsg._id ? { ...m, ...revokedMsg, isRecall: true, text: 'Tin nhắn đã bị thu hồi' } : m))
      );
    });

    s.on('typing:update', ({ conversationId, userId, isTyping }) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        if (!copy[conversationId]) copy[conversationId] = {};
        if (isTyping) {
          copy[conversationId][userId] = true;
        } else {
          delete copy[conversationId][userId];
        }
        return copy;
      });
    });

    s.on('conversation:created', (newConv) => {
      setConversations((prev) => [newConv, ...prev.filter((c) => c._id !== newConv._id)]);
    });
  };

  const handleLogin = async (username, password) => {
    try {
      setLoadingAuth(true);
      setAuthError('');
      const user = await authenticate('login', { username, password });
      setCurrentUser(user);
      const token = getToken();
      initSocket(token);
    } catch (err) {
      setAuthError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = () => {
    disconnect();
    logout();
    setCurrentUser(null);
    setActiveConv(null);
    setConversations([]);
    setMessages([]);
  };

  const loadConversations = async () => {
    try {
      const res = await request('/conversations');
      const list = res.data || [];
      setConversations(list);
      if (list.length > 0 && !activeConv) {
        setActiveConv(list[0]);
      }
    } catch (err) {
      console.error('Lỗi tải cuộc trò chuyện:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await request('/users');
      setAllUsers(res.users || res.data || []);
    } catch (err) {
      console.error('Lỗi tải người dùng:', err);
    }
  };

  const loadMessages = async (convId) => {
    try {
      const res = await request(`/messages/${convId}`);
      const data = res.data?.messages || res.data || [];
      // Sắp xếp tin nhắn theo thời gian tăng dần
      setMessages([...data].reverse());
    } catch (err) {
      console.error('Lỗi tải tin nhắn:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !activeConv) return;

    const textToSend = inputMessage.trim();
    setInputMessage('');
    stopTyping(activeConv._id);

    try {
      // Gửi qua socket service
      await sendMessage({
        conversationId: activeConv._id,
        text: textToSend
      });
    } catch (err) {
      console.error('Lỗi gửi tin nhắn qua socket, fallback REST:', err);
      // Fallback gửi qua REST API của Tùng
      try {
        const res = await request('/messages', {
          method: 'POST',
          body: {
            conversationId: activeConv._id,
            text: textToSend
          }
        });
        if (res.data) {
          setMessages((prev) => [...prev, res.data]);
        }
      } catch (restErr) {
        alert('Gửi tin nhắn thất bại: ' + restErr.message);
      }
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (!activeConv) return;

    startTyping(activeConv._id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConv._id);
    }, 2000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('files', file);

      const token = getToken();
      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Tải tệp lên thất bại');

      const uploadedFiles = data.data || [];
      if (uploadedFiles.length > 0) {
        // Gửi tin nhắn chứa attachment qua REST API
        await request('/messages', {
          method: 'POST',
          body: {
            conversationId: activeConv._id,
            text: `Đã gửi tệp đính kèm: ${file.name}`,
            attachments: uploadedFiles
          }
        });
        loadMessages(activeConv._id);
      }
    } catch (err) {
      alert('Tải tệp thất bại: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRevoke = async (msgId) => {
    if (!confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) return;
    try {
      await revokeMessage(msgId);
    } catch (err) {
      // Fallback REST
      try {
        await request(`/messages/${msgId}`, { method: 'DELETE' });
        loadMessages(activeConv._id);
      } catch (e) {
        alert('Không thể thu hồi: ' + e.message);
      }
    }
  };

  const handleEdit = async (msg) => {
    const newText = prompt('Nhập nội dung mới:', msg.text);
    if (!newText || newText === msg.text) return;
    try {
      await editMessage(msg._id, newText);
    } catch (err) {
      try {
        await request(`/messages/${msg._id}`, {
          method: 'PATCH',
          body: { text: newText }
        });
        loadMessages(activeConv._id);
      } catch (e) {
        alert('Không thể sửa tin nhắn: ' + e.message);
      }
    }
  };

  const handleCreateDirectChat = async (targetUser) => {
    try {
      const res = await request('/conversations', {
        method: 'POST',
        body: { participantId: targetUser._id }
      });
      const conv = res.data;
      await loadConversations();
      setActiveConv(conv);
      setShowNewDirectModal(false);
    } catch (err) {
      alert('Lỗi tạo hội thoại: ' + err.message);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedMembers.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }
    try {
      const res = await request('/conversations/group', {
        method: 'POST',
        body: {
          name: groupName.trim(),
          members: selectedMembers
        }
      });
      const conv = res.data;
      await loadConversations();
      setActiveConv(conv);
      setShowNewGroupModal(false);
      setGroupName('');
      setSelectedMembers([]);
    } catch (err) {
      alert('Lỗi tạo nhóm: ' + err.message);
    }
  };

  // Helper tìm tên hiển thị của conversation
  const getConvTitle = (conv) => {
    if (!conv) return '';
    if (conv.type === 'group' || conv.isGroup) return conv.name || 'Nhóm học tập';
    const other = conv.members?.find((m) => (m._id || m) !== currentUser?._id);
    return other?.displayName || other?.username || 'Tin nhắn riêng';
  };

  // ===================== RENDER LOGIN =====================
  if (!currentUser) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.logoHeader}>
            <div style={styles.logoBadge}>PTIT</div>
            <h1 style={styles.logoTitle}>PTITChat</h1>
          </div>
          <p style={styles.logoSubtitle}>KẾT NỐI KHÔNG KHOẢNG CÁCH • HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG</p>

          <div style={styles.quickLoginBox}>
            <p style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#8B1528' }}>
              ⚡ Đăng nhập nhanh để test Local (Click 1 chạm):
            </p>
            <div style={styles.quickGrid}>
              {PRESET_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  onClick={() => handleLogin(acc.username, 'password123')}
                  style={styles.quickBtn}
                  disabled={loadingAuth}
                >
                  <div style={{ fontWeight: '600' }}>{acc.label}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>@{acc.username}</div>
                  <div style={{ fontSize: '10px', color: '#8B1528', marginTop: '2px' }}>{acc.role}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '14px 0', color: '#999', fontSize: '12px' }}>— HOẶC ĐĂNG NHẬP THỦ CÔNG —</div>

          {authError && <div style={styles.errorBox}>{authError}</div>}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(usernameInput, passwordInput); }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tên đăng nhập</label>
              <input
                style={styles.input}
                type="text"
                placeholder="VD: ngotung05"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mật khẩu</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Mật khẩu"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loadingAuth}
              style={{ ...styles.submitBtn, opacity: loadingAuth ? 0.7 : 1 }}
            >
              {loadingAuth ? 'Đang xác thực...' : 'Đăng nhập PTITChat'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ===================== RENDER 3-COLUMN CHAT INTERFACE =====================
  const currentTypingUsers = typingUsers[activeConv?._id] || {};
  const isSomeoneTyping = Object.keys(currentTypingUsers).length > 0;

  return (
    <div style={styles.appContainer}>
      {/* TOP HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoBadge}>PTIT</div>
          <span style={styles.brandTitle}>PTITChat</span>
          <span style={styles.tagline}>KẾT NỐI KHÔNG KHOẢNG CÁCH</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userBadge}>
            <div style={styles.userAvatarSmall}>
              {currentUser.displayName?.[0] || currentUser.username?.[0] || 'U'}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '13px' }}>{currentUser.displayName || currentUser.username}</div>
              <div style={{ fontSize: '11px', color: '#4ade80' }}>● Đang trực tuyến</div>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Đăng xuất</button>
        </div>
      </header>

      {/* 3-COLUMN BODY */}
      <div style={styles.mainLayout}>
        {/* COLUMN 1: CONVERSATIONS LIST */}
        <aside style={styles.colLeft}>
          <div style={styles.colHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '15px' }}>Tin nhắn</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setShowNewDirectModal(true)}
                  style={styles.iconBtn}
                  title="Nhắn tin người mới"
                >
                  👤+
                </button>
                <button
                  onClick={() => setShowNewGroupModal(true)}
                  style={styles.iconBtn}
                  title="Tạo nhóm mới"
                >
                  👥+
                </button>
              </div>
            </div>
          </div>

          <div style={styles.convListScroll}>
            {conversations.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                Chưa có cuộc trò chuyện nào.<br />Hãy bấm 👤+ hoặc 👥+ để bắt đầu!
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = activeConv?._id === c._id;
                const isGroup = c.type === 'group' || c.isGroup;
                const title = getConvTitle(c);
                const lastMsg = c.lastMessage?.isRecall
                  ? 'Tin nhắn đã bị thu hồi'
                  : c.lastMessage?.text || 'Bắt đầu cuộc trò chuyện';

                return (
                  <div
                    key={c._id}
                    onClick={() => setActiveConv(c)}
                    style={{
                      ...styles.convItem,
                      backgroundColor: isActive ? '#FBE8EC' : 'transparent',
                      borderLeft: isActive ? '4px solid #8B1528' : '4px solid transparent'
                    }}
                  >
                    <div style={isGroup ? styles.convAvatarGroup : styles.convAvatarUser}>
                      {isGroup ? '👥' : title[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#1F2937' }}>{title}</span>
                      </div>
                      <div style={styles.lastMsgText}>{lastMsg}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* COLUMN 2: ACTIVE CHAT FEED */}
        <main style={styles.colCenter}>
          {activeConv ? (
            <>
              <div style={styles.chatTopBar}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '16px', color: '#1F2937' }}>
                    {getConvTitle(activeConv)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {(activeConv.type === 'group' || activeConv.isGroup)
                      ? `${activeConv.members?.length || 0} thành viên • Phòng nhóm`
                      : 'Cuộc trò chuyện 1-1 riêng tư'}
                  </div>
                </div>
              </div>

              {/* MESSAGES THREAD */}
              <div style={styles.messagesContainer}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '40px' }}>
                    Chưa có tin nhắn nào trong hội thoại này.<br />Hãy gửi lời chào đầu tiên! 👋
                  </div>
                ) : (
                  messages.map((m) => {
                    const senderId = m.sender?._id || m.sender;
                    const isMe = senderId === currentUser._id;
                    const senderName = m.sender?.displayName || m.sender?.username || (isMe ? 'Bạn' : 'Thành viên');

                    return (
                      <div
                        key={m._id || m.clientTempId}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start',
                          marginBottom: '12px'
                        }}
                      >
                        {!isMe && (
                          <span style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px', marginLeft: '8px' }}>
                            {senderName}
                          </span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isMe && !m.isRecall && (
                            <div style={styles.msgActions}>
                              <button onClick={() => handleEdit(m)} style={styles.actionLink}>Sửa</button>
                              <button onClick={() => handleRevoke(m._id)} style={styles.actionLink}>Thu hồi</button>
                            </div>
                          )}

                          <div
                            style={{
                              ...styles.bubble,
                              backgroundColor: m.isRecall ? '#E5E7EB' : isMe ? '#8B1528' : '#F3F4F6',
                              color: m.isRecall ? '#6B7280' : isMe ? '#FFFFFF' : '#1F2937',
                              fontStyle: m.isRecall ? 'italic' : 'normal'
                            }}
                          >
                            <div>{m.text}</div>

                            {/* Render attachments */}
                            {m.attachments?.map((att, i) => (
                              <div key={i} style={styles.attachmentBox}>
                                📄 <a
                                  href={`http://localhost:5000${att.path || att.url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: isMe ? '#FFFFFF' : '#8B1528', textDecoration: 'underline' }}
                                >
                                  {att.originalname || att.filename || 'Tệp đính kèm'}
                                </a>
                              </div>
                            ))}

                            <div
                              style={{
                                fontSize: '10px',
                                textAlign: 'right',
                                marginTop: '4px',
                                color: isMe && !m.isRecall ? '#F9D5DB' : '#9CA3AF'
                              }}
                            >
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              {m.isEdited && !m.isRecall && ' (đã sửa)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {isSomeoneTyping && (
                  <div style={{ fontSize: '12px', color: '#8B1528', fontStyle: 'italic', padding: '4px 8px' }}>
                    ✍️ Ai đó đang soạn tin nhắn...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT BAR */}
              <div style={styles.inputArea}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.attachBtn}
                  disabled={isUploading}
                  title="Đính kèm tệp / ảnh"
                >
                  {isUploading ? '⏳' : '📎'}
                </button>

                <form onSubmit={handleSendMessage} style={{ display: 'flex', flex: 1, gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Nhắn tin cho cuộc trò chuyện..."
                    value={inputMessage}
                    onChange={handleInputChange}
                    style={styles.chatInput}
                  />
                  <button type="submit" style={styles.sendBtn}>Gửi</button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF' }}>
              Chọn một cuộc trò chuyện từ cột trái để bắt đầu
            </div>
          )}
        </main>

        {/* COLUMN 3: DETAILS PANEL */}
        {activeConv && (
          <aside style={styles.colRight}>
            <div style={{ textAlign: 'center', padding: '20px 10px', borderBottom: '1px solid #E5E7EB' }}>
              <div style={styles.detailsAvatar}>
                {(activeConv.type === 'group' || activeConv.isGroup) ? '👥' : '👤'}
              </div>
              <h3 style={{ margin: '10px 0 4px', fontSize: '16px' }}>{getConvTitle(activeConv)}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                {(activeConv.type === 'group' || activeConv.isGroup) ? 'Nhóm trao đổi bài tập PTIT' : 'Trò chuyện cá nhân'}
              </p>
            </div>

            <div style={{ padding: '16px' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#8B1528', marginBottom: '10px' }}>
                Thành viên ({activeConv.members?.length || 0})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeConv.members?.map((m) => {
                  const memId = m._id || m;
                  const u = allUsers.find((usr) => usr._id === memId) || m;
                  const isCurrent = memId === currentUser._id;
                  return (
                    <div key={memId} style={styles.memberRow}>
                      <div style={styles.memberAvatar}>
                        {(u.displayName || u.username || 'U')[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500' }}>
                          {u.displayName || u.username} {isCurrent && '(Bạn)'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#4ade80' }}>● Trực tuyến</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL: CHAT 1-1 */}
      {showNewDirectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 12px', color: '#8B1528' }}>Chọn bạn để nhắn tin 1-1</h3>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {allUsers.map((u) => (
                <div
                  key={u._id}
                  onClick={() => handleCreateDirectChat(u)}
                  style={styles.modalUserRow}
                >
                  <div style={styles.memberAvatar}>{u.displayName?.[0] || u.username?.[0]}</div>
                  <div>
                    <div style={{ fontWeight: '600' }}>{u.displayName}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowNewDirectModal(false)} style={styles.closeBtn}>Đóng</button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE GROUP */}
      {showNewGroupModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 12px', color: '#8B1528' }}>Tạo nhóm học tập mới</h3>
            <input
              type="text"
              placeholder="VD: Nhóm Đồ án PTIT - Lớp D21"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ ...styles.input, marginBottom: '12px' }}
            />
            <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Chọn thành viên vào nhóm:</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
              {allUsers.map((u) => {
                const checked = selectedMembers.includes(u._id);
                return (
                  <label key={u._id} style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMembers([...selectedMembers, u._id]);
                        else setSelectedMembers(selectedMembers.filter((id) => id !== u._id));
                      }}
                    />
                    <span>{u.displayName || u.username} (@{u.username})</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewGroupModal(false)} style={styles.closeBtn}>Hủy</button>
              <button onClick={handleCreateGroup} style={styles.submitBtnSmall}>Tạo nhóm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== STYLES OBJECT =====================
const styles = {
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  loginCard: {
    width: '460px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB'
  },
  logoHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '6px'
  },
  logoBadge: {
    backgroundColor: '#8B1528',
    color: '#FFF',
    fontWeight: '900',
    fontSize: '14px',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  logoTitle: {
    fontSize: '26px',
    color: '#8B1528',
    margin: 0,
    fontWeight: '800'
  },
  logoSubtitle: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#6B7280',
    margin: '0 0 20px',
    letterSpacing: '0.5px'
  },
  quickLoginBox: {
    backgroundColor: '#FFF5F6',
    border: '1px solid #FBCED4',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px'
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  quickBtn: {
    padding: '8px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s'
  },
  formGroup: {
    marginBottom: '14px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '4px',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '6px'
  },
  submitBtnSmall: {
    padding: '8px 16px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  errorBox: {
    padding: '8px 12px',
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px'
  },

  // App Layout Styles
  appContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#F9FAFB'
  },
  header: {
    height: '56px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: '800'
  },
  tagline: {
    fontSize: '11px',
    opacity: 0.8,
    borderLeft: '1px solid rgba(255,255,255,0.3)',
    paddingLeft: '10px',
    letterSpacing: '0.5px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  userAvatarSmall: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#FFF',
    color: '#8B1528',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px'
  },
  logoutBtn: {
    padding: '6px 12px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#FFF',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  },

  // Col Left
  colLeft: {
    width: '320px',
    backgroundColor: '#FFF',
    borderRight: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column'
  },
  colHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #E5E7EB'
  },
  iconBtn: {
    padding: '4px 8px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  convListScroll: {
    flex: 1,
    overflowY: 'auto'
  },
  convItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #F3F4F6',
    transition: 'background-color 0.15s'
  },
  convAvatarGroup: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px'
  },
  convAvatarUser: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#E5E7EB',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px'
  },
  lastMsgText: {
    fontSize: '12px',
    color: '#6B7280',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '2px'
  },

  // Col Center
  colCenter: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#F9FAFB'
  },
  chatTopBar: {
    height: '56px',
    backgroundColor: '#FFF',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px'
  },
  messagesContainer: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  bubble: {
    maxWidth: '65%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.4',
    wordBreak: 'break-word',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  attachmentBox: {
    marginTop: '6px',
    padding: '6px 8px',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: '6px',
    fontSize: '12px'
  },
  msgActions: {
    display: 'flex',
    gap: '4px',
    fontSize: '11px'
  },
  actionLink: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '0 2px'
  },
  inputArea: {
    padding: '12px 20px',
    backgroundColor: '#FFF',
    borderTop: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  attachBtn: {
    padding: '10px 14px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  chatInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    outline: 'none'
  },
  sendBtn: {
    padding: '10px 20px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer'
  },

  // Col Right
  colRight: {
    width: '280px',
    backgroundColor: '#FFF',
    borderLeft: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column'
  },
  detailsAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    margin: '0 auto'
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 0'
  },
  memberAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '13px',
    color: '#374151'
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalCard: {
    width: '400px',
    backgroundColor: '#FFF',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
  },
  modalUserRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    borderBottom: '1px solid #F3F4F6'
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
    fontSize: '14px',
    cursor: 'pointer'
  },
  closeBtn: {
    padding: '8px 14px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    cursor: 'pointer'
  }
};
