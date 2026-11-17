# PTITChat — phần Authentication & User của Tiến

Node.js 22+, MongoDB chạy tại máy hoặc MongoDB Atlas. Backend dùng Express, Mongoose, bcrypt và JWT; frontend dùng React + Vite.

## Chạy backend

Trong PowerShell:

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Điền chuỗi ngẫu nhiên vừa tạo vào `JWT_SECRET` trong `.env`, cấu hình `MONGO_URI` nếu cần, sau đó chạy `npm.cmd run dev`. API mặc định tại `http://localhost:5000`. Không đưa `.env` lên Git.

## Chạy frontend

Mở terminal thứ hai:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Mở địa chỉ Vite hiển thị (mặc định `http://localhost:5173`). Vite chuyển tiếp `/api` sang backend. Khi triển khai production, cấu hình reverse proxy tương tự. `CLIENT_ORIGIN` của backend phải khớp địa chỉ frontend.

Trang `/register` tạo tài khoản và đăng nhập tự động; `/login` đăng nhập bằng email; `/` là trang hồ sơ và tìm kiếm để thử API trước khi tích hợp giao diện chat của Sơn. Token lưu trong `sessionStorage`, hết hạn sau 1 ngày. Đăng xuất xóa token phía client; JWT đã phát vẫn có hiệu lực đến hết hạn. Chưa có thu hồi token phía server.

## API contract

| Method | Endpoint                  | Body / kết quả                                           |
| ------ | ------------------------- | -------------------------------------------------------- |
| POST   | `/api/auth/register`      | `{username,email,password}` → `{token,user}` (201)       |
| POST   | `/api/auth/login`         | `{email,password}` → `{token,user}`                      |
| GET    | `/api/users/me`           | → `{user}`                                               |
| PUT    | `/api/users/me`           | Một hoặc nhiều trường `{username,avatar,bio}` → `{user}` |
| GET    | `/api/users/search?q=...` | → `{users}` tối đa 20 kết quả, không gồm chính mình      |

Các API `/api/users` yêu cầu header `Authorization: Bearer <token>`. Lỗi trả `{message}` với mã 400/401/409/429/500. User có `_id`, `username`, `email`, `avatar`, `bio`, `lastSeen`, timestamps; không trả `passwordHash`. Email là duy nhất, tên hiển thị được phép trùng. Avatar hiện nhận URL HTTP/HTTPS; upload file do module upload của Tùng cung cấp.

JWT dùng HS256, `sub` là ID người dùng, `iss=ptitchat`, `aud=ptitchat-client`. Ninh cần dùng cùng secret, thuật toán, issuer và audience khi xác thực Socket.IO. `lastSeen` hiện được cập nhật lúc đăng nhập; module presence của Ninh sẽ cập nhật khi ngắt kết nối.

## Kiểm tra

Backend: `npm.cmd test`. Các test HTTP dùng mock thao tác database, kiểm tra hash mật khẩu, trùng email, đăng nhập, JWT sai/hết hạn, bảo vệ hồ sơ và tìm kiếm. Cần MongoDB thật để kiểm tra lưu trữ và tích hợp toàn hệ thống.

Frontend: `npm.cmd run build`. Thử thủ công hai tài khoản: đăng ký, đăng xuất, đăng nhập sai/đúng mật khẩu, sửa hồ sơ, tìm email tài khoản còn lại, tải lại trang và truy cập `/` sau đăng xuất.

cd C:\Users\Lenovo\BTLLapTrinhMang\backend
& "C:\Users\Lenovo\npm\node.exe" server.js

$env:Path = "C:\Users\Lenovo\npm;$env:Path"
npm.cmd run dev
