/**
 * MÔ TẢ: Thuật toán phân tích tư thế ngồi học realtime
 *         Sử dụng landmarks từ MediaPipe Pose
 * ============================================================
 */

// ================================================================
// BIẾN TOÀN CỤC
// Các module khác (Timer, Dashboard, Pomodoro) đọc trực tiếp.
// ================================================================

/** Trạng thái tư thế: "ĐÚNG" | "CÚI ĐẦU" | "MẮT GẦN MÀN HÌNH" | "VẸO LƯNG" | "CHƯA PHÁT HIỆN" */
var currentPoseStatus = "CHƯA PHÁT HIỆN";

/** Góc cổ (độ). Bình thường: >= 62° */
var currentNeckAngle = 0;

/** Độ lệch Y giữa 2 vai (px). Bình thường: <= 30px */
var currentShoulderDiff = 0;

/**
 * Tỉ lệ khoảng cách mắt (face width ratio).
 * = Khoảng cách 2 mắt (px) / Chiều rộng canvas
 * Càng lớn → mặt càng gần camera → ngồi quá gần màn hình.
 * Bình thường: <= 0.20  |  Quá gần: > 0.20
 */
var currentEyeDistanceRatio = 0;

// ================================================================
// NGƯỠNG PHÂN LOẠI
// ================================================================
const NECK_ANGLE_THRESHOLD = 61; // độ  — góc cổ < 62°
const EYE_DISTANCE_THRESHOLD = 0.2; //      — face ratio > 0.20    → MẮT GẦN MÀN HÌNH
const SHOULDER_DIFF_THRESHOLD = 30; // px   — lệch vai > 30px      → VẸO LƯNG

// ================================================================
// CHỈ SỐ LANDMARKS MEDIAPIPE POSE (33 điểm)
// ================================================================
const LANDMARK = {
  LEFT_EYE: 2, // Mắt trái
  RIGHT_EYE: 5, // Mắt phải
  LEFT_EAR: 7, // Tai trái
  LEFT_SHOULDER: 11, // Vai trái
  RIGHT_SHOULDER: 12, // Vai phải
};

// ================================================================
// HÀM TÍNH TOÁN TOÁN HỌC
// ================================================================

/**
 * Tính góc cổ dựa vào vị trí Tai và Vai.
 *
 * NGUYÊN LÝ (hệ tọa độ ảnh: Y tăng xuống dưới):
 *
 *   dy = shoulder.y - ear.y   → dương khi tai ở TRÊN vai (ngồi thẳng)
 *   dx = |shoulder.x - ear.x| → khoảng cách ngang tuyệt đối
 *
 *   Góc cổ = atan2(dy, dx) × (180 / π)
 *
 *   → Ngồi thẳng : dy lớn, dx nhỏ → góc ≈ 75°–90° ✔
 *   → Cúi đầu    : dy thu nhỏ      → góc < 65°    ✘
 */
function calculateNeckAngle(ear, shoulder) {
  const dy = shoulder.y - ear.y;
  const dx = Math.abs(shoulder.x - ear.x);
  return Math.max(0, Math.atan2(dy, dx) * (180 / Math.PI));
}

/**
 * Tính độ lệch trục Y giữa 2 vai.
 * Ngồi thẳng → 2 vai ngang nhau → hiệu ≈ 0
 * Vẹo lưng   → một vai cao hơn  → hiệu lớn
 */
function calculateShoulderDiff(leftShoulder, rightShoulder) {
  return Math.abs(leftShoulder.y - rightShoulder.y);
}

/**
 * Tính tỉ lệ khoảng cách 2 mắt so với chiều rộng canvas.
 *
 * NGUYÊN LÝ:
 *   Khi người dùng ngồi GẦN màn hình/camera:
 *     → Khuôn mặt chiếm diện tích LỚN hơn trên ảnh
 *     → Khoảng cách 2 mắt (tính bằng pixel) TĂNG lên
 *
 *   eyeDist = sqrt((lx-rx)² + (ly-ry)²)   ← khoảng cách Euclid 2 mắt
 *   ratio   = eyeDist / canvasWidth        ← chuẩn hoá theo khung hình
 *
 *   → Ngồi đúng khoảng cách (50-70cm) : ratio ≈ 0.08–0.16 ✔
 *   → Cúi gần quá (~30cm trở xuống)   : ratio > 0.20       ✘
 *
 *   Ưu điểm: không bị ảnh hưởng bởi độ phân giải camera hay tỉ lệ khung hình.
 *
 * @param {Object} leftEye  - Tọa độ mắt trái {x, y} (pixel)
 * @param {Object} rightEye - Tọa độ mắt phải {x, y} (pixel)
 * @param {number} canvasWidth - Chiều rộng canvas (pixel)
 * @returns {number} Tỉ lệ (không đơn vị), ví dụ: 0.14
 */
function calculateEyeDistanceRatio(leftEye, rightEye, canvasWidth) {
  const dx = leftEye.x - rightEye.x;
  const dy = leftEye.y - rightEye.y;
  // Khoảng cách Euclid giữa 2 mắt (pixel)
  const eyeDist = Math.sqrt(dx * dx + dy * dy);
  // Chia cho chiều rộng canvas để normalize
  return eyeDist / canvasWidth;
}

// ================================================================
// HÀM PHÂN TÍCH TƯ THẾ CHÍNH — gọi từ main.js
// ================================================================

/**
 * Phân tích tư thế từ landmarks và cập nhật biến toàn cục.
 *
 * Thứ tự ưu tiên phát hiện lỗi:
 *   1. CÚI ĐẦU          (nguy hiểm nhất cho cổ)
 *   2. MẮT GẦN MÀN HÌNH (hại mắt)
 *   3. VẸO LƯNG          (hại cột sống)
 *   4. ĐÚNG
 *
 * @param {Array}  landmarks    - 33 landmarks từ MediaPipe Pose
 * @param {number} canvasWidth  - Chiều rộng canvas (px)
 * @param {number} canvasHeight - Chiều cao canvas (px)
 */
function analyzePose(landmarks, canvasWidth, canvasHeight) {
  if (!landmarks || landmarks.length < 13) {
    currentPoseStatus = "CHƯA PHÁT HIỆN";
    currentNeckAngle = 0;
    currentShoulderDiff = 0;
    currentEyeDistanceRatio = 0;
    updateStatusUI();
    return;
  }

  // --- Quy đổi tọa độ normalized [0,1] → pixel ---
  const leftEye = {
    x: landmarks[LANDMARK.LEFT_EYE].x * canvasWidth,
    y: landmarks[LANDMARK.LEFT_EYE].y * canvasHeight,
  };
  const rightEye = {
    x: landmarks[LANDMARK.RIGHT_EYE].x * canvasWidth,
    y: landmarks[LANDMARK.RIGHT_EYE].y * canvasHeight,
  };
  const leftEar = {
    x: landmarks[LANDMARK.LEFT_EAR].x * canvasWidth,
    y: landmarks[LANDMARK.LEFT_EAR].y * canvasHeight,
  };
  const leftShoulder = {
    x: landmarks[LANDMARK.LEFT_SHOULDER].x * canvasWidth,
    y: landmarks[LANDMARK.LEFT_SHOULDER].y * canvasHeight,
  };
  const rightShoulder = {
    x: landmarks[LANDMARK.RIGHT_SHOULDER].x * canvasWidth,
    y: landmarks[LANDMARK.RIGHT_SHOULDER].y * canvasHeight,
  };

  // --- Kiểm tra visibility (bỏ qua nếu landmark bị khuất) ---
  const lEyeVis = landmarks[LANDMARK.LEFT_EYE].visibility ?? 1;
  const rEyeVis = landmarks[LANDMARK.RIGHT_EYE].visibility ?? 1;
  const earVis = landmarks[LANDMARK.LEFT_EAR].visibility ?? 1;
  const lShVis = landmarks[LANDMARK.LEFT_SHOULDER].visibility ?? 1;
  const rShVis = landmarks[LANDMARK.RIGHT_SHOULDER].visibility ?? 1;

  if (
    lEyeVis < 0.3 ||
    rEyeVis < 0.3 ||
    earVis < 0.3 ||
    lShVis < 0.3 ||
    rShVis < 0.3
  ) {
    currentPoseStatus = "KHÔNG RÕ";
    updateStatusUI();
    return;
  }

  // --- Tính 3 chỉ số ---
  currentNeckAngle = calculateNeckAngle(leftEar, leftShoulder);
  currentShoulderDiff = calculateShoulderDiff(leftShoulder, rightShoulder);
  currentEyeDistanceRatio = calculateEyeDistanceRatio(
    leftEye,
    rightEye,
    canvasWidth,
  );

  // --- Phân loại tư thế ---
  if (currentNeckAngle < NECK_ANGLE_THRESHOLD) {
    currentPoseStatus = "CÚI ĐẦU";
  } else if (currentEyeDistanceRatio > EYE_DISTANCE_THRESHOLD) {
    currentPoseStatus = "MẮT GẦN MÀN HÌNH";
  } else if (currentShoulderDiff > SHOULDER_DIFF_THRESHOLD) {
    currentPoseStatus = "VẸO LƯNG";
  } else {
    currentPoseStatus = "ĐÚNG";
  }

  updateStatusUI();
}

// ================================================================
// CẬP NHẬT GIAO DIỆN
// ================================================================

function updateStatusUI() {
  const statusBox = document.getElementById("status-box");
  const angleEl = document.getElementById("neck-angle-value");
  const shoulderEl = document.getElementById("shoulder-diff-value");
  const eyeEl = document.getElementById("eye-distance-value");
  const statusLabel = document.getElementById("status-label");

  if (angleEl) angleEl.textContent = currentNeckAngle.toFixed(1) + "°";
  if (shoulderEl)
    shoulderEl.textContent = currentShoulderDiff.toFixed(1) + " px";
  if (eyeEl)
    eyeEl.textContent = (currentEyeDistanceRatio * 100).toFixed(1) + "%";

  if (!statusBox || !statusLabel) return;

  statusLabel.textContent = currentPoseStatus;
  statusBox.classList.remove(
    "status-good",
    "status-bad",
    "status-warn",
    "status-unknown",
  );

  switch (currentPoseStatus) {
    case "ĐÚNG":
      statusBox.classList.add("status-good");
      break;
    case "CÚI ĐẦU":
    case "MẮT GẦN MÀN HÌNH":
    case "VẸO LƯNG":
      statusBox.classList.add("status-bad");
      break;
    case "KHÔNG RÕ":
      statusBox.classList.add("status-warn");
      break;
    default:
      statusBox.classList.add("status-unknown");
      break;
  }
}
