/**
 * ============================================================
 * FILE: main.js
 * MÔ TẢ: Khởi tạo Camera, MediaPipe Pose, vòng lặp vẽ canvas
 *         + Nút điều khiển Bắt đầu / Tạm dừng phiên học
 *
 * BIẾN TOÀN CỤC XUẤT RA (các module khác đọc):
 *   window.isSessionActive — true = đang học, false = đã tạm dừng
 * ============================================================
 */

// ----------------------------------------------------------------
// 1. BIẾN TOÀN CỤC TRẠNG THÁI PHIÊN HỌC
//    Timer, Dashboard sẽ đọc biến này để biết có nên tích luỹ không.
// ----------------------------------------------------------------
window.isSessionActive = false;

// ----------------------------------------------------------------
// 2. LẤY CÁC PHẦN TỬ DOM
// ----------------------------------------------------------------
const videoElement = document.getElementById("input-video");
const canvasElement = document.getElementById("output-canvas");
const canvasCtx = canvasElement.getContext("2d");
const loadingOverlay = document.getElementById("loading-overlay");

// ----------------------------------------------------------------
// 3. KHỞI TẠO MEDIAPIPE POSE (chỉ khai báo, chưa chạy)
// ----------------------------------------------------------------
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  smoothSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults(onPoseResults);

// ----------------------------------------------------------------
// 4. ẨN LOADING OVERLAY NGAY KHI TRANG TẢI XONG
//    Overlay chỉ che lúc trang đang parse JS/CSS.
//    Phải ẩn sớm để người dùng thấy nút "Bắt đầu học".
//    KHÔNG chờ camera — camera chỉ mở khi bấm nút.
// ----------------------------------------------------------------
window.addEventListener("load", () => {
  setTimeout(() => {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }, 800);
});

// ----------------------------------------------------------------
// 5. ĐỐI TƯỢNG CAMERA MEDIAPIPE
// ----------------------------------------------------------------
let cameraInstance = null;

/**
 * Bắt đầu Webcam và pipeline MediaPipe.
 * Được gọi khi người dùng bấm "Bắt đầu học".
 */
function startCamera() {
  if (cameraInstance) return;

  cameraInstance = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });

  cameraInstance
    .start()
    .then(() => {
      console.log("[PoseAlert] Camera đã bắt đầu.");
      window.isSessionActive = true;
      updateControlUI();
    })
    .catch((err) => {
      console.error("[PoseAlert] Lỗi camera:", err);
      alert(
        "Không thể truy cập Webcam.\nVui lòng cấp quyền camera và tải lại trang.",
      );
      cameraInstance = null;
    });
}

/**
 * Dừng Webcam hoàn toàn: tắt stream, giải phóng tài nguyên.
 * Được gọi khi người dùng bấm "Tạm dừng".
 */
function stopCamera() {
  // Dừng Camera utility của MediaPipe
  if (cameraInstance) {
    cameraInstance.stop();
    cameraInstance = null;
  }

  // Dừng tất cả các track stream của <video> (trả lại quyền camera cho hệ điều hành)
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach((track) => {
      track.stop(); // Tắt đèn camera vật lý
      console.log("[PoseAlert] Đã tắt track:", track.kind);
    });
    videoElement.srcObject = null;
  }

  // Xoá canvas và reset trạng thái tư thế
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  window.isSessionActive = false;
  currentPoseStatus = "CHƯA PHÁT HIỆN";
  updateStatusUI();
  updateControlUI();

  console.log("[PoseAlert] Camera đã tắt. Phiên tạm dừng.");
}

// ----------------------------------------------------------------
// 5. NHÚNG GIAO DIỆN NÚT ĐIỀU KHIỂN VÀO #session-controls
// ----------------------------------------------------------------
const controlSlot = document.getElementById("session-controls");
if (controlSlot) {
  controlSlot.innerHTML = `
        <div class="session-ctrl-bar">
            <button class="session-btn start-btn" id="ctrl-start" onclick="startCamera()">
                ▶&nbsp; Bắt đầu học
            </button>
            <button class="session-btn pause-btn" id="ctrl-pause" onclick="stopCamera()" disabled>
                ⏸&nbsp; Tạm dừng
            </button>
        </div>
    `;
}

/** Cập nhật trạng thái enable/disable của 2 nút điều khiển */
function updateControlUI() {
  const btnStart = document.getElementById("ctrl-start");
  const btnPause = document.getElementById("ctrl-pause");
  if (!btnStart || !btnPause) return;

  if (window.isSessionActive) {
    btnStart.disabled = true;
    btnPause.disabled = false;
  } else {
    btnStart.disabled = false;
    btnPause.disabled = true;
  }
}

// ----------------------------------------------------------------
// 6. CALLBACK XỬ LÝ KẾT QUẢ MEDIAPIPE
// ----------------------------------------------------------------
function onPoseResults(results) {
  canvasElement.width = results.image.width;
  canvasElement.height = results.image.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height,
  );

  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#00FF88",
      lineWidth: 2.5,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "#FF4444",
      fillColor: "#FF000088",
      lineWidth: 1,
      radius: 4,
    });

    analyzePose(
      results.poseLandmarks,
      canvasElement.width,
      canvasElement.height,
    );
    drawDebugOverlay(results.poseLandmarks);
  } else {
    currentPoseStatus = "CHƯA PHÁT HIỆN";
    currentNeckAngle = 0;
    currentShoulderDiff = 0;
    updateStatusUI();
  }

  canvasCtx.restore();
}

// ----------------------------------------------------------------
// 7. VẼ DEBUG OVERLAY LÊN CANVAS
// ----------------------------------------------------------------
function drawDebugOverlay(landmarks) {
  const w = canvasElement.width;
  const h = canvasElement.height;

  canvasCtx.font = "bold 12px 'JetBrains Mono', monospace";
  canvasCtx.textBaseline = "bottom";

  const labelMap = { 7: "Tai T", 8: "Tai P", 11: "Vai T", 12: "Vai P" };

  Object.entries(labelMap).forEach(([idx, label]) => {
    const lm = landmarks[parseInt(idx)];
    if (!lm || (lm.visibility ?? 1) < 0.3) return;
    const x = lm.x * w;
    const y = lm.y * h;
    canvasCtx.fillStyle = "rgba(0,0,0,0.6)";
    const tw = canvasCtx.measureText(label).width;
    canvasCtx.fillRect(x + 6, y - 16, tw + 4, 16);
    canvasCtx.fillStyle = "#FFD700";
    canvasCtx.fillText(label, x + 8, y - 2);
  });

  const pad = 10;
  const lineH = 22;
  const lines = [
    `Góc cổ: ${currentNeckAngle.toFixed(1)}°  ${currentNeckAngle < 62 ? "⚠" : "✓"}`,
    `Lệch vai: ${currentShoulderDiff.toFixed(1)}px  ${currentShoulderDiff > 30 ? "⚠" : "✓"}`,
  ];
  canvasCtx.fillStyle = "rgba(0,0,0,0.55)";
  canvasCtx.fillRect(pad, pad, 220, lineH * lines.length + pad);
  canvasCtx.font = "13px 'JetBrains Mono', monospace";
  lines.forEach((txt, i) => {
    canvasCtx.fillStyle =
      i === 0
        ? currentNeckAngle < 62
          ? "#FF6B6B"
          : "#00FF88"
        : currentShoulderDiff > 30
          ? "#FF6B6B"
          : "#00FF88";
    canvasCtx.fillText(txt, pad + 6, pad + lineH * (i + 1));
  });
}
