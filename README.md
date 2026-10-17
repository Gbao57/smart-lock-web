# 🔒 Smart Lock IoT System (ESP32 + Web Frontend + AI Face ID)

Hệ thống khóa cửa thông minh tích hợp nhận diện khuôn mặt qua Camera thiết bị (Laptop/Điện thoại), quản lý trạng thái thời gian thực qua **Firebase Realtime Database** và điều khiển phần cứng thực tế bằng **ESP32**.

## 🌟 Tính năng nổi bật
- 👁️ **Nhận diện khuôn mặt thật:** Sử dụng Webcam thiết bị trực tiếp qua trình duyệt Web.
- 🚪 **Mô hình Cánh cửa 3D:** Tương tác trực quan bằng Three.js, xoay mở khớp mượt mà đồng bộ với trạng thái khóa.
- 🔑 **Bàn phím PIN & Cảnh báo an ninh:** Nhập mã PIN có hiệu ứng rung (Shake) và tự động khóa hệ thống 30 giây kèm kích hoạt còi hú khi nhập sai quá 3 lần.
- 🟢 **Giám sát ESP32 Online/Offline:** Theo dõi trạng thái kết nối phần cứng thời gian thực.
- ☁️ **Cloud Backend (Phương án A):** Đồng bộ dữ liệu tốc độ cao qua Firebase Realtime Database.

## 🛠️ Công nghệ sử dụng
- **Frontend:** HTML5, CSS3, JavaScript (ES6), Three.js, Firebase v8 SDK.
- **Hardware:** ESP32 / ESP32-CAM, Relay, Buzzer (Lập trình qua Arduino IDE).
- **Hosting:** GitHub Pages.