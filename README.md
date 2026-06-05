# PoseAlert-AIoT

# 🤖 PoseAlert AI — Hệ thống cảnh báo tư thế ngồi học Realtime

\*\*Ứng dụng Web tĩnh giám sát và cảnh báo tư thế ngồi học của sinh viên theo thời gian thực.

## 👥 Thành viên nhóm

| Thành viên       | Mã SV      |
| ---------------- | ---------- |
| Vũ Thị Thảo Ngân | B25DCTV058 |
| Vũ Thị Ngọc Mai  | B25DCTV052 |
| Nguyễn Thùy Linh | B25DCTV048 |
| Trần Đình Phúc   | B25DCTV061 |

---

## 📖 Giới thiệu

**PoseAlert AI** là một ứng dụng web chạy hoàn toàn trên trình duyệt, sử dụng thư viện **MediaPipe Pose** để phân tích hình ảnh từ webcam và phát hiện các tư thế ngồi sai phổ biến của sinh viên trong quá trình học tập. Khi phát hiện tư thế sai kéo dài, hệ thống sẽ tự động phát cảnh báo kèm hướng dẫn khắc phục từ **Trợ lý AI** tích hợp sẵn.

---

## ✨ Tính năng chính

### 🎯 Core AI — Nhận diện tư thế realtime

- Phân tích **33 điểm landmarks** cơ thể người từ webcam qua MediaPipe Pose
- Vẽ khung xương đè lên camera với hiệu ứng **Mirror Mode** trực quan
- Phát hiện **3 loại tư thế sai** theo công thức toán học:

| Tư thế sai           | Phương pháp tính                                | Ngưỡng cảnh báo |
| -------------------- | ----------------------------------------------- | --------------- |
| **Cúi đầu**          | Góc cổ = `atan2(dy, dx)` giữa Tai và Vai        | < 65°           |
| **Vẹo lưng**         | Độ lệch trục Y giữa Vai trái và Vai phải        | > 30px          |
| **Mắt gần màn hình** | Tỉ lệ khoảng cách 2 mắt / chiều rộng khung hình | > 20%           |

### ⏱️ Timer Cảnh báo thông minh

- Đếm giây liên tục khi phát hiện tư thế sai
- Sau 30 giây liên tục sai tư thế: phát âm thanh cảnh báo (Web Audio API) + hiện popup
- **Trợ lý AI** cập nhật lời khuyên ngay từ giây đầu phát hiện sai tư thế
- Cơ chế **khóa trạng thái thông minh**: giữ nguyên hướng dẫn chi tiết đến khi người dùng ngồi đúng liên tục 10 giây

### 🧠 Trợ lý AI PoseAlert

- **5 trạng thái phản hồi** khác nhau: `idle`, `good`, `bad_realtime`, `bad_alert`, `break`
- Cảnh báo sai tư thế kèm **tác hại y khoa** và **hướng dẫn sửa từng bước**
- Trong phiên nghỉ Pomodoro: hiển thị bài tập giãn cơ cổ vai gáy, thư giãn mátxa mắt, mẹo tránh xao nhãng, thư giãn đầu óc
- Kèm link tài nguyên video YouTube và tài liệu hướng dẫn tư thế ngồi học đúng cách của các bệnh viện y khoa

### 📊 Dashboard Thống kê

- **Biểu đồ tròn (Doughnut)**: tỉ lệ 4 trạng thái tư thế cập nhật realtime mỗi giây
- **Biểu đồ đường (Line Chart)**: % ngồi đúng theo từng phút
- Hiển thị thời gian tích lũy theo dạng "X phút Y giây" cho từng tư thế
- **Xuất báo cáo PNG** toàn bộ lịch sử bằng kỹ thuật Hidden Canvas Clone

### 🍅 Pomodoro Timer

- Chu kỳ **25 phút tập trung → 5 phút nghỉ** tự động
- Nút "Nghỉ nhanh 5p" để test nhanh chế độ nghỉ mà không cần chờ
- Trong phiên nghỉ: Trợ lý AI tự động hiển thị hướng dẫn thư giãn phù hợp

### 🌙 Dark Mode

- Chuyển đổi chủ đề Light/Dark bằng một click vào nút bóng đèn trên Header

---

## 🛠️ Công nghệ sử dụng

| Công nghệ                     | Mục đích                        | Nguồn            |
| ----------------------------- | ------------------------------- | ---------------- |
| **HTML5 / CSS3 / JS Vanilla** | Nền tảng web tĩnh               | —                |
| **MediaPipe Pose**            | Nhận diện 33 landmarks cơ thể   | CDN jsdelivr     |
| **Chart.js 4.4.3**            | Vẽ biểu đồ Doughnut + Line      | CDN jsdelivr     |
| **chartjs-plugin-zoom**       | Pan/Scroll biểu đồ              | CDN jsdelivr     |
| **Hammer.js**                 | Gesture handler cho zoom plugin | CDN jsdelivr     |
| **Web Audio API**             | Tạo âm thanh cảnh báo           | Browser built-in |
| **Google Fonts**              | Inter + JetBrains Mono          | CDN Google       |

---

## 📁 Cấu trúc thư mục

```
Project_PoseAlert/
│
├── 📄 README.md
│
├── 📂 html/
│   └── index.html          ← File HTML chính (mở file này để chạy)
│
├── 📂 css/
│   ├── style.css           ← Stylesheet chính
│   ├── timer.css           ← Style cho Timer + Trợ lý AI
│   ├── dashboard.css       ← Style cho Dashboard Chart.js
│   └── pomodoro.css        ← Style cho Pomodoro Timer
│
├── 📂 js/
    ├── pose_logic.js       ← [Core AI] Thuật toán phân tích tư thế
    ├── main.js             ← [Core AI] Khởi tạo camera & MediaPipe
    ├── timer.js            ← Timer cảnh báo 30s + Trợ lý AI
    ├── dashboard.js        ← Dashboard thống kê Chart.js
    └── pomodoro.js         ← Đồng hồ Pomodoro 25/5 phút

---

## 🚀 Hướng dẫn chạy dự án

### Yêu cầu

- Trình duyệt hiện đại: **Chrome 90+** hoặc **Edge 90+** (khuyên dùng)
- Có **Webcam** và đã cấp quyền truy cập camera cho trình duyệt
- Kết nối **Internet** (để tải các thư viện qua CDN lần đầu)

### Các bước chạy

1. Clone hoặc tải về toàn bộ thư mục Project_PoseAlert
2. Mở thư mục bằng VS Code
3. Cài extension "Live Server" nếu chưa có
4. Click chuột phải vào html/index.html → "Open with Live Server"
5. Trình duyệt tự mở tại http://127.0.0.1:5500/html/index.html

```

### Sử dụng ứng dụng

```

1. Trang tải xong → Click "▶ Bắt đầu học"
2. Cấp quyền truy cập camera khi trình duyệt hỏi
3. Ngồi vào đúng khung hình camera (nhìn thấy khung xương màu xanh lá)
4. Hệ thống tự động giám sát và cảnh báo khi tư thế sai > 30 giây
5. Bấm "⏸ Tạm dừng" để tắt camera khi không dùng

```
