# PTITChat Frontend

React + Vite + Tailwind CSS. Giao diện dùng API và Socket.IO của backend MongoDB cổng 5000.

Từ thư mục gốc, cài và khởi động backend theo `../README.md`, sau đó:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Mở `http://localhost:5173`, đăng ký bằng email rồi tìm bạn bè để tạo hội thoại/nhóm. Vite chuyển tiếp `/api`, `/uploads`, `/socket.io` tới backend. Không có tài khoản mẫu mặc định trong MongoDB.

```powershell
npm.cmd test
npm.cmd run build
```

Test giao diện cần dependencies của cả backend và frontend; chạy React với Express, Socket.IO và MongoDB tạm. Xem README ở thư mục gốc để cấu hình môi trường, chạy Docker Compose và mô tả API.
