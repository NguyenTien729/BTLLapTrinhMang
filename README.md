# PTITChat — Ứng Dụng Nhắn Tin Thời Gian Thực (Realtime Chat Application)

> **Báo cáo Đồ án môn học: Lập trình mạng**  
> **Học viện Công nghệ Bưu chính Viễn thông (PTIT)**  
> **Hệ thống Chat Full-Stack:** Node.js (Express), MongoDB Atlas, Socket.IO, Multer, JWT, React (Vite).

---

## 👥 Danh Sách Thành Viên & Phân Công Nhiệm Vụ

| STT | Họ và tên | Mã SV | Vai trò | Nhiệm vụ đảm nhiệm chính |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **Ngô Bùi Tùng** | B23DCCN900 | Fullstack / Team Lead | • Thiết kế CSDL (Mongoose Schemas: Conversation, Message, Soft Recall, Attachments)<br>• Xây dựng hệ thống RESTful API hội thoại, tin nhắn, tìm kiếm<br>• Tầng dịch vụ `messageService` dùng chung chống trùng tin (`clientTempId`)<br>• Module Upload đa phương tiện (Multer)<br>• Tích hợp hệ thống, đồng bộ MongoDB Atlas và viết Test Suite tự động API |
| **2** | **Nguyễn Mạnh Tiến** | B23DCCN820 | Backend / Auth | • Module Xác thực & Quản lý người dùng (Đăng ký, Đăng nhập, JWT, Bcrypt)<br>• Schema `User`, `authMiddleware` phân quyền và bảo vệ route<br>• API quản lý thông tin cá nhân và tìm kiếm người dùng |
| **3** | **Trần Đăng Ninh** | B23DCCN634 | Backend / Realtime | • Thiết lập hạ tầng Realtime Socket.IO, xác thực JWT handshake<br>• Xử lý sự kiện tin nhắn thời gian thực (1-1, Nhóm, Sửa, Thu hồi, Typing indicator)<br>• Quản lý trạng thái hiện diện (Presence: Online / Offline)<br>• Bộ test case kiểm thử Socket.IO |
| **4** | **Nguyễn Hoàng Sơn** | B23DCCN721 | Frontend UI/UX | • Xây dựng giao diện ứng dụng React + Vite chuẩn nhận diện PTIT<br>• Tích hợp Chế độ Sáng / Tối (Light / Dark Mode) lưu trữ bền vững (`localStorage`)<br>• Bảng biểu tượng cảm xúc (Emoji Picker) đối xứng, cân đối<br>• Giao diện Đăng nhập 1-Click với 4 tài khoản nhóm mẫu<br>• Khung thông tin hội thoại mở rộng 350px phong cách Zalo Desktop |

---

## 🚀 Tính Năng Nổi Bật

1. **Xác thực an toàn (Authentication)**: Đăng ký, đăng nhập bảo mật bằng mật khẩu băm `bcrypt` và cấp phát JSON Web Token (JWT HS256).
2. **Nhắn tin thời gian thực (Socket.IO)**: Nhắn tin 1-1 và chat nhóm không có độ trễ, tự động cập nhật danh sách hội thoại và số tin nhắn chưa đọc.
3. **Trạng thái hiện diện (Presence Tracking)**: Hiển thị chấm xanh trực tuyến và số lượng thành viên đang online tức thì.
4. **Cơ chế chống trùng lặp tin nhắn (`clientTempId`)**: Đảm bảo tin nhắn gửi qua Socket.IO và REST API không bao giờ bị nhân đôi dữ liệu.
5. **Thu hồi mềm (Soft Delete/Recall)**: Người gửi có thể thu hồi tin nhắn; nội dung sẽ tự động ẩn trên giao diện tất cả người nhận trong khi lịch sử vẫn được bảo toàn trong CSDL phục vụ quản trị.
6. **Chỉnh sửa tin nhắn**: Cập nhật nội dung tin nhắn và phát tín hiệu `message:edited` tới tất cả thành viên trong phòng.
7. **Đính kèm Tệp & Hình ảnh (Multer)**: Hỗ trợ gửi ảnh, tài liệu PDF, Office, file nén tối đa 25MB với tính năng xem trước trực tiếp.
8. **Tìm kiếm hội thoại & tin nhắn**: Tra cứu nội dung tin nhắn theo từ khóa nhanh chóng trong từng cuộc hội thoại.
9. **Giao diện người dùng hiện đại**:
   - Chế độ Sáng / Tối (Light & Dark mode) tự động ghi nhớ, không giật màn hình khi tải lại (`F5`).
   - Bảng emoji đối xứng, căn giữa tâm ô vuông với hiệu ứng phóng to hover đẹp mắt.
   - Hỗ trợ nút đăng nhập 1 chạm (1-Click Login) cho 4 thành viên nhóm.

---

## 📂 Cấu Trúc Thư Mục Dự Án

```
BTLLapTrinhMang/
├── backend/                             # Máy chủ Node.js + Express + Socket.IO
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                    # Kết nối MongoDB Atlas (Mongoose)
│   │   ├── controllers/
│   │   │   ├── authController.js        # Đăng ký, đăng nhập JWT, hồ sơ me
│   │   │   ├── conversationController.js# Quản lý cuộc trò chuyện 1-1 và nhóm
│   │   │   ├── messageController.js     # Lấy lịch sử, gửi, sửa, thu hồi tin nhắn
│   │   │   └── userController.js        # Tìm kiếm và danh sách người dùng
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js        # Xác thực Bearer JWT & quyền hội thoại
│   │   │   └── uploadMiddleware.js      # Multer xử lý tải ảnh & tài liệu
│   │   ├── models/
│   │   │   ├── Conversation.js          # Mongoose Schema Hội thoại
│   │   │   ├── Message.js               # Mongoose Schema Tin nhắn
│   │   │   └── User.js                  # Mongoose Schema Người dùng & bcrypt
│   │   ├── routes/
│   │   │   ├── authRoutes.js            # /api/auth
│   │   │   ├── conversationRoutes.js    # /api/conversations
│   │   │   ├── messageRoutes.js         # /api/messages
│   │   │   ├── uploadRoutes.js          # /api/uploads
│   │   │   └── userRoutes.js            # /api/users
│   │   ├── seeds/
│   │   │   └── seedData.js              # Script khởi tạo 4 tài khoản và dữ liệu mẫu
│   │   ├── services/
│   │   │   └── messageService.js        # Dịch vụ lưu tin nhắn dùng chung (Idempotency)
│   │   ├── socket/
│   │   │   ├── authSocket.js            # Middleware xác thực JWT cho Socket.IO
│   │   │   ├── chatSocket.js            # Sự kiện tin nhắn, gõ phím, sửa, thu hồi
│   │   │   ├── presenceSocket.js        # Trạng thái Online / Offline
│   │   │   └── index.js                 # Điểm kết nối Socket.IO
│   │   ├── tests/
│   │   │   ├── api.test.js              # 26 test cases kiểm thử REST API
│   │   │   └── socket.test.js           # 9 test cases kiểm thử Socket.IO
│   │   └── app.js                       # Cấu hình Express, CORS, Static uploads
│   ├── uploads/                         # Thư mục lưu trữ tệp đính kèm người dùng
│   ├── server.js                        # File khởi động Server HTTP & WebSocket
│   ├── .env.example                     # Biến môi trường mẫu
│   └── package.json
│
├── ptitchat/                            # Ứng dụng Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx                      # Component chính (Chat, Nav, Modal, Themes)
│   │   ├── styles.css                   # Toàn bộ CSS (Responsive, Dark/Light mode)
│   │   ├── storage.js                   # API Client, Socket listener, Local storage
│   │   ├── data.js                      # Helpers dữ liệu & tiện ích thời gian
│   │   └── main.jsx                     # Điểm gắn React DOM
│   ├── tests/
│   │   ├── app.test.js                  # Test giao diện và chức năng phía client
│   │   └── server.test.js               # Test tích hợp Client - Server
│   ├── index.html                       # HTML gốc với Anti-flicker Theme Script
│   ├── vite.config.js                   # Cấu hình Vite & Reverse Proxy (/api, /socket.io)
│   └── package.json
│
├── PTITChat.postman_collection.json     # Bộ Postman Collection kiểm thử đầy đủ API
├── docker-compose.yml                   # Cấu hình khởi chạy nhanh MongoDB / App bằng Docker
└── README.md                            # Tài liệu hướng dẫn sử dụng và báo cáo đồ án
```

---

## 🛠 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Yêu Cầu Môi Trường
- **Node.js**: Phiên bản 20.x hoặc 22.x LTS trở lên.
- **npm**: Phiên bản 10.x trở lên.
- **MongoDB**: Đã có sẵn MongoDB Atlas (theo chuỗi kết nối nhóm đã cấu hình) hoặc MongoDB Server cài tại máy (`localhost:27017`).

---

### 2. Cài Đặt & Khởi Chạy Backend

Mở cửa sổ dòng lệnh thứ nhất:

```bash
# 1. Đi vào thư mục backend
cd backend

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Tạo file cấu hình môi trường từ mẫu
cp .env.example .env
# Trên Windows PowerShell:
# Copy-Item .env.example .env

# 4. Khởi chạy server ở chế độ phát triển
npm run dev
```

Server sẽ khởi chạy tại: **`http://localhost:5000`**  
*(CSDL MongoDB Atlas đã tự động kết nối và đồng bộ các tài khoản của nhóm)*.

---

### 3. Cài Đặt & Khởi Chạy Frontend (PTITChat)

Mở cửa sổ dòng lệnh thứ hai:

```bash
# 1. Đi vào thư mục ptitchat
cd ptitchat

# 2. Cài đặt thư viện giao diện
npm install

# 3. Chạy giao diện phát triển Vite
npm run dev
```

Mở trình duyệt truy cập: **`http://localhost:5173`**

---

### 4. Tài Khoản Thử Nghiệm Mẫu (1-Click Login)
Tại màn hình đăng nhập, bạn có thể bấm trực tiếp vào các nút tài khoản đã seed sẵn:

| Tên người dùng | Username | Mật khẩu | Vai trò trong nhóm |
| :--- | :---: | :---: | :--- |
| **Ngô Bùi Tùng** | `ngotung05` | `password123` | Trưởng nhóm |
| **Nguyễn Mạnh Tiến** | `nguyentien05` | `password123` | Thành viên |
| **Nguyễn Hoàng Sơn** | `hoangson05` | `password123` | Thành viên |
| **Trần Đăng Ninh** | `tranninh05` | `password123` | Thành viên |

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

Toàn bộ hệ sinh thái dự án đã được bao phủ bởi các bộ kiểm thử tự động toàn diện:

### 1. Kiểm thử Backend (35/35 Test Cases PASS)
Bao gồm 26 test REST API (`api.test.js`) và 9 test Socket.IO (`socket.test.js`):
```bash
npm test --prefix backend
```
- Xác thực đăng ký, đăng nhập, bảo mật JWT.
- Phân quyền hội thoại (chặn người ngoài truy cập/gửi tin nhắn).
- Chống tạo trùng lặp hội thoại 1-1.
- Chống trùng lặp tin nhắn (`clientTempId`).
- Thu hồi mềm tin nhắn và ẩn nội dung trên API.
- Tải tệp lên bằng Multer và chặn tệp vượt dung lượng/sai định dạng.
- Broadcast tin nhắn và thông báo thời gian thực qua phòng Socket.IO.

### 2. Kiểm thử Frontend (2/2 Suites PASS)
```bash
npm test --prefix ptitchat
```
- Kiểm tra toàn diện UI: đăng nhập lỗi, chế độ demo, gửi tin nhắn, tạo nhóm, cập nhật hồ sơ cá nhân.
- Kiểm tra tích hợp REST Authentication, tải tệp đính kèm và nhận dữ liệu thời gian thực.

---

## 📖 Chi Tiết Danh Sách API (REST API Reference)

Tất cả các API yêu cầu gửi kèm header:  
`Authorization: Bearer <TOKEN_JWT>` *(ngoại trừ các endpoint đăng ký/đăng nhập)*.

### 1. Nhóm Xác Thực & Người Dùng (`/api/auth` & `/api/users`)
| Method | Endpoint | Chức năng |
| :---: | :--- | :--- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới (`username`, `password`, `name`) |
| `POST` | `/api/auth/login` | Đăng nhập hệ thống, trả về Token JWT và thông tin user |
| `GET` | `/api/auth/me` | Lấy thông tin tài khoản đang đăng nhập |
| `PATCH`| `/api/auth/me` | Cập nhật hồ sơ (Họ tên, email, bio, mã SV, avatar) |
| `GET` | `/api/users` | Danh sách người dùng hệ thống (hỗ trợ tham số `?all=true`) |
| `GET` | `/api/users/search?q=` | Tìm kiếm người dùng theo username hoặc tên hiển thị |

### 2. Nhóm Hội Thoại (`/api/conversations`)
| Method | Endpoint | Chức năng |
| :---: | :--- | :--- |
| `GET` | `/api/conversations` | Lấy toàn bộ danh sách cuộc trò chuyện của người dùng |
| `POST` | `/api/conversations` | Tạo hoặc lấy hội thoại 1-1 (tự deduplicate nếu đã có) |
| `POST` | `/api/conversations/group` | Tạo nhóm chat mới (`name`, `members`, `avatar`) |
| `PATCH`| `/api/conversations/:id` | Sửa tên nhóm, thêm/xóa thành viên, rời khỏi nhóm |

### 3. Nhóm Tin Nhắn (`/api/messages`)
| Method | Endpoint | Chức năng |
| :---: | :--- | :--- |
| `GET` | `/api/messages/:conversationId` | Lấy lịch sử tin nhắn của cuộc trò chuyện (phân trang) |
| `POST` | `/api/messages` | Gửi tin nhắn mới (hỗ trợ text, attachments, replyTo, clientTempId) |
| `PATCH`| `/api/messages/:id` | Sửa nội dung tin nhắn đã gửi |
| `DELETE`| `/api/messages/:id` | Thu hồi mềm tin nhắn (`isRecall: true`) |
| `GET` | `/api/messages/search?q=` | Tìm kiếm tin nhắn theo từ khóa |

### 4. Nhóm Tải Lên Đa Phương Tiện (`/api/uploads`)
| Method | Endpoint | Định dạng | Chức năng |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/uploads` | `multipart/form-data` | Tải lên hình ảnh / tài liệu (tối đa 25MB) |

---

## ⚡ Các Sự Kiện Socket.IO (Realtime Events)

| Sự kiện | Chiều | Mô tả |
| :--- | :---: | :--- |
| `connection` | Client ⇄ Server | Xác thực JWT trong `socket.handshake.auth.token` |
| `message` | Server → Client | Phát tin nhắn mới đến các thành viên trong hội thoại |
| `typing` | Client ⇄ Server | Phát tín hiệu người dùng đang soạn tin nhắn |
| `message:edited` | Server → Client | Cập nhật nội dung tin nhắn đã sửa tới phòng chat |
| `message:recalled` | Server → Client | Thông báo thu hồi tin nhắn tới các người nhận |
| `presence:list` | Server → Client | Gửi danh sách toàn bộ ID người dùng đang Online |
| `user:online` | Server → Client | Báo hiệu có người dùng vừa kết nối trực tuyến |
| `user:offline` | Server → Client | Báo hiệu người dùng vừa ngắt kết nối (kèm `lastSeen`) |

---

## 📜 Bản Quyền & Giấy Phép
Dự án được xây dựng và phát triển phục vụ học tập và nghiên cứu trong khuôn khổ môn học **Lập trình mạng** tại **Học viện Công nghệ Bưu chính Viễn thông (PTIT)**.
