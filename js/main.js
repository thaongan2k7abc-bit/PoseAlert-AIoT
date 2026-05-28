/**
 * MÔ TẢ: Khởi tạo Camera, MediaPipe Pose, và vòng lặp vẽ canvas
 */
// ----------------------------------------------------------------
// 1. LẤY CÁC PHẦN TỬ DOM
// ----------------------------------------------------------------
const videoElement = document.getElementById("input-video");
const canvasElement = document.getElementById("output-canvas");
const canvasCtx = canvasElement.getContext("2d");
const loadingOverlay = document.getElementById("loading-overlay");

// ----------------------------------------------------------------
// 2. KHỞI TẠO MEDIAPIPE POSE
// ----------------------------------------------------------------

/**
 * locateFile: Chỉ cho MediaPipe biết nơi tải các file WASM/model từ CDN.
 * Đây là bắt buộc khi dùng CDN thay vì npm.
 */
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  },
});

// Cấu hình tham số MediaPipe Pose
pose.setOptions({
  modelComplexity: 1, // 0=Lite, 1=Full, 2=Heavy — cân bằng tốc độ/độ chính xác
  smoothLandmarks: true, // Làm mượt chuyển động giữa các frame
  enableSegmentation: false, // Không cần tách nền, tắt để tăng hiệu suất
  smoothSegmentation: false,
  minDetectionConfidence: 0.5, // Ngưỡng tin cậy cho lần phát hiện đầu tiên
  minTrackingConfidence: 0.5, // Ngưỡng tin cậy cho các frame tiếp theo (tracking)
});

// Đăng ký callback: hàm này được gọi mỗi khi MediaPipe xử lý xong 1 frame
pose.onResults(onPoseResults);

// ----------------------------------------------------------------
// 3. KHỞI ĐỘNG CAMERA
// ----------------------------------------------------------------

/**
 * Camera utility của MediaPipe tự động lấy frame từ <video>
 * và đưa vào pose.send() theo vòng lặp requestAnimationFrame.
 * Đây là cách CHÍNH THỐNG để tránh canvas bị đóng băng (frozen).
 */
const camera = new Camera(videoElement, {
  onFrame: async () => {
    // Gửi mỗi frame video vào pipeline MediaPipe
    await pose.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});

// Bắt đầu camera và ẩn loading overlay khi xong
camera
  .start()
  .then(() => {
    console.log("[PoseAlert] Camera đã khởi động thành công.");
    if (loadingOverlay) {
      // Chờ thêm 1 giây để model WASM load xong hoàn toàn
      setTimeout(() => {
        loadingOverlay.classList.add("hidden");
      }, 1500);
    }
  })
  .catch((err) => {
    console.error("[PoseAlert] Không thể truy cập camera:", err);
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
                <div class="loading-inner">
                    <div class="loading-icon error-icon">⚠</div>
                    <p class="loading-text">Không thể truy cập Webcam.</p>
                    <p class="loading-sub">Vui lòng cấp quyền camera và tải lại trang.</p>
                </div>`;
    }
  });

// ----------------------------------------------------------------
// 4. CALLBACK XỬ LÝ KẾT QUẢ - HÀM QUAN TRỌNG NHẤT
// ----------------------------------------------------------------

/**
 * Được gọi mỗi frame (~30fps) sau khi MediaPipe xử lý xong.
 * Thực hiện 3 việc: (1) Vẽ camera, (2) Vẽ khung xương, (3) Phân tích tư thế.
 *
 * @param {Object} results - Kết quả từ MediaPipe, gồm:
 *   - results.image        : ImageBitmap của frame hiện tại
 *   - results.poseLandmarks: Mảng 33 landmarks (nếu phát hiện được người)
 */
function onPoseResults(results) {
  // --- 4.1 Đồng bộ kích thước canvas với frame thực tế ---
  // QUAN TRỌNG: Nếu không set kích thước động, canvas sẽ bị stretch/crop,
  // dẫn đến khung xương bị lệch so với người thật.
  canvasElement.width = results.image.width;
  canvasElement.height = results.image.height;

  // Lưu trạng thái canvas trước khi vẽ
  canvasCtx.save();

  // --- 4.2 Xóa canvas frame trước ---
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // --- 4.3 Vẽ hình ảnh từ camera lên canvas ---
  // results.image là frame gốc từ webcam, vẽ làm nền
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height,
  );

  // --- 4.4 Vẽ khung xương nếu phát hiện được người ---
  if (results.poseLandmarks) {
    // VẼ CÁC ĐƯỜNG NỐI KHUNG XƯƠNG (màu xanh lá)
    // POSE_CONNECTIONS là mảng cặp [idx_a, idx_b] định nghĩa sẵn trong MediaPipe
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#00FF88", // Xanh lá neon
      lineWidth: 2.5,
    });

    // VẼ CÁC ĐIỂM KHỚP (chấm đỏ)
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "#FF4444", // Đỏ
      fillColor: "#FF000088",
      lineWidth: 1,
      radius: 4,
    });

    // --- 4.5 Gọi module phân tích tư thế (từ pose_logic.js) ---
    // Hàm này sẽ cập nhật các biến toàn cục:
    //   currentPoseStatus, currentNeckAngle, currentShoulderDiff
    analyzePose(
      results.poseLandmarks,
      canvasElement.width,
      canvasElement.height,
    );

    // --- 4.6 Vẽ chú thích debug trực tiếp lên canvas (tùy chọn) ---
    drawDebugOverlay(results.poseLandmarks);
  } else {
    // Không tìm thấy người trong khung hình
    currentPoseStatus = "CHƯA PHÁT HIỆN";
    currentNeckAngle = 0;
    currentShoulderDiff = 0;
    updateStatusUI();
  }

  // Khôi phục trạng thái canvas
  canvasCtx.restore();
}

// ----------------------------------------------------------------
// 5. VẼ DEBUG OVERLAY (Chú thích điểm quan trọng lên canvas)
// ----------------------------------------------------------------

/**
 * Vẽ nhãn chú thích cho các điểm landmarks quan trọng (Tai, Vai)
 * và hiển thị giá trị góc trực tiếp lên canvas để dễ debug.
 *
 * @param {Array} landmarks - Mảng landmarks từ MediaPipe
 */
function drawDebugOverlay(landmarks) {
  const w = canvasElement.width;
  const h = canvasElement.height;

  canvasCtx.font = "bold 12px 'JetBrains Mono', monospace";
  canvasCtx.textBaseline = "bottom";

  // Danh sách điểm cần chú thích
  const labelMap = {
    7: "Tai T",
    8: "Tai P",
    11: "Vai T",
    12: "Vai P",
  };

  Object.entries(labelMap).forEach(([idx, label]) => {
    const lm = landmarks[parseInt(idx)];
    if (!lm || (lm.visibility ?? 1) < 0.3) return;

    const x = lm.x * w;
    const y = lm.y * h;

    // Vẽ nền mờ cho chữ để dễ đọc
    canvasCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
    const textW = canvasCtx.measureText(label).width;
    canvasCtx.fillRect(x + 6, y - 16, textW + 4, 16);

    // Vẽ chữ
    canvasCtx.fillStyle = "#FFD700"; // Vàng gold
    canvasCtx.fillText(label, x + 8, y - 2);
  });

  // Hiển thị góc cổ và lệch vai ở góc trên trái canvas
  const lineH = 22;
  const pad = 10;
  const lines = [
    `Góc cổ: ${currentNeckAngle.toFixed(1)}°  ${currentNeckAngle < 65 ? "⚠" : "✓"}`,
    `Lệch vai: ${currentShoulderDiff.toFixed(1)}px  ${currentShoulderDiff > 30 ? "⚠" : "✓"}`,
  ];

  const maxW = 220;
  canvasCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  canvasCtx.fillRect(pad, pad, maxW, lineH * lines.length + pad);

  canvasCtx.font = "13px 'JetBrains Mono', monospace";
  lines.forEach((txt, i) => {
    canvasCtx.fillStyle =
      i === 0
        ? currentNeckAngle < 65
          ? "#FF6B6B"
          : "#00FF88"
        : currentShoulderDiff > 30
          ? "#FF6B6B"
          : "#00FF88";
    canvasCtx.fillText(txt, pad + 6, pad + lineH * (i + 1));
  });
}
