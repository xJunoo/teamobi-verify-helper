# TeaMobi Verify Helper — Chrome extension

## Cài trong profile Chrome bạn đang dùng

1. Mở `chrome://extensions` trong Chrome/profile bạn hay dùng.
2. Bật **Developer mode / Chế độ nhà phát triển**.
3. Bấm **Load unpacked / Tải tiện ích đã giải nén**, chọn thư mục `teamobi-extension`.
4. Bấm icon extension để mở tab **Quản lý xác thực**, chọn TXT UTF-8 dạng `tài_khoản|mật_khẩu`, bấm **Bắt đầu xử lý**. Bấm icon lần nữa sẽ quay lại tab bảng kết quả hiện có.

## Chuyển tài khoản

Tool tìm liên kết đăng xuất trong menu profile, đăng xuất rồi mở lại trang login để đổi tài khoản. Nếu menu chưa mở, tool mở profile để tìm liên kết. Không xác nhận được đăng xuất thì dừng để tránh dùng nhầm tài khoản. Extension không xóa cookie trực tiếp và không cần quyền cookies.

Nút **Clear data** trên dashboard dừng lượt đang chạy, xóa danh sách tài khoản và kết quả trong bộ nhớ extension. Không xóa file TXT hoặc cookie. Reload extension và tải lại dashboard sau khi cập nhật.
