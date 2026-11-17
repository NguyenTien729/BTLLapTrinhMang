# PTITChat

Giao diện nhắn tin bằng **React + Vite**, tiếng Việt, tông đỏ PTIT. Có đăng nhập/đăng ký, chat cá nhân và nhóm, tìm kiếm, trạng thái Online/Offline, thời gian tin nhắn, gửi ảnh/tệp, tải tệp, emoji và chỉnh sửa hồ sơ.

## Chạy dự án

Yêu cầu Node.js 20.19+, 22.13+ hoặc 24+.

```powershell
cd "C:\Users\asus\Downloads\Frontend LTM\ptitchat"
npm install
npm run dev
```

Mở URL Local mà Vite in ra, thường là **http://127.0.0.1:5173**. Chọn **Trải nghiệm bản demo** để mở ngay giao diện đầy đủ.

Tài khoản mẫu: **minhanh / ptitchat123**. Các tài khoản máy chủ mẫu khác: `hoangnam`, `phuongthao`, `minhduc`, `khanhlinh`, `quanghuy`, cùng mật khẩu `ptitchat123`.

## Chat thời gian thực giữa hai tài khoản

Mở terminal thứ hai tại thư mục dự án:

```powershell
npm run server
```

Đăng xuất demo, bật **Kết nối máy chủ Node.js** ở màn hình đăng nhập. Đăng nhập `minhanh` ở cửa sổ thứ nhất và `hoangnam` ở cửa sổ ẩn danh/thứ hai. Gửi tin trong nhóm **Đồ án tốt nghiệp** hoặc tạo cuộc trò chuyện cá nhân. Tin nhắn, trạng thái Online/Offline và trạng thái đang nhập đồng bộ qua Socket.IO. Tài khoản mới có thể đăng ký khi bật chế độ máy chủ.

Vite chuyển tiếp `/api` và `/socket.io` tới `http://127.0.0.1:3001`. Chạy cả frontend và backend để sử dụng chế độ máy chủ. Dữ liệu máy chủ lưu trong `server/data/database.json`; mật khẩu được băm bằng bcrypt, API bảo vệ bằng JWT. Đây là máy chủ mẫu cho đồ án; khi triển khai thực tế cần HTTPS, cơ sở dữ liệu và nơi lưu tệp phù hợp. Đổi các tài khoản/mật khẩu mẫu trước khi sử dụng thực tế.

## Hai chế độ dữ liệu

- **Demo:** người dùng và tin nhắn lưu bằng localStorage, tệp bằng IndexedDB. Mật khẩu tài khoản tự đăng ký được băm SHA-256 với salt cho việc dùng thử trên máy. Trạng thái Online và tin nhắn có sẵn là dữ liệu minh họa; không có phản hồi giả tự động. Dữ liệu chat đồng bộ giữa các tab cùng trình duyệt. Không dùng demo để lưu thông tin nhạy cảm.
- **Máy chủ:** đăng ký/đăng nhập qua REST API; tin nhắn và trạng thái cập nhật qua Socket.IO; dữ liệu lưu trên máy chủ. Tệp tối đa 5 MB, ảnh đại diện tối đa 1 MB. Hồ sơ mẫu có tài liệu PDF minh họa.

Bản frontend tĩnh được xuất bản dùng chế độ demo; backend Express/Socket.IO chạy riêng theo hướng dẫn trên. Để triển khai frontend với backend riêng, cấu hình reverse proxy cùng origin cho `/api` và `/socket.io`.

## Lệnh kiểm tra

```powershell
npm run build
npm test
```

`npm test` kiểm tra đăng ký/đăng nhập, bảo vệ thành viên, tạo nhóm, tệp, lưu dữ liệu và nhận tin nhắn Socket.IO thực tế. `npm run preview` xem bản build tĩnh tại máy.

## API

| Phương thức | Endpoint | Chức năng |
| --- | --- | --- |
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/users` | Danh bạ và trạng thái |
| PATCH | `/api/me` | Cập nhật hồ sơ |
| GET / POST | `/api/conversations` | Danh sách / tạo cuộc trò chuyện |
| PATCH | `/api/conversations/:id` | Sửa tên, giới thiệu nhóm |
| POST | `/api/conversations/:id/messages` | Gửi tin nhắn, ảnh, tệp |

Các API ngoài xác thực và health yêu cầu `Authorization: Bearer <token>`. Socket.IO dùng `auth: { token }`, các sự kiện `message`, `conversation`, `presence`, `profile`, `typing`.

Ảnh minh họa sân trường từ Unsplash. Font Be Vietnam Pro từ Google Fonts; có font hệ thống dự phòng. Không có thông tin tài khoản thật trong dữ liệu mẫu.
