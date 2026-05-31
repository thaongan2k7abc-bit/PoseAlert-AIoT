/**
 * ============================================================
 * FILE: js/pomodoro.js
 * MÔ TẢ: Module Đồng Hồ Học Theo Phương Pháp Pomodoro
 *
 * CÁCH HOẠT ĐỘNG:
 *   - 25 phút TẬP TRUNG → Tự động chuyển sang 5 phút NGHỈ NGƠI
 *   - 5 phút NGHỈ NGƠI → Tự động chuyển sang 25 phút TẬP TRUNG
 *   - Nút Bắt đầu / Tạm dừng / Đặt lại
 *   - Theo dõi số vòng Pomodoro đã hoàn thành (tối đa 4 vòng hiển thị)
 *
 * PHỤ THUỘC:
 *   - HTML element có id="pomodoro-section"
 *   - CSS file: css/pomodoro.css (nhúng tự động)
 * ============================================================
 */

(function () {
  "use strict";

  // ============================================================
  // 1. TỰ ĐỘNG NHÚNG CSS
  // ============================================================
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "../css/pomodoro.css";
  document.head.appendChild(link);

  // ============================================================
  // 2. CẤU HÌNH THỜI GIAN (đơn vị: giây)
  // ============================================================
  const FOCUS_DURATION = 25 * 60; // 25 phút tập trung
  const BREAK_DURATION = 5 * 60; //  5 phút nghỉ ngơi

  // ============================================================
  // 3. BIẾN TRẠNG THÁI NỘI BỘ
  // ============================================================
  let timeLeft = FOCUS_DURATION; // Số giây còn lại trong phiên hiện tại
  let isRunning = false; // Đang chạy hay đang dừng
  let isFocus = true; // true = đang tập trung, false = đang nghỉ
  let roundsDone = 0; // Số vòng Pomodoro (tập trung) đã hoàn thành
  let intervalId = null; // ID của setInterval, dùng để clearInterval

  // ============================================================
  // 4. XÂY DỰNG GIAO DIỆN VÀ NHÚNG VÀO #pomodoro-section
  // ============================================================
  const container = document.getElementById("pomodoro-section");
  if (!container) {
    console.warn("[Pomodoro] Không tìm thấy #pomodoro-section trong HTML.");
    return;
  }

  container.querySelector(".section-card-body").innerHTML = `

        <!-- Hai pill chế độ: Tập trung / Nghỉ ngơi -->
        <div class="pomo-mode-row">
            <div class="pomo-mode-pill active-focus" id="pomo-pill-focus">🎯 Tập trung</div>
            <div class="pomo-mode-pill"              id="pomo-pill-break">☕ Nghỉ ngơi</div>
        </div>

        <!-- Mặt đồng hồ lớn -->
        <div class="pomo-clock-face focus" id="pomo-clock-face">
            <div class="pomo-session-label" id="pomo-session-label">PHIÊN TẬP TRUNG</div>
            <div class="pomo-time-display"  id="pomo-time-display">25:00</div>
            <!-- Chấm tròn thể hiện số vòng đã hoàn thành (tối đa 4) -->
            <div class="pomo-rounds" id="pomo-rounds">
                <span class="pomo-round-dot" id="pomo-dot-0"></span>
                <span class="pomo-round-dot" id="pomo-dot-1"></span>
                <span class="pomo-round-dot" id="pomo-dot-2"></span>
                <span class="pomo-round-dot" id="pomo-dot-3"></span>
            </div>
        </div>

        <!-- 3 nút điều khiển -->
        <div class="pomo-controls">
            <button class="pomo-btn primary" id="pomo-btn-start">▶ Bắt đầu</button>
            <button class="pomo-btn"         id="pomo-btn-pause" disabled>⏸ Tạm dừng</button>
            <button class="pomo-btn"         id="pomo-btn-reset">↺ Đặt lại</button>
        </div>

        <!-- Gợi ý nhỏ phía dưới -->
        <div class="pomo-hint" id="pomo-hint">Nhấn Bắt đầu để khởi động Pomodoro 🍅</div>
    `;

  // ============================================================
  // 5. LẤY THAM CHIẾU ĐẾN CÁC PHẦN TỬ DOM
  // ============================================================
  const timeDisplay = document.getElementById("pomo-time-display");
  const clockFace = document.getElementById("pomo-clock-face");
  const sessionLabel = document.getElementById("pomo-session-label");
  const pillFocus = document.getElementById("pomo-pill-focus");
  const pillBreak = document.getElementById("pomo-pill-break");
  const hintEl = document.getElementById("pomo-hint");
  const btnStart = document.getElementById("pomo-btn-start");
  const btnPause = document.getElementById("pomo-btn-pause");
  const btnReset = document.getElementById("pomo-btn-reset");

  // ============================================================
  // 6. HÀM TIỆN ÍCH
  // ============================================================

  /** Định dạng số giây thành chuỗi MM:SS */
  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  /** Phát âm thanh "ding" nhẹ khi chuyển chế độ */
  function playDing(freq1 = 660, freq2 = 880) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc.frequency.setValueAtTime(freq2, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      /* Ignore trên môi trường không hỗ trợ */
    }
  }

  /** Cập nhật toàn bộ giao diện theo trạng thái hiện tại */
  function updateUI() {
    // Hiển thị thời gian
    timeDisplay.textContent = formatTime(timeLeft);

    // Đổi giao diện theo chế độ
    if (isFocus) {
      clockFace.className = "pomo-clock-face focus";
      sessionLabel.textContent = "PHIÊN TẬP TRUNG";
      pillFocus.className = "pomo-mode-pill active-focus";
      pillBreak.className = "pomo-mode-pill";
    } else {
      clockFace.className = "pomo-clock-face break";
      sessionLabel.textContent = "THỜI GIAN NGHỈ NGƠI";
      pillFocus.className = "pomo-mode-pill";
      pillBreak.className = "pomo-mode-pill active-break";
    }

    // Cập nhật các chấm tròn vòng Pomodoro (tối đa 4 vòng)
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`pomo-dot-${i}`);
      if (dot)
        dot.className = "pomo-round-dot" + (i < roundsDone % 4 ? " done" : "");
    }
  }

  // ============================================================
  // 7. LOGIC CHUYỂN PHIÊN (Tập trung ↔ Nghỉ ngơi)
  // ============================================================
  function switchSession() {
    if (isFocus) {
      // Vừa xong phiên TẬP TRUNG → chuyển sang NGHỈ
      roundsDone++;
      isFocus = false;
      timeLeft = BREAK_DURATION;
      hintEl.textContent = `🎉 Hoàn thành vòng #${roundsDone}! Nghỉ 5 phút nào ☕`;
      playDing(880, 1100); // Âm vui (cao)
    } else {
      // Vừa xong phiên NGHỈ → chuyển sang TẬP TRUNG
      isFocus = true;
      timeLeft = FOCUS_DURATION;
      hintEl.textContent = "💪 Bắt đầu phiên tập trung mới!";
      playDing(440, 660); // Âm nhẹ nhàng (thấp)
    }
    updateUI();
  }

  // ============================================================
  // 8. XỬ LÝ SỰ KIỆN CÁC NÚT
  // ============================================================

  // Nút Bắt đầu
  btnStart.addEventListener("click", () => {
    if (isRunning) return;
    isRunning = true;

    // Cập nhật trạng thái nút
    btnStart.disabled = true;
    btnPause.disabled = false;
    hintEl.textContent = isFocus
      ? "🎯 Đang tập trung... Tắt mạng xã hội đi!"
      : "☕ Đang nghỉ ngơi...";

    // Bắt đầu vòng lặp đếm ngược (1 giây/lần)
    intervalId = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateUI();

        // Cập nhật hint khi còn ít giây
        if (timeLeft === 10) {
          hintEl.textContent = isFocus
            ? "⏰ Còn 10 giây tập trung!"
            : "⏰ Còn 10 giây nghỉ!";
        }
      } else {
        // Hết thời gian → chuyển phiên
        switchSession();
      }
    }, 1000);
  });

  // Nút Tạm dừng
  btnPause.addEventListener("click", () => {
    if (!isRunning) return;
    isRunning = false;

    clearInterval(intervalId);
    intervalId = null;

    btnStart.disabled = false;
    btnPause.disabled = true;
    hintEl.textContent = "⏸ Đã tạm dừng. Nhấn Bắt đầu để tiếp tục.";
  });

  // Nút Đặt lại
  btnReset.addEventListener("click", () => {
    // Dừng interval nếu đang chạy
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    // Reset toàn bộ về trạng thái ban đầu
    isRunning = false;
    isFocus = true;
    timeLeft = FOCUS_DURATION;
    roundsDone = 0;

    btnStart.disabled = false;
    btnPause.disabled = true;
    hintEl.textContent = "↺ Đã đặt lại. Nhấn Bắt đầu để bắt đầu mới.";

    updateUI();
  });

  // ============================================================
  // 9. KHỞI CHẠY LẦN ĐẦU
  // ============================================================
  updateUI();
})();
