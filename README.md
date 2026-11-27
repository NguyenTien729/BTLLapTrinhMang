# PTITChat — Nhóm 13

Ứng dụng nhắn tin dùng React + Vite + Tailwind CSS, Express, MongoDB/Mongoose, JWT/bcrypt, Socket.IO và Multer. Giao diện gọi chung backend MongoDB ở cổng 5000; tài khoản, hội thoại và lịch sử không còn phụ thuộc server mẫu cổng 3001.

## Chạy tại máy

Cần Node.js 22.13+ và MongoDB local hoặc MongoDB Atlas. Chạy các lệnh dưới đây từ thư mục gốc dự án.

Terminal 1:

```powershell
cd backend
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Điền chuỗi ngẫu nhiên vừa tạo vào `JWT_SECRET` trong `backend/.env`. Đặt `MONGO_URI` tới MongoDB của bạn, mặc định `mongodb://127.0.0.1:27017/ptitchat`. Giữ `.env` hiện có nếu đã cấu hình. Sau đó:

```powershell
npm.cmd run dev
```

Nếu có Docker và muốn chỉ chạy MongoDB local, mở terminal tại thư mục gốc sau khi cấu hình `backend/.env`:

```powershell
docker compose --env-file backend/.env up -d mongodb
```

Terminal 2:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Mở `http://localhost:5173`. Đăng ký hai tài khoản với hai email khác nhau; mật khẩu từ 8 ký tự, tối đa 72 byte. Dùng hai trình duyệt hoặc một cửa sổ ẩn danh để thử chat. Dữ liệu demo trong trình duyệt/server JSON cũ không được tự động chuyển thành tài khoản MongoDB.

Nếu terminal máy hiện tại chưa nhận `node`/`npm`, chạy `$env:Path = "C:\Users\Lenovo\npm;$env:Path"` trước các lệnh npm. Máy khác dùng đường dẫn cài Node.js của máy đó.

Tùy chọn: `npm.cmd run seed` trong `backend` bổ sung bốn tài khoản mẫu và nhóm 13 mà không xóa dữ liệu hiện có. Các tài khoản mới có email `tung@ptit.edu.vn`, `tien@ptit.edu.vn`, `son@ptit.edu.vn`, `ninh@ptit.edu.vn`, mật khẩu `password123`. `npm.cmd run demo` thử luồng realtime với ba tài khoản demo mới khi backend đang chạy.

## Cách sử dụng

- Đăng nhập bằng email. Đăng xuất hoặc JWT hết hạn sẽ xóa phiên và trở về màn hình đăng nhập.
- Chọn cuộc trò chuyện mới, tìm người dùng bằng tên/email để chat riêng. Tạo nhóm bằng cách chọn ít nhất hai người khác.
- Gửi tin nhắn, ảnh và tệp (tối đa 25 MB mỗi tệp). Ảnh đại diện tối đa 1 MB. Tệp được tải lên bằng Multer trước khi gửi metadata tin nhắn.
- Dùng nút **Trả lời**, **Sửa**, **Thu hồi** dưới tin nhắn. Thu hồi giữ bản ghi trong database và ẩn nội dung khỏi kết quả gửi về client.
- **Đã gửi** xuất hiện khi máy chủ xác nhận. **Đã xem** xuất hiện sau khi ít nhất một người nhận mở hội thoại và gửi xác nhận đọc các tin đã tải.
- Tìm kiếm trong hội thoại gọi API MongoDB, có phân trang. Nút tải tin cũ lấy các trang lịch sử trước đó.
- Tin mới ở hội thoại khác hiện thông báo trong ứng dụng. Có thể tắt thông báo từng hội thoại.
- Tin gửi khi mất kết nối được giữ trong hàng chờ của tài khoản trong `sessionStorage`. Khi kết nối lại, client gửi lại cùng `clientTempId`; unique index trên `(conversationId, sender, clientTempId)` ngăn tạo thêm bản ghi. Đóng hẳn phiên trình duyệt có thể làm mất hàng chờ chưa gửi.

## Kiểm thử

Cài dependencies của cả `backend` và `frontend` trước khi chạy test giao diện tích hợp.

```powershell
cd backend
npm.cmd test
npm.cmd run test:socket
cd ../frontend
npm.cmd test
npm.cmd run build
```

Các test tích hợp khởi động MongoDB tạm với database tên ngẫu nhiên, không dùng `backend/.env` và không xóa dữ liệu ứng dụng. Lần đầu công cụ tải MongoDB vào `.mongodb-binaries/`, cần Internet; các lần sau dùng bản đã lưu. Có thể đặt `MONGODB_URI_TEST` để dùng MongoDB có sẵn, test vẫn tạo database riêng.

Test kiểm tra xác thực, quyền nhóm, HTTP ↔ Socket.IO, gửi đồng thời cùng mã chống trùng, đã xem, sửa/thu hồi/trả lời, upload, reconnect, nhiều tab và thao tác React với backend thật. Test UI mô phỏng mất ACK sau khi database đã lưu rồi kết nối lại và xác nhận chỉ có một tin nhắn.

## Chạy cả hệ thống bằng Docker Compose

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Điền secret ngẫu nhiên ít nhất 32 byte vào `JWT_SECRET` của `.env` ở thư mục gốc. Giữ file nếu đã tồn tại. Sau đó:

```powershell
docker compose up --build -d
```

Mở `http://localhost:8080`. Compose chạy MongoDB, backend và frontend Nginx; Nginx chuyển tiếp `/api`, `/uploads`, `/socket.io` tới backend. Volumes `mongo_data` và `uploads` giữ database và tệp khi khởi động lại container. Có thể chạy hai tài khoản từ hai máy qua `http://<IP-máy-chủ>:8080`; đặt `CLIENT_ORIGIN` trong `.env` theo địa chỉ frontend rồi khởi động lại backend nếu cần. Docker chưa được kiểm tra chạy trên máy hiện tại vì chưa có lệnh Docker.

## API và realtime

Các API riêng tư dùng `Authorization: Bearer <token>`. JWT HS256 có `sub`, `iss=ptitchat`, `aud=ptitchat-client`, thời hạn 1 ngày; Socket.IO dùng cùng quy tắc qua `auth: { token }`.

| Method         | Endpoint                                        | Mục đích                                   |
| -------------- | ----------------------------------------------- | ------------------------------------------ |
| POST           | `/api/auth/register`, `/api/auth/login`         | Đăng ký, đăng nhập                         |
| GET / PUT      | `/api/users/me`                                 | Đọc / sửa hồ sơ                            |
| GET            | `/api/users/search?q=`                          | Tìm tên hoặc email                         |
| GET            | `/api/users`                                    | Danh bạ                                    |
| GET / POST     | `/api/conversations`                            | Danh sách / tạo chat riêng (`recipientId`) |
| POST           | `/api/conversations/group`                      | Tạo nhóm (`name`, `members`)               |
| PATCH          | `/api/conversations/:id`                        | Sửa nhóm và quản lý thành viên             |
| GET            | `/api/messages/:conversationId?page=1&limit=30` | Lịch sử                                    |
| POST           | `/api/messages`                                 | Gửi tin, dùng chung service với Socket.IO  |
| PATCH / DELETE | `/api/messages/:id`                             | Sửa / thu hồi mềm                          |
| GET            | `/api/messages/search?q=&conversationId=`       | Tìm tin nhắn có kiểm tra quyền             |
| POST           | `/api/uploads`                                  | Tải tệp dạng multipart, field `file`       |

Client gửi các event `conversation:join`, `conversation:leave`, `message:send`, `message:edit`, `message:revoke`, `message:seen`, `typing:start`, `typing:stop`. Server phát `message:new`, `message:edited`, `message:revoked`, `message:seen`, `notification:new`, `user:online`, `user:offline`, `presence:list`, `conversation:updated`, `conversation:removed`, `profile:updated`, `user:new`, `auth:expired`.

Mỗi tài khoản có room `user:<id>` để nhận cập nhật ở mọi tab; room hội thoại dùng cho typing. Quyền thành viên được kiểm tra với mọi thao tác. Sau khi xóa thành viên, server loại socket khỏi room hội thoại và dừng phát tin qua room riêng của người đó. Online/offline tính theo số socket còn mở của tài khoản.

`backend/demo-server` được giữ như mã tham khảo cũ và chỉ chạy bằng `npm run server:legacy`. Lệnh `npm run server`, `npm start`, `npm run dev` đều dùng backend MongoDB thống nhất.

$env:Path = "C:\Users\Lenovo\npm;$env:Path"
npm.cmd run dev
