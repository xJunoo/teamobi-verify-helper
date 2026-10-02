# TeaMobi Verify Helper — Chrome extension

## Cài trong profile Chrome bạn đang dùng

1. Mở `chrome://extensions` trong Chrome/profile bạn hay dùng.
2. Bật **Developer mode / Chế độ nhà phát triển**.
3. Bấm **Load unpacked / Tải tiện ích đã giải nén**, chọn thư mục `teamobi-extension`.
4. Bấm icon extension để mở tab **Quản lý xác thực**, chọn TXT UTF-8 dạng `tài_khoản|mật_khẩu`, bấm **Bắt đầu xử lý**. Bấm icon lần nữa sẽ quay lại tab bảng kết quả hiện có.

## Chuyển tài khoản

Tool xóa cookie của `my.teamobi.com` và cookie domain cha `.teamobi.com` áp dụng cho site này, rồi mở lại login; không bấm liên kết đăng xuất. Chỉ xử lý cookie store của tab đang chạy, giữ cookie của website khác. Cookie dùng chung `.teamobi.com` có thể ảnh hưởng phiên trên các subdomain TeaMobi khác. Việc xóa cookie có thể khiến Cloudflare yêu cầu xác minh lại.

Sau khi cập nhật, Reload extension và chấp nhận quyền `cookies` nếu Chrome yêu cầu. Nếu không xóa được cookie hoặc trang vẫn còn phiên cũ, tool dừng thay vì đăng nhập nhầm tài khoản.
