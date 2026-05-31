/**
 * ============================================================
 * FILE: js/timer.js
 * MÔ TẢ: Module Timer Cảnh Báo Tư Thế
 *
 * CÁCH HOẠT ĐỘNG:
 *   - Cứ mỗi 1 giây kiểm tra window.currentPoseStatus
 *   - Nếu tư thế SAI: đếm số giây liên tục sai tư thế
 *   - Đủ 30 giây liên tục SAI: hiện popup cảnh báo + phát âm thanh
 *   - Khi tư thế về ĐÚNG: reset bộ đếm về 0 ngay lập tức
 *
 * PHỤ THUỘC:
 *   - window.currentPoseStatus (từ pose_logic.js)
 *   - HTML element có id="timer-section"
 *   - CSS file: css/timer.css (nhúng tự động)
 * ============================================================
 */

(function () {
  "use strict";

  // ============================================================
  // 1. TỰ ĐỘNG NHÚNG CSS VÀO <head>
  // ============================================================
  const timerLink = document.createElement("link");
  timerLink.rel = "stylesheet";
  timerLink.href = "../css/timer.css";
  document.head.appendChild(timerLink);

  // ============================================================
  // 2. CÁC HẰNG SỐ CẤU HÌNH
  // ============================================================
  const BAD_POSES = ["CÚI ĐẦU", "VẸO LƯNG", "MẮT GẦN MÀN HÌNH"]; // Các tư thế bị tính là sai
  const ALERT_THRESHOLD = 30; // Số giây liên tục sai tư thế trước khi cảnh báo

  // Nội dung popup theo từng loại tư thế sai
  const POSE_MESSAGES = {
    "CÚI ĐẦU": {
      emoji: "🙇",
      title: "CẢNH BÁO: CÚI ĐẦU!",
      msg: "Bạn đang cúi đầu quá thấp trong 30 giây liên tục.\nHãy ngồi thẳng và nâng đầu lên nhé! 🧘‍♂️",
    },
    "VẸO LƯNG": {
      emoji: "🪑",
      title: "CẢNH BÁO: VẸO LƯNG!",
      msg: "Bạn đang ngồi vẹo lưng trong 30 giây liên tục.\nHãy ngồi thẳng lưng và căn chỉnh vai lại! 💪",
    },
    "MẮT GẦN MÀN HÌNH": {
      emoji: "👁️",
      title: "CẢNH BÁO: QUÁ GẦN MÀN HÌNH!",
      msg: "Mắt bạn đang quá gần màn hình trong 30 giây.\nHãy ngả người ra sau ít nhất 50cm! 🖥️",
    },
  };

  // ============================================================
  // 3. BIẾN TRẠNG THÁI NỘI BỘ
  // ============================================================
  let badSeconds = 0; // Số giây đang ngồi sai liên tục
  let lastBadPose = ""; // Tư thế sai gần nhất (để chọn nội dung popup)
  let popupCooldown = false; // Tránh popup liên tục ngay sau khi đóng

  // ============================================================
  // 4. XÂY DỰNG GIAO DIỆN VÀ NHÚNG VÀO #timer-section
  // ============================================================
  const container = document.getElementById("timer-section");
  if (!container) {
    console.warn("[Timer] Không tìm thấy #timer-section trong HTML.");
    return;
  }

  // Xoá nội dung placeholder cũ
  container.querySelector(".section-card-body").innerHTML = `

        <!-- Hàng trên: Badge trạng thái + thời gian thực -->
        <div class="timer-status-row">
            <div class="timer-badge good" id="timer-badge">
                <span class="timer-badge-dot"></span>
                <span id="timer-badge-text">TƯ THẾ ĐÚNG</span>
            </div>
            <span id="timer-realtime" style="font-size:10px;color:var(--clr-text-muted);font-family:var(--font-mono);">--:--:--</span>
        </div>

        <!-- Hộp đếm giây ngồi sai -->
        <div class="timer-counter-box" id="timer-counter-box">
            <div class="timer-counter-label">Thời gian ngồi sai liên tục</div>
            <div class="timer-counter-value" id="timer-counter-value">0</div>
            <div class="timer-counter-unit">giây / ${ALERT_THRESHOLD}s</div>
        </div>

        <!-- Thanh tiến trình 0 → 30 giây -->
        <div class="timer-progress-wrap">
            <div class="timer-progress-meta">
                <span>0s</span>
                <span>Cảnh báo lúc ${ALERT_THRESHOLD}s</span>
            </div>
            <div class="timer-progress-bar-bg">
                <div class="timer-progress-bar-fill" id="timer-progress-fill"></div>
            </div>
        </div>
    `;

  // ============================================================
  // 5. TẠO POPUP CẢNH BÁO (gắn vào <body>)
  // ============================================================
  const popupOverlay = document.createElement("div");
  popupOverlay.className = "timer-popup-overlay";
  popupOverlay.id = "timer-popup-overlay";
  popupOverlay.innerHTML = `
        <div class="timer-popup-card">
            <span class="timer-popup-emoji" id="timer-popup-emoji">⚠️</span>
            <div class="timer-popup-title" id="timer-popup-title">CẢNH BÁO!</div>
            <div class="timer-popup-msg"   id="timer-popup-msg">Bạn đang ngồi sai tư thế!</div>
            <button class="timer-popup-btn" id="timer-popup-close">Đã hiểu, cảm ơn! 👍</button>
        </div>
    `;
  document.body.appendChild(popupOverlay);

  // Đóng popup khi bấm nút
  document.getElementById("timer-popup-close").addEventListener("click", () => {
    popupOverlay.classList.remove("visible");
    // Kích hoạt cooldown 10 giây để không spam popup ngay sau khi đóng
    popupCooldown = true;
    badSeconds = 0;
    setTimeout(() => {
      popupCooldown = false;
    }, 10000);
  });

  // ============================================================
  // 6. HÀM PHÁT ÂM THANH CẢNH BÁO (Web Audio API — không cần file mp3)
  //    Tạo một tiếng "ding" nhẹ bằng AudioContext thuần túy.
  // ============================================================
  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Tạo oscillator (sóng âm hình sin)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Nốt A5
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15); // Nốt E5

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6); // Fade out

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn("[Timer] Không thể phát âm thanh:", e);
    }
  }

  // ============================================================
  // 7. HÀM HIỂN THỊ POPUP
  // ============================================================
  function showPopup(poseKey) {
    const info = POSE_MESSAGES[poseKey] || {
      emoji: "⚠️",
      title: "CẢNH BÁO TƯ THẾ!",
      msg: "Bạn đang ngồi sai tư thế trong 30 giây liên tục. Hãy điều chỉnh lại!",
    };

    document.getElementById("timer-popup-emoji").textContent = info.emoji;
    document.getElementById("timer-popup-title").textContent = info.title;
    // Hiển thị xuống dòng trong popup
    document.getElementById("timer-popup-msg").innerHTML = info.msg.replace(
      /\n/g,
      "<br>",
    );

    popupOverlay.classList.add("visible");
    playAlertSound();
  }

  // ============================================================
  // 8. HÀM CẬP NHẬT ĐỒNG HỒ THỰC (HH:MM:SS)
  // ============================================================
  function getCurrentTime() {
    return new Date().toLocaleTimeString("vi-VN", { hour12: false });
  }

  // ============================================================
  // 9. VÒNG LẶP CHÍNH — setInterval 1 giây/lần
  // ============================================================
  setInterval(() => {
    // Đọc trạng thái từ Core AI
    const pose = window.currentPoseStatus || "CHƯA PHÁT HIỆN";
    const isBadPose = BAD_POSES.includes(pose);

    // ② Nếu phiên đang tạm dừng, không đếm
    if (!window.isSessionActive) return;

    // --- Cập nhật đồng hồ thực ---
    const realtimeEl = document.getElementById("timer-realtime");
    if (realtimeEl) realtimeEl.textContent = getCurrentTime();

    // --- Cập nhật badge trạng thái ---
    const badge = document.getElementById("timer-badge");
    const badgeText = document.getElementById("timer-badge-text");
    if (badge && badgeText) {
      if (isBadPose) {
        badge.className = "timer-badge bad";
        badgeText.textContent = pose; // Hiện đúng tên lỗi
      } else {
        badge.className = "timer-badge good";
        badgeText.textContent = "TƯ THẾ ĐÚNG";
      }
    }

    // --- Logic đếm giây ---
    if (isBadPose) {
      badSeconds++; // Tăng bộ đếm
      lastBadPose = pose; // Ghi nhớ tư thế sai hiện tại
    } else {
      badSeconds = 0; // Reset ngay lập tức khi tư thế về ĐÚNG
      lastBadPose = "";
    }

    // --- Cập nhật giao diện bộ đếm ---
    const counterBox = document.getElementById("timer-counter-box");
    const counterValue = document.getElementById("timer-counter-value");
    const progressFill = document.getElementById("timer-progress-fill");

    if (counterValue) counterValue.textContent = badSeconds;

    // Màu hộp đếm
    if (counterBox) {
      counterBox.classList.toggle("counting", isBadPose && badSeconds > 0);
    }

    // Cập nhật thanh tiến trình (0% → 100% tương ứng 0 → 30 giây)
    if (progressFill) {
      const pct = Math.min((badSeconds / ALERT_THRESHOLD) * 100, 100);
      progressFill.style.width = pct + "%";
    }

    // --- Kiểm tra kích hoạt cảnh báo ---
    if (badSeconds >= ALERT_THRESHOLD && !popupCooldown) {
      showPopup(lastBadPose);
      badSeconds = 0; // Reset sau khi cảnh báo
    }
  }, 1000); // Chạy mỗi 1 giây
})();
