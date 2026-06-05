/**
 * ============================================================
 * FILE: js/timer.js
 * MÔ TẢ: Module Timer Cảnh Báo + Trợ lý AI PoseAlert
 *
 * CẤU TRÚC INJECT:
 *   - Timer UI (badge, đếm giây, progress bar)
 *     → nhúng vào #timer-section .section-card-body (cột phải)
 *   - Hộp thoại Trợ lý AI
 *     → nhúng vào #camera-assistant-container (cột trái, dưới camera)
 *
 * HÀM TOÀN CỤC:
 *   window.updateAIAssistant(type, detail)
 *   Có thể gọi từ bất kỳ module nào.
 *
 * 5 TRẠNG THÁI (type):
 *   "idle"         — Chờ bắt đầu / đã tạm dừng
 *   "good"         — Tư thế đúng, đang học
 *   "bad_realtime" — Đang sai tư thế (< 30s), cảnh báo ngay
 *   "bad_alert"    — Sai ≥ 30s liên tục, kèm link tài nguyên
 *   "break"        — Đang trong phiên nghỉ Pomodoro
 * ============================================================
 */

(function () {
  "use strict";

  // ============================================================
  // 1. NHÚNG CSS
  // ============================================================
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "../css/timer.css";
  document.head.appendChild(link);

  // ============================================================
  // 2. HẰNG SỐ
  // ============================================================
  const BAD_POSES = ["CÚI ĐẦU", "VẸO LƯNG", "MẮT GẦN MÀN HÌNH"];
  const ALERT_THRESHOLD = 30; // giây

  // Popup overlay khi đủ 30s
  const POSE_POPUP = {
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

  // Lời khuyên chi tiết cho bad_alert (đủ 30s) — kèm tác hại y khoa + hướng dẫn sửa + link
  const POSE_AI_ADVICE = {
    "CÚI ĐẦU": {
      title: "CẢNH BÁO: Bạn đang mắc hội chứng 'Text Neck' (Cúi đầu quá thấp)",
      body: "Hệ thống đo được góc cổ của bạn đang cúi sâu! Khi đầu nghiêng về trước 60 độ, áp lực đè lên các đốt sống cổ sẽ <strong>tăng từ 5kg lên đến 27kg</strong> (tương đương cõng một đứa trẻ trên gáy). Lâu ngày sẽ gây thoái hóa đĩa đệm, hẹp ống sống và thiếu máu lên não gây đau đầu, buồn ngủ.<br><br>💡 <strong>Hướng dẫn điều chỉnh đúng:</strong><br>1. Hãy ngồi thẳng lưng, đẩy vai ra sau.<br>2. Nâng cằm lên sao cho tai thẳng hàng với vai.<br>3. Điều chỉnh độ cao màn hình sao cho cạnh trên của màn hình ngang tầm mắt của bạn.",
      resource:
        "💡 <strong>Khuyên dùng:</strong> Xem chuỗi video bài tập <a href='https://www.youtube.com/results?search_query=yoga+chữa+đau+vai+gáy' target='_blank' rel='noopener'>Yoga chữa gù lưng và đau vai gáy</a> hoặc tham khảo hướng dẫn của BV Đa khoa Tâm Anh tại <a href='https://tamanhhospital.vn/tu-the-ngoi-dung/' target='_blank' rel='noopener'>Tư thế ngồi đúng và cách phòng tránh các bệnh về cột sống</a>.",
    },
    "VẸO LƯNG": {
      title: "CẢNH BÁO: Lệch trọng tâm cột sống (Vẹo lưng / Lệch vai)",
      body: "Bạn đang ngồi nghiêng người sang một bên! Tư thế này khiến toàn bộ trọng lượng cơ thể dồn bất đối xứng vào một bên cơ thắt lưng và đĩa đệm, tạo ra lực cắt nguy hiểm dẫn đến <strong>nguy cơ cong vẹo cột sống, thoát vị đĩa đệm</strong> và làm hông bên cao bên thấp.<br><br>💡 <strong>Hướng dẫn điều chỉnh đúng:</strong><br>1. Đặt cả hai bàn chân chạm hoàn toàn trên mặt đất (không vắt chéo chân).<br>2. Cảm nhận hai xương ngồi ở mông cùng chạm đều xuống mặt ghế.<br>3. Giữ hai vai cân bằng trên một đường thẳng nằm ngang.",
      resource:
        "💡 <strong>Khuyên dùng:</strong> Tham khảo hướng dẫn y tế Vinmec tại <a href='https://www.vinmec.com/vie/bai-viet/tu-ngoi-dung-tranh-benh-cot-song-vi' target='_blank' rel='noopener'>Hướng dẫn cách tự quan sát và nhắc nhở bản thân điều chỉnh lại tư thế sau mỗi 10-15 phút làm việc, kèm theo các mẹo tránh bệnh cột sống.</a> và bài tập Plank 1 phút tại chỗ để tăng sức bền cho cơ lõi (Core).",
    },
    "MẮT GẦN MÀN HÌNH": {
      title: "CẢNH BÁO: Khoảng cách nhìn quá nguy hiểm cho thị lực",
      body: "Hệ thống phát hiện tỷ lệ khung hình khuôn mặt của bạn đang quá lớn — bạn đang rướn người sát màn hình! Khoảng cách quá gần (&lt;50cm) khiến thủy tinh thể phải phồng lên liên tục, võng mạc tiếp xúc quá nhiều với ánh sáng xanh độc hại gây <strong>hội chứng khô mắt kỹ thuật số, nhức hốc mắt và tăng độ cận chóng mặt</strong>.<br><br>💡 <strong>Hướng dẫn điều chỉnh đúng:</strong><br>1. Hãy ngả lưng vào tựa ghế, giữ khoảng cách từ mắt đến màn hình tối thiểu <strong>50cm – 70cm</strong> (khoảng bằng một cánh tay duỗi thẳng).<br>2. Tăng kích thước phông chữ (Zoom font lên 110% – 125%) để không phải rướn người khi đọc.",
      resource:
        "💡 <strong>Khuyên dùng:</strong> Bật chế độ <strong>Night Light</strong> (Lọc ánh sáng xanh) trên Windows/macOS và cài tiện ích <a href='https://chrome.google.com/webstore/search/eye+care' target='_blank' rel='noopener'>Eye Care - nhắc nghỉ mắt</a> trên Chrome.",
    },
  };

  // Gợi ý nghỉ Pomodoro (random, không lặp lại liên tiếp)
  const BREAK_TIPS = [
    {
      icon: "🧘‍♂️",
      title: "Bài tập giãn cơ Cổ - Vai - Gáy (Khuyên dùng bởi Y tế học đường)",
      body: "Đã đến giờ giải lao! Hãy thực hiện chuỗi động tác 3 bước tại chỗ để giải tỏa áp lực đĩa đệm:<br>1. <strong>Xoay cổ nhẹ nhàng:</strong> Nghiêng đầu sang trái, giữ 5 giây, rồi đổi bên.<br>2. <strong>Căng vai:</strong> Đan hai tay ra sau lưng, đẩy lồng ngực về trước và nâng tay lên cao.<br>3. <strong>Vươn mình:</strong> Đưa hai tay thẳng lên trời, hít sâu để kéo giãn cột sống.",
      videoBtn:
        "<a href='https://www.youtube.com/results?search_query=yoga+gian+co+vai+gay+5+phut' target='_blank' rel='noopener' class='ai-video-btn'>📺 Xem Video hướng dẫn Yoga 5 phút</a>",
    },
    {
      icon: "👀",
      title: "Liệu pháp phục hồi thị lực 20-20-20 (Hiệp hội Nhãn khoa)",
      body: "Làm việc liên tục khiến mắt bị khô và mỏi điều tiết. Hãy làm ngay:<br>👉 Nhìn xa màn hình, tập trung vào một vật cách xa ít nhất <strong>6 mét</strong> trong <strong>20 giây</strong>.<br>👉 Kết hợp chớp mắt liên tục 10 lần và xoa hai lòng bàn tay ấm áp nhẹ lên hốc mắt.",
      videoBtn:
        "<a href='https://www.youtube.com/results?search_query=massage+mat+thu+gian' target='_blank' rel='noopener' class='ai-video-btn'>📺 Xem Video hướng dẫn massage mắt</a>",
    },
    {
      icon: "🧠",
      title: "Bí quyết xả stress cho não bộ (Lời khuyên chống xao nhãng)",
      body: "Trong 5 phút nghỉ ngơi này, hãy <strong>đứng dậy đi uống một cốc nước ấm</strong> hoặc bước ra ban công nhìn cây xanh.<br>⚠️ <strong>Tuyệt đối tránh xa điện thoại và không lướt mạng xã hội!</strong> Việc nạp thêm thông tin ngắn (Reels, TikTok) lúc này sẽ khiến các nơ-ron thần kinh không được nghỉ ngơi, dẫn đến tình trạng kiệt sức não bộ và giảm 40% khả năng tập trung ở phiên học tiếp theo.",
      videoBtn:
        "<a href='https://www.youtube.com/results?search_query=ky+thuat+tho+thu+gian+stress' target='_blank' rel='noopener' class='ai-video-btn'>📺 Xem Video kỹ thuật thở thư giãn</a>",
    },
  ];

  // ============================================================
  // 3. BIẾN TRẠNG THÁI NỘI BỘ
  // ============================================================
  let badSeconds = 0;
  let lastBadPose = "";
  let popupCooldown = false;
  let currentBreakTipIndex = -1; // Chỉ số tip nghỉ hiện tại (tránh lặp)
  let wasOnBreak = false; // Phát hiện lúc VỪA chuyển sang nghỉ
  let lastAIType = ""; // Tránh gọi updateAIAssistant() dư thừa
  let isAiAdviceLocked = false; // Khóa hộp thoại AI sau khi hiện bad_alert
  let goodSecondsAfterAlert = 0; // Đếm giây ngồi đúng liên tục sau khi bị khóa

  // ============================================================
  // 4. INJECT TIMER UI VÀO #timer-section (cột phải)
  // ============================================================
  const timerContainer = document.getElementById("timer-section");
  if (!timerContainer) {
    console.warn("[Timer] Không tìm thấy #timer-section.");
    return;
  }

  timerContainer.querySelector(".section-card-body").innerHTML = `
        <div class="timer-status-row">
            <div class="timer-badge good" id="timer-badge">
                <span class="timer-badge-dot"></span>
                <span id="timer-badge-text">TƯ THẾ ĐÚNG</span>
            </div>
            <span id="timer-realtime">--:--:--</span>
        </div>

        <div class="timer-counter-box" id="timer-counter-box">
            <div class="timer-counter-label">Thời gian ngồi sai liên tục</div>
            <div class="timer-counter-value" id="timer-counter-value">0</div>
            <div class="timer-counter-unit">giây / ${ALERT_THRESHOLD}s</div>
        </div>

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
  // 5. INJECT HỘP THOẠI TRỢ LÝ AI VÀO #camera-assistant-container
  //    (nằm ngay dưới khung camera, cột trái)
  // ============================================================
  const assistantContainer = document.getElementById(
    "camera-assistant-container",
  );
  if (!assistantContainer) {
    console.warn(
      "[Timer] Không tìm thấy #camera-assistant-container trong HTML.",
    );
    // Vẫn tiếp tục — chỉ phần AI assistant bị thiếu, timer vẫn chạy
  } else {
    assistantContainer.innerHTML = `
            <div class="ai-assistant-box" id="ai-assistant-box">

                <div class="ai-assistant-header">
                    <span class="ai-avatar">🤖</span>
                    <span class="ai-title">Trợ lý AI PoseAlert</span>
                    <span class="ai-status-dot dot-idle" id="ai-status-dot" title="Chờ bắt đầu"></span>
                </div>

                <div class="ai-assistant-body">
                    <div class="ai-content-icon"  id="ai-content-icon">✨</div>
                    <div class="ai-content-title" id="ai-content-title">Sẵn sàng theo dõi</div>
                    <div class="ai-content-text"  id="ai-content-text">
                        Hãy bấm <strong>Bắt đầu học</strong> để tôi bắt đầu phân tích tư thế và hỗ trợ bạn!
                    </div>
                </div>

                <!-- Gợi ý tài nguyên — chỉ hiện ở trạng thái bad_alert -->
                <div class="ai-resource-tip" id="ai-resource-tip" style="display:none;">
                    💡 <strong>Gợi ý cho bạn:</strong> Tham khảo
                    <a href="https://www.coursera.org/search?query=ergonomics" target="_blank" rel="noopener">
                        Khóa học Ergonomics căn bản trên Coursera
                    </a>
                    hoặc chuỗi bài tập
                    <a href="#" target="_blank" rel="noopener">Yoga chữa gù lưng của PTIT Health</a>.
                </div>

            </div>
        `;
  }

  // ============================================================
  // 6. POPUP CẢNH BÁO OVERLAY (gắn vào <body>)
  // ============================================================
  const popupOverlay = document.createElement("div");
  popupOverlay.className = "timer-popup-overlay";
  popupOverlay.id = "timer-popup-overlay";
  popupOverlay.innerHTML = `
        <div class="timer-popup-card">
            <span class="timer-popup-emoji" id="timer-popup-emoji">⚠️</span>
            <div class="timer-popup-title"  id="timer-popup-title">CẢNH BÁO!</div>
            <div class="timer-popup-msg"    id="timer-popup-msg">Bạn đang ngồi sai tư thế!</div>
            <button class="timer-popup-btn" id="timer-popup-close">Đã hiểu, cảm ơn! 👍</button>
        </div>
    `;
  document.body.appendChild(popupOverlay);

  document.getElementById("timer-popup-close").addEventListener("click", () => {
    popupOverlay.classList.remove("visible");
    popupCooldown = true;
    badSeconds = 0;
    // KHÔNG mở khóa AI ở đây — hộp thoại giữ nguyên để người dùng đọc hướng dẫn.
    // Khóa sẽ tự động mở sau 10 giây ngồi đúng liên tục (xem setInterval).
    setTimeout(() => {
      popupCooldown = false;
    }, 10000);
  });

  // ── Nút "Nghỉ nhanh 5p" — kích hoạt chế độ nghỉ ngay lập tức để test ──
  // Phải dùng setTimeout nhỏ vì pomodoro.js load sau timer.js,
  // cần đợi DOM + pomodoro.js inject xong mới gắn sự kiện được.
  setTimeout(() => {
    const testBtn = document.getElementById("test-break-btn");
    if (!testBtn) return;

    testBtn.addEventListener("click", () => {
      // 1. Kích hoạt Pomodoro chuyển sang Break mode (5 phút)
      if (typeof window.triggerPomoBreak === "function") {
        window.triggerPomoBreak();
      }
      // 2. Khóa AI và hiện tip nghỉ ngay lập tức
      isAiAdviceLocked = true;
      goodSecondsAfterAlert = 0;
      wasOnBreak = false; // Reset để vòng lặp nhận diện lại "vừa vào nghỉ"
      window.updateAIAssistant("break");
      lastAIType = "break";

      // 3. Đổi nút thành trạng thái đang nghỉ
      testBtn.textContent = "⏳ Đang nghỉ...";
      testBtn.disabled = true;
      // Tự reset nút sau 5 phút
      setTimeout(
        () => {
          testBtn.textContent = "☕ Nghỉ nhanh 5p";
          testBtn.disabled = false;
        },
        5 * 60 * 1000,
      );
    });
  }, 1500); // 1.5s đủ để pomodoro.js inject xong

  // ============================================================
  // 7. WEB AUDIO API — tiếng chuông cảnh báo
  // ============================================================
  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn("[Timer] Web Audio không khả dụng:", e);
    }
  }

  // ============================================================
  // 8. HIỂN THỊ POPUP CẢNH BÁO
  // ============================================================
  function showPopup(poseKey) {
    const info = POSE_POPUP[poseKey] || {
      emoji: "⚠️",
      title: "CẢNH BÁO TƯ THẾ!",
      msg: "Bạn đang ngồi sai tư thế trong 30 giây liên tục. Hãy điều chỉnh lại!",
    };
    document.getElementById("timer-popup-emoji").textContent = info.emoji;
    document.getElementById("timer-popup-title").textContent = info.title;
    document.getElementById("timer-popup-msg").innerHTML = info.msg.replace(
      /\n/g,
      "<br>",
    );
    popupOverlay.classList.add("visible");
    playAlertSound();
  }

  // ============================================================
  // 9. HÀM CHÍNH: window.updateAIAssistant(type, detail)
  //
  //    TRẠNG THÁI:
  //      "idle"         — Chờ / đã tạm dừng
  //      "good"         — Tư thế đúng, đang học
  //      "bad_realtime" — Đang sai tư thế (ngay từ giây đầu)
  //      "bad_alert"    — Sai ≥ 30s (kèm link tài nguyên)
  //      "break"        — Đang nghỉ Pomodoro
  // ============================================================
  window.updateAIAssistant = function (type, detail) {
    const iconEl = document.getElementById("ai-content-icon");
    const titleEl = document.getElementById("ai-content-title");
    const textEl = document.getElementById("ai-content-text");
    const resourceEl = document.getElementById("ai-resource-tip");
    const statusDot = document.getElementById("ai-status-dot");
    const box = document.getElementById("ai-assistant-box");

    // Nếu chưa inject được hộp thoại (container không tồn tại)
    if (!iconEl || !titleEl || !textEl || !box) return;

    // Xoá class trạng thái cũ
    box.classList.remove(
      "ai-state-idle",
      "ai-state-good",
      "ai-state-bad-realtime",
      "ai-state-bad-alert",
      "ai-state-break",
    );
    // Ẩn link tài nguyên mặc định (chỉ bad_alert mới bật)
    resourceEl.style.display = "none";

    // Helper cập nhật status dot
    function setDot(cls, title) {
      if (statusDot) {
        statusDot.className = `ai-status-dot ${cls}`;
        statusDot.title = title;
      }
    }

    switch (type) {
      // ── TRẠNG THÁI 1: Tư thế đúng ──────────────────────────
      case "good":
        box.classList.add("ai-state-good");
        iconEl.textContent = "✅";
        titleEl.textContent = "Trạng thái hoàn hảo!";
        textEl.innerHTML =
          "Tư thế ngồi của bạn đang <strong>đạt chuẩn khoa học</strong>. Cơ thể đang ở trạng thái tiếp thu kiến thức tốt nhất và bảo vệ cột sống tối đa. Hãy tiếp tục phát huy nhé! 🚀";
        setDot("dot-good", "Tư thế đúng — Đang theo dõi");
        break;

      // ── TRẠNG THÁI 2: Sai tư thế (ngay từ giây đầu) ────────
      case "bad_realtime":
        box.classList.add("ai-state-bad-realtime");
        iconEl.textContent = "⚠️";
        titleEl.textContent = "Bạn đang ngồi sai tư thế!";
        textEl.innerHTML = `Hệ thống phát hiện bạn đang <strong>${detail || "sai tư thế"}</strong>.
                                       Hãy <strong>điều chỉnh lại ngay</strong> —
                                       đồng hồ cảnh báo đang đếm ngược! ⏱`;
        setDot("dot-bad-realtime", "Cảnh báo tư thế — đang đếm ngược");
        break;

      // ── TRẠNG THÁI 3: Sai ≥ 30s (kèm lời khuyên + link) ────
      case "bad_alert": {
        const advice = POSE_AI_ADVICE[detail] || {
          title: "Sai tư thế nghiêm trọng!",
          body: "Hãy <strong>điều chỉnh lại tư thế ngay</strong> để bảo vệ sức khỏe!",
          resource:
            "💡 Tham khảo tài liệu Ergonomics để cải thiện không gian học tập.",
        };
        box.classList.add("ai-state-bad-alert");
        iconEl.textContent = "🔴";
        titleEl.textContent = advice.title;
        textEl.innerHTML = advice.body;
        // Cập nhật nội dung link tài nguyên theo đúng tư thế
        resourceEl.innerHTML = advice.resource;
        resourceEl.style.display = "block";
        setDot("dot-bad-alert", "Cảnh báo — Đã sai tư thế 30 giây!");
        break;
      }

      // ── TRẠNG THÁI 4: Nghỉ Pomodoro ─────────────────────────
      case "break": {
        // Random tip, không trùng tip vừa dùng
        let idx;
        do {
          idx = Math.floor(Math.random() * BREAK_TIPS.length);
        } while (idx === currentBreakTipIndex && BREAK_TIPS.length > 1);
        currentBreakTipIndex = idx;

        const tip = BREAK_TIPS[idx];
        box.classList.add("ai-state-break");
        iconEl.textContent = tip.icon;
        titleEl.textContent = tip.title;
        textEl.innerHTML = tip.body;
        // Hiện nút xem video nổi bật bên dưới
        resourceEl.innerHTML = tip.videoBtn;
        resourceEl.style.display = "block";
        setDot("dot-break", "Đang trong phiên nghỉ Pomodoro");
        break;
      }

      // ── TRẠNG THÁI 5: Idle (mặc định) ────────────────────────
      default:
        box.classList.add("ai-state-idle");
        iconEl.textContent = "✨";
        titleEl.textContent = "Sẵn sàng theo dõi";
        textEl.innerHTML =
          "Hãy bấm <strong>Bắt đầu học</strong> để tôi bắt đầu phân tích tư thế và hỗ trợ bạn!";
        setDot("dot-idle", "Chờ bắt đầu");
        break;
    }
  };

  // Khởi tạo trạng thái ban đầu
  window.updateAIAssistant("idle");

  // ============================================================
  // 10. PHÁT HIỆN PHIÊN NGHỈ POMODORO QUA DOM
  //     pomodoro.js thêm class "break" vào .pomo-clock-face
  //     khi chuyển sang nghỉ → đọc DOM để nhận biết
  // ============================================================
  function isPomodorOnBreak() {
    const clockFace = document.querySelector(".pomo-clock-face");
    return clockFace ? clockFace.classList.contains("break") : false;
  }

  // ============================================================
  // 11. VÒNG LẶP CHÍNH — 1 giây / lần
  // ============================================================
  setInterval(() => {
    const pose = window.currentPoseStatus || "CHƯA PHÁT HIỆN";
    const isBadPose = BAD_POSES.includes(pose);
    const onBreak = isPomodorOnBreak();

    // Cập nhật đồng hồ thực
    const realtimeEl = document.getElementById("timer-realtime");
    if (realtimeEl) {
      realtimeEl.textContent = new Date().toLocaleTimeString("vi-VN", {
        hour12: false,
      });
    }

    // ────────────────────────────────────────────────────────
    // KỊCH BẢN 1: Đang trong phiên nghỉ Pomodoro
    // ────────────────────────────────────────────────────────
    if (onBreak) {
      // Chỉ gọi "break" đúng 1 lần lúc VỪA chuyển sang nghỉ
      if (!wasOnBreak) {
        window.updateAIAssistant("break");
        lastAIType = "break";
      }
      wasOnBreak = true;

      // Badge đổi sang "ĐANG NGHỈ"
      const badge = document.getElementById("timer-badge");
      const badgeText = document.getElementById("timer-badge-text");
      if (badge && badgeText) {
        badge.className = "timer-badge break";
        badgeText.textContent = "ĐANG NGHỈ";
      }

      // Reset bộ đếm sai tư thế (không tính khi nghỉ)
      badSeconds = 0;
      _updateCounterUI(false);
      return; // Không chạy logic đếm sai tư thế khi nghỉ
    }

    // Vừa hết nghỉ → quay về học
    if (wasOnBreak && !onBreak) {
      wasOnBreak = false;
      window.updateAIAssistant("idle");
      lastAIType = "idle";
    }

    // ── Webcam đang tắt → không đếm, giữ idle ──
    if (!window.isSessionActive) {
      if (lastAIType !== "idle") {
        window.updateAIAssistant("idle");
        lastAIType = "idle";
      }
      return;
    }

    // ────────────────────────────────────────────────────────
    // KỊCH BẢN 2 + 3: Đang học — xử lý logic tư thế
    // ────────────────────────────────────────────────────────

    // Cập nhật badge trạng thái
    const badge = document.getElementById("timer-badge");
    const badgeText = document.getElementById("timer-badge-text");
    if (badge && badgeText) {
      if (isBadPose) {
        badge.className = "timer-badge bad";
        badgeText.textContent = pose;
      } else {
        badge.className = "timer-badge good";
        badgeText.textContent = "TƯ THẾ ĐÚNG";
      }
    }

    if (isBadPose) {
      // ── Tư thế SAI: đếm giây liên tục ──
      badSeconds++;
      lastBadPose = pose;

      // Nếu đang bị khóa mà người dùng tái phạm → reset bộ đếm mở khóa
      if (isAiAdviceLocked) goodSecondsAfterAlert = 0;

      if (badSeconds >= ALERT_THRESHOLD && !popupCooldown) {
        // ── ĐỦ 30 GIÂY: popup + chuông + bad_alert + KHÓA hộp thoại ──
        showPopup(lastBadPose);
        window.updateAIAssistant("bad_alert", lastBadPose);
        lastAIType = "bad_alert";
        isAiAdviceLocked = true;
        goodSecondsAfterAlert = 0; // Reset bộ đếm mở khóa
        badSeconds = 0;
      } else if (
        !isAiAdviceLocked &&
        (lastAIType !== "bad_realtime" || lastBadPose !== pose)
      ) {
        window.updateAIAssistant("bad_realtime", pose);
        lastAIType = "bad_realtime";
      }
    } else {
      // ── Tư thế ĐÚNG ──
      badSeconds = 0;
      lastBadPose = "";

      if (isAiAdviceLocked) {
        // Đang bị khóa: đếm giây ngồi đúng liên tục để tự mở khóa
        goodSecondsAfterAlert++;

        if (goodSecondsAfterAlert >= 10) {
          // ── 10 GIÂY NGỒI ĐÚNG LIÊN TỤC → mở khóa và khen ngợi ──
          isAiAdviceLocked = false;
          goodSecondsAfterAlert = 0;
          lastAIType = ""; // Buộc cập nhật lại ngay
          window.updateAIAssistant("good");
          lastAIType = "good";
        }
        // Trong lúc chờ đủ 10s: hộp thoại giữ nguyên bad_alert,
        // người dùng thoải mái đọc hướng dẫn và bấm link tài nguyên.
      } else if (lastAIType !== "good") {
        // Không bị khóa: cập nhật bình thường
        window.updateAIAssistant("good");
        lastAIType = "good";
      }
    }

    // Cập nhật UI bộ đếm và thanh tiến trình
    _updateCounterUI(isBadPose);
  }, 1000);

  // ============================================================
  // 12. HELPER: cập nhật hộp đếm + thanh tiến trình
  // ============================================================
  function _updateCounterUI(isBadPose) {
    const counterBox = document.getElementById("timer-counter-box");
    const counterValue = document.getElementById("timer-counter-value");
    const progressFill = document.getElementById("timer-progress-fill");

    if (counterValue) counterValue.textContent = badSeconds;
    if (counterBox)
      counterBox.classList.toggle("counting", isBadPose && badSeconds > 0);
    if (progressFill) {
      progressFill.style.width =
        Math.min((badSeconds / ALERT_THRESHOLD) * 100, 100) + "%";
    }
  }
})();
