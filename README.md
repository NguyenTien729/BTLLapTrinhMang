# PTITChat - Ứng Dụng Nhắn Tin Trực Tuyến Thời Gian Thực

Dự án đề tài ứng dụng nhắn tin thời gian thực **PTITChat** xây dựng bằng **Node.js, Express, MongoDB, Socket.IO, Multer, JWT** và **React**.

---

## 1. Cấu Trúc Thư Mục Backend

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                        # Kết nối MongoDB (Mongoose)
│   ├── models/
│   │   ├── User.js                      # Schema người dùng & mã hóa bcrypt
│   │   ├── Conversation.js              # Schema hội thoại 1-1 và Nhóm
│   │   └── Message.js                   # Schema tin nhắn, đính kèm, reply, thu hồi mềm
│   ├── controllers/
│   │   ├── authController.js            # Đăng ký, đăng nhập JWT, lấy thông tin me
│   │   ├── userController.js            # Danh sách & tìm kiếm người dùng
│   │   ├── conversationController.js    # Quản lý hội thoại 1-1 và nhóm
│   │   └── messageController.js         # Quản lý tin nhắn
│   ├── routes/
│   │   ├── authRoutes.js                # /api/auth
│   │   ├── userRoutes.js                # /api/users
│   │   ├── conversationRoutes.js        # /api/conversations
│   │   ├── messageRoutes.js             # /api/messages
│   │   └── uploadRoutes.js              # /api/uploads
│   ├── middleware/
│   │   ├── authMiddleware.js            # Kiểm tra JWT & quyền thành viên hội thoại
│   │   └── uploadMiddleware.js          # Multer upload tệp/ảnh & kiểm tra loại/kích thước
│   ├── services/
│   │   └── messageService.js            # HÀM LƯU TIN NHẮN DÙNG CHUNG (REST API & Socket.IO)
│   ├── socket/
│   │   ├── index.js                     # Khởi tạo Socket.IO & xác thực JWT socket
│   │   ├── chatSocket.js                # Lắng nghe & broadcast tin nhắn, sửa, thu hồi, typing
│   │   └── presenceSocket.js            # Trạng thái Online / Offline thời gian thực
│   ├── tests/
│   │   └── api.test.js                  # Bộ test tự động 26 test case kiểm tra toàn diện API
│   └── app.js                           # Express app & cấu hình middleware
├── uploads/                             # Thư mục lưu trữ tệp & ảnh đã tải lên
├── server.js                            # HTTP Server & lắng nghe cổng
├── .env.example                         # Biến môi trường mẫu
├── .env                                 # Biến môi trường cục bộ
└── package.json
```

---

## 2. Thiết Kế Database (Mongoose Schema)

### 2.1. Conversation Schema (`backend/src/models/Conversation.js`)
- `type`: `'direct'` (1-1) hoặc `'group'` (Nhóm).
- `name`: Tên nhóm trò chuyện.
- `avatar`: URL ảnh đại diện nhóm.
- `members`: Mảng các `ObjectId` tham chiếu đến `User` (được index để truy vấn nhanh).
- `admin`: `ObjectId` người tạo / quản trị viên nhóm.
- `lastMessage`: `ObjectId` tham chiếu `Message` mới nhất.
- `lastMessageAt`: Thời điểm gửi tin nhắn cuối cùng (index giảm dần để sắp xếp hộp thoại).
- Phương thức `hasMember(userId)` và static `findDirectConversation(user1, user2)`.

### 2.2. Message Schema (`backend/src/models/Message.js`)
- `conversationId`: `ObjectId` tham chiếu `Conversation` (indexed).
- `sender`: `ObjectId` tham chiếu `User` người gửi (indexed).
- `type`: `'text'` | `'image'` | `'file'`.
- `text`: Nội dung văn bản của tin nhắn.
- `attachments`: Mảng metadata tệp đính kèm:
  - `url`: Đường dẫn tải file (ví dụ: `/uploads/file-123.pdf`).
  - `fileName`: Tên tệp đã lưu.
  - `originalName`: Tên tệp gốc.
  - `fileType`: `'image'` hoặc `'file'`.
  - `fileSize`: Dung lượng tính bằng bytes.
  - `mimeType`: Chuỗi MIME (`image/png`, `application/pdf`, ...).
- `replyTo`: `ObjectId` tham chiếu tin nhắn được phản hồi (populate text, sender).
- `isEdited`: `Boolean` đánh dấu tin nhắn đã chỉnh sửa.
- `editedAt`: Thời gian chỉnh sửa.
- `isRecall`: `Boolean` **thu hồi mềm** (soft delete). Khi `true`, nội dung và tệp đính kèm được tự động ẩn khỏi client (`text = 'Tin nhắn đã bị thu hồi'`), bản ghi vẫn được lưu trữ trong CSDL.
- `recalledAt`: Thời điểm thu hồi.
- `clientTempId`: ID tạm từ phía client gửi lên để **chống trùng lặp tin nhắn giữa Socket.IO và REST API**.
- `readBy`: Danh sách người dùng đã đọc tin nhắn và thời điểm đọc.

---

## 3. Hàm Lưu Tin Nhắn Dùng Chung (`messageService.js`)

Để đảm bảo tính nhất quán và **không bao giờ bị trùng lặp bản ghi** giữa REST API và Socket.IO:

```javascript
const messageService = require('../services/messageService');

// Gọi khi nhận sự kiện từ Socket.IO hoặc từ REST API:
const savedMessage = await messageService.createMessage({
  conversationId,
  senderId,
  text,
  type,
  attachments,
  replyTo,
  clientTempId // Nếu gửi lại cùng clientTempId, hệ thống trả về tin nhắn đã tạo, không tạo mới
});
```

**Cơ chế hoạt động:**
1. **Kiểm tra Deduplication**: Nếu client gửi `clientTempId`, service kiểm tra xem tin nhắn đã tồn tại chưa. Nếu có, lập tức trả về tin nhắn đó.
2. **Kiểm tra quyền thành viên**: Người gửi bắt buộc phải nằm trong mảng `members` của `Conversation`. Nếu không, bắn lỗi 403 Forbidden.
3. **Kiểm tra tin nhắn phản hồi (`replyTo`)**: Xác thực tin nhắn phản hồi phải thuộc về cùng hội thoại.
4. **Cập nhật hội thoại**: Tự động cập nhật `lastMessage` và `lastMessageAt` cho hội thoại.
5. **Populate dữ liệu**: Tự động populate đầy đủ thông tin `sender` (avatar, displayName) và `replyTo`.

---

## 4. Danh Sách Các RESTful API Chi Tiết

Tất cả các API yêu cầu gắn header: `Authorization: Bearer <JWT_TOKEN>`.

### 4.1. Nhóm API Hội Thoại (`/api/conversations`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| **GET** | `/api/conversations` | Lấy danh sách tất cả hội thoại của người dùng, sắp xếp theo tin nhắn mới nhất |
| **POST** | `/api/conversations` | Tạo hoặc lấy hội thoại 1-1 (Nếu đã có hội thoại giữa 2 người thì trả về cái cũ) |
| **POST** | `/api/conversations/group` | Tạo nhóm trò chuyện mới (tối thiểu 2 thành viên, người tạo là admin) |
| **PATCH** | `/api/conversations/:id` | Đổi tên nhóm, cập nhật avatar, thêm thành viên, xóa thành viên, rời nhóm |

#### Ví dụ Body:
- **POST `/api/conversations`**:
  ```json
  { "recipientId": "65b21d5a7a8d8e9f12345678" }
  ```
- **POST `/api/conversations/group`**:
  ```json
  {
    "name": "Nhóm Đồ Án PTITChat",
    "members": ["65b21d5a7a8d8e9f12345678", "65b21d5a7a8d8e9f87654321"],
    "avatar": ""
  }
  ```
- **PATCH `/api/conversations/:id`**:
  ```json
  {
    "name": "Tên nhóm mới",
    "addMembers": ["userId3"],
    "removeMembers": ["userId4"],
    "leave": false
  }
  ```

---

### 4.2. Nhóm API Tin Nhắn (`/api/messages`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| **GET** | `/api/messages/search?q=&conversationId=` | Tìm kiếm tin nhắn theo từ khóa (trong 1 hội thoại hoặc tất cả) |
| **GET** | `/api/messages/:conversationId?page=1&limit=20` | Lấy lịch sử tin nhắn phân trang (kiểm tra quyền thành viên) |
| **POST** | `/api/messages` | Gửi tin nhắn mới (văn bản, tệp đính kèm, replyTo, clientTempId) |
| **PATCH** | `/api/messages/:id` | Chỉnh sửa tin nhắn của chính mình (chặn sửa tin nhắn người khác/tin đã thu hồi) |
| **DELETE** | `/api/messages/:id` | Thu hồi mềm tin nhắn (đánh dấu `isRecall = true`, ẩn nội dung, không xóa trong DB) |

#### Ví dụ Body:
- **POST `/api/messages`**:
  ```json
  {
    "conversationId": "65b21d5a...",
    "text": "Chào bạn, đây là slide báo cáo",
    "type": "file",
    "attachments": [
      {
        "url": "/uploads/bao-cao.pdf",
        "fileName": "bao-cao-123.pdf",
        "originalName": "bao-cao.pdf",
        "fileType": "file",
        "fileSize": 204800,
        "mimeType": "application/pdf"
      }
    ],
    "replyTo": "65b21d99...",
    "clientTempId": "temp-uuid-001"
  }
  ```
- **PATCH `/api/messages/:id`**:
  ```json
  { "text": "Nội dung tin nhắn đã được cập nhật" }
  ```

---

### 4.3. API Tải Lên Tệp & Ảnh (`/api/uploads`)

| Method | Endpoint | Content-Type | Mô tả |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/uploads` | `multipart/form-data` | Tải lên 1 hoặc nhiều tệp/ảnh bằng Multer |

- **Giới hạn kích thước**: Tối đa 25MB / tệp.
- **Loại tệp hỗ trợ**:
  - Ảnh: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`.
  - Tài liệu & lưu trữ: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`, `.zip`, `.rar`, `.7z`.
- **Response**: Trả về đường dẫn truy cập tĩnh (`/uploads/tên_file.ext`), mimeType, kích thước, và loại (`image` hoặc `file`).

---

## 5. Hướng Dẫn Cài Đặt & Chạy Thử

### 5.1. Khởi chạy MongoDB
Có thể sử dụng Docker Compose có sẵn:
```bash
docker compose up -d
```
Hoặc sử dụng MongoDB Server đã cài trên máy tại `mongodb://localhost:27017/ptitchat`.

### 5.2. Cài đặt Dependencies & Chạy Server
```bash
cd backend
npm install
npm run dev
```

Server sẽ khởi động tại `http://localhost:5000`.

### 5.3. Chạy Toàn Bộ Test Suite Tự Động
```bash
cd backend
npm test
```
Bộ test bao gồm 26 test case kiểm tra toàn bộ luồng nghiệp vụ:
- Đăng ký & sinh JWT
- Tạo hội thoại 1-1 & nhóm
- Chống tạo trùng 1-1
- Thêm/xóa thành viên, đổi tên nhóm
- Phân quyền (chặn người ngoài đọc/sửa/gửi tin)
- Gửi tin nhắn text, đính kèm metadata file, reply tin nhắn
- Chống trùng lặp tin nhắn (`clientTempId`)
- Chỉnh sửa tin nhắn
- Thu hồi mềm tin nhắn và ẩn nội dung
- Tìm kiếm tin nhắn
- Upload tệp bằng Multer và kiểm tra định dạng/kích thước

