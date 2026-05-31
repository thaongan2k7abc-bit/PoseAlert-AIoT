/**
 * ============================================================
 * FILE: js/dashboard.js
 * MÔ TẢ: Module Dashboard Thống Kê — Phiên bản nâng cấp
 *
 * TÍNH NĂNG MỚI:
 *   ① Định dạng thời gian: "X giây" hoặc "X phút Y giây"
 *   ② Tích lũy dừng hẳn khi window.isSessionActive = false
 *   ③ Nút "Xuất báo cáo" → tải Line Chart dạng PNG
 *
 * LOGIC GỐC GIỮ NGUYÊN:
 *   - Mỗi 1 giây: cộng dồn giây theo từng trạng thái
 *   - Pie/Doughnut: cập nhật realtime mỗi giây
 *   - Line Chart: ghi 1 điểm mỗi 60 giây (% ngồi đúng / phút)
 *                 giới hạn 10 điểm gần nhất
 * ============================================================
 */

(function () {
  "use strict";

  // ============================================================
  // 1. TỰ ĐỘNG NHÚNG CSS
  // ============================================================
  const cssLink = document.createElement("link");
  cssLink.rel = "stylesheet";
  cssLink.href = "../css/dashboard.css";
  document.head.appendChild(cssLink);

  // ============================================================
  // 2. CẤU HÌNH & HẰNG SỐ
  // ============================================================
  const MAX_LINE_POINTS = 10; // Tối đa 10 phút trên Line Chart
  const SAMPLE_INTERVAL = 1000; // Lấy mẫu mỗi 1 giây
  const MINUTE_SECONDS = 60; // 60 giây → ghi 1 điểm Line Chart

  const POSE_CONFIG = {
    ĐÚNG: { color: "#16a34a", label: "Đúng tư thế" },
    "CÚI ĐẦU": { color: "#dc2626", label: "Cúi đầu" },
    "VẸO LƯNG": { color: "#d97706", label: "Vẹo lưng" },
    "MẮT GẦN MÀN HÌNH": { color: "#7c3aed", label: "Mắt gần MH" },
  };
  const POSE_KEYS = Object.keys(POSE_CONFIG);

  // ============================================================
  // 3. BỘ NHỚ NỘI BỘ
  // ============================================================
  const totalSeconds = {
    ĐÚNG: 0,
    "CÚI ĐẦU": 0,
    "VẸO LƯNG": 0,
    "MẮT GẦN MÀN HÌNH": 0,
  };
  let correctSecondsThisMinute = 0;
  let secondsInCurrentMinute = 0;
  let pieChart = null;
  let lineChart = null;

  // ============================================================
  // 4. HÀM ĐỊNH DẠNG THỜI GIAN ①
  //    < 60s  → "X giây"
  //    >= 60s → "X phút Y giây"
  // ============================================================
  function formatTime(s) {
    if (s < 60) return `${s} giây`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r === 0 ? `${m} phút` : `${m} phút ${r} giây`;
  }

  // ============================================================
  // 5. XÂY DỰNG GIAO DIỆN HTML
  // ============================================================
  const container = document.getElementById("dashboard-section");
  if (!container) {
    console.warn("[Dashboard] Không tìm thấy #dashboard-section.");
    return;
  }

  container.querySelector(".section-card-body").innerHTML = `

        <!-- 4 ô thống kê thời gian theo từng tư thế -->
        <div class="dash-stats-row" id="dash-stats-row"></div>

        <!-- Biểu đồ Doughnut: tỉ lệ 4 trạng thái realtime -->
        <div class="dash-chart-wrap" style="margin-bottom:12px;">
            <div class="dash-chart-header">
                <span class="dash-chart-title">Tổng quan tỉ lệ tư thế (realtime)</span>
                <span class="dash-live-dot">LIVE</span>
            </div>
            <div style="position:relative;height:180px;display:flex;align-items:center;justify-content:center;">
                <canvas id="dash-pie-canvas"></canvas>
                <!-- % ĐÚNG hiển thị ở giữa vành khuyên -->
                <div style="position:absolute;text-align:center;pointer-events:none;">
                    <div id="dash-pie-pct"
                         style="font-family:var(--font-display);font-size:22px;font-weight:700;color:#16a34a;line-height:1;">
                        --%
                    </div>
                    <div style="font-size:9px;color:var(--clr-text-muted);letter-spacing:1px;margin-top:3px;">ĐÚNG</div>
                </div>
            </div>
        </div>

        <!-- Biểu đồ Đường: % ngồi đúng theo từng phút -->
        <div class="dash-chart-wrap">
            <div class="dash-chart-header">
                <span class="dash-chart-title">% Ngồi đúng theo phút</span>
                <span id="dash-minute-countdown"
                      style="font-size:9px;color:var(--clr-text-muted);font-family:var(--font-mono);">
                    Chờ bắt đầu...
                </span>
            </div>
            <div style="position:relative;height:150px;">
                <canvas id="dash-line-canvas"></canvas>
            </div>
            <div class="dash-legend" style="margin-top:8px;">
                <div class="dash-legend-item">
                    <div class="dash-legend-dot" style="background:#2563eb;"></div>
                    <span>% Ngồi đúng / phút (1 điểm = 1 phút)</span>
                </div>
            </div>

            <!-- Nút Xuất báo cáo ③ -->
            <div style="margin-top:12px;text-align:center;">
                <button id="dash-export-btn" class="dash-export-btn">
                    ⬇ Xuất báo cáo đồ thị (PNG)
                </button>
            </div>
        </div>
    `;

  // Tạo động 4 ô thống kê
  const statsRow = document.getElementById("dash-stats-row");
  POSE_KEYS.forEach((key) => {
    const cfg = POSE_CONFIG[key];
    const slug = key.replace(/\s/g, "-");
    const card = document.createElement("div");
    card.className = "dash-stat-card";
    card.style.cssText = `border-top: 3px solid ${cfg.color};`;
    card.innerHTML = `
            <div class="dash-stat-label" style="color:${cfg.color};opacity:0.85;">${cfg.label}</div>
            <div class="dash-stat-value" id="dash-sec-${slug}"
                 style="color:${cfg.color};font-size:13px;font-weight:700;line-height:1.3;">
                0 giây
            </div>
            <div style="font-size:9px;color:var(--clr-text-muted);margin-top:3px;"
                 id="dash-pct-${slug}">0%</div>
        `;
    statsRow.appendChild(card);
  });

  // Thêm style cho nút Xuất báo cáo vào <head>
  const exportStyle = document.createElement("style");
  exportStyle.textContent = `
        .dash-export-btn {
            background   : var(--clr-bg-card);
            border       : 1.5px solid var(--clr-border);
            border-radius: 8px;
            padding      : 7px 16px;
            font-family  : var(--font-mono);
            font-size    : 11px;
            color        : var(--clr-text-secondary);
            cursor       : pointer;
            transition   : all 0.2s;
            letter-spacing: 0.5px;
        }
        .dash-export-btn:hover {
            border-color: var(--clr-cyan);
            color       : var(--clr-cyan);
            background  : var(--clr-cyan-dim);
        }
        .dash-export-btn:disabled {
            opacity: 0.4; cursor: not-allowed;
        }
    `;
  document.head.appendChild(exportStyle);

  // ============================================================
  // 6. KHỞI TẠO 2 BIỂU ĐỒ CHART.JS
  // ============================================================
  function initCharts() {
    // --- Doughnut Chart ---
    pieChart = new Chart(
      document.getElementById("dash-pie-canvas").getContext("2d"),
      {
        type: "doughnut",
        data: {
          labels: POSE_KEYS.map((k) => POSE_CONFIG[k].label),
          datasets: [
            {
              data: [1, 0, 0, 0],
              backgroundColor: POSE_KEYS.map((k) => POSE_CONFIG[k].color),
              borderColor: "#ffffff",
              borderWidth: 2,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          animation: { duration: 600, easing: "easeInOutQuart" },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct =
                    total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${formatTime(ctx.parsed)} (${pct}%)`;
                },
              },
            },
          },
        },
      },
    );

    // --- Line Chart (có zoom/pan, giữ toàn bộ lịch sử) ---
    lineChart = new Chart(
      document.getElementById("dash-line-canvas").getContext("2d"),
      {
        type: "line",
        data: {
          labels: [], // Toàn bộ lịch sử — KHÔNG bao giờ .shift()
          datasets: [
            {
              label: "% Ngồi đúng",
              data: [],
              borderColor: "#2563eb",
              backgroundColor: "rgba(37,99,235,0.08)",
              pointBackgroundColor: "#2563eb",
              pointRadius: 5,
              pointHoverRadius: 7,
              borderWidth: 2.5,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` Ngồi đúng: ${ctx.parsed.y.toFixed(1)}%`,
              },
            },
            // ── Cấu hình zoom/pan bằng chartjs-plugin-zoom ──
            zoom: {
              pan: {
                enabled: true,
                mode: "x", // Chỉ kéo ngang
                threshold: 5,
              },
              zoom: {
                wheel: { enabled: true }, // Cuộn chuột để zoom
                pinch: { enabled: true }, // Chụm ngón tay (mobile)
                mode: "x",
              },
              limits: {
                // Không cho pan/zoom ra ngoài vùng dữ liệu thực
                x: { minRange: 3 },
              },
            },
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: {
                stepSize: 25,
                callback: (v) => v + "%",
                font: { size: 9, family: "'JetBrains Mono', monospace" },
                color: "#a0aec0",
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            x: {
              // Mặc định chỉ hiển thị 10 điểm gần nhất.
              // min/max tính theo chỉ số (index) của mảng labels.
              // Sẽ được cập nhật động sau mỗi lần thêm điểm mới.
              ticks: {
                font: { size: 9, family: "'JetBrains Mono', monospace" },
                color: "#a0aec0",
                maxRotation: 0,
              },
              grid: { display: false },
            },
          },
        },
      },
    );

    // Gắn sự kiện nút Xuất báo cáo sau khi chart đã khởi tạo
    bindExportButton();
  }

  // ============================================================
  // 7. XUẤT BÁO CÁO — PHƯƠNG PHÁP "HIDDEN CANVAS CLONE"
  //
  //    Vấn đề: lineChart đang bật zoom/pan nên .toBase64Image()
  //    chỉ chụp vùng đang hiển thị, mất lịch sử phút cũ.
  //
  //    Giải pháp: Tạo 1 Chart ẩn với TOÀN BỘ dữ liệu, không zoom,
  //    chụp chart ẩn đó, rồi destroy() để giải phóng bộ nhớ.
  // ============================================================
  function bindExportButton() {
    const btn = document.getElementById("dash-export-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (!lineChart || lineChart.data.labels.length === 0) {
        alert("Chưa có dữ liệu để xuất! Hãy học ít nhất 1 phút trước.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "⏳ Đang xuất...";

      // Bước 1: Sao chép toàn bộ mảng dữ liệu lịch sử từ lineChart thực
      const allLabels = [...lineChart.data.labels];
      const allData = [...lineChart.data.datasets[0].data];

      // Bước 2: Tạo canvas ẩn trong bộ nhớ (không gắn vào DOM)
      const hiddenCanvas = document.createElement("canvas");
      hiddenCanvas.width = 900; // Độ phân giải cao để ảnh xuất đẹp
      hiddenCanvas.height = 400;
      hiddenCanvas.style.display = "none";
      document.body.appendChild(hiddenCanvas); // Cần gắn vào DOM để Chart.js render

      // Bước 3: Khởi tạo Chart ẩn — KHÔNG zoom, KHÔNG giới hạn min/max trục X
      const hiddenChart = new Chart(hiddenCanvas.getContext("2d"), {
        type: "line",
        data: {
          labels: allLabels,
          datasets: [
            {
              label: "% Ngồi đúng",
              data: allData,
              borderColor: "#2563eb",
              backgroundColor: "rgba(37,99,235,0.1)",
              pointBackgroundColor: "#2563eb",
              pointRadius: 5,
              borderWidth: 2.5,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: false, // Giữ đúng width/height đã set
          maintainAspectRatio: false,
          animation: false, // Render ngay lập tức, không chờ animation
          plugins: {
            legend: { display: false },
            zoom: {
              pan: { enabled: false },
              zoom: { wheel: { enabled: false } },
            },
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: {
                stepSize: 25,
                callback: (v) => v + "%",
                font: { size: 11, family: "sans-serif" },
                color: "#64748b",
              },
              grid: { color: "rgba(0,0,0,0.07)" },
              title: {
                display: true,
                text: "% Ngồi đúng",
                color: "#64748b",
                font: { size: 12 },
              },
            },
            x: {
              // Không set min/max → tự dàn đều toàn bộ lịch sử
              ticks: {
                font: { size: 10, family: "sans-serif" },
                color: "#64748b",
                maxRotation: 30,
              },
              grid: { display: false },
              title: {
                display: true,
                text: "Thời gian (HH:MM)",
                color: "#64748b",
                font: { size: 12 },
              },
            },
          },
        },
      });

      // Bước 4: Chờ 1 tick để Chart.js render xong hoàn toàn, rồi xuất ảnh
      setTimeout(() => {
        const imageBase64 = hiddenChart.toBase64Image("image/png", 1.0);

        // Tạo link tải xuống
        const link = document.createElement("a");
        const timestamp = new Date()
          .toLocaleString("vi-VN")
          .replace(/[/:, ]/g, "-");
        link.href = imageBase64;
        link.download = `PoseAlert_BaoCao_${timestamp}.png`;
        link.click();

        // Bước 5: Dọn dẹp — destroy chart ẩn và xóa canvas khỏi DOM
        hiddenChart.destroy();
        document.body.removeChild(hiddenCanvas);

        btn.disabled = false;
        btn.textContent = "⬇ Xuất báo cáo đồ thị (PNG)";
        console.log("[Dashboard] Xuất báo cáo đầy đủ lịch sử:", link.download);
      }, 200); // 200ms đủ để animation: false render xong
    });
  }

  // ============================================================
  // 8. HÀM CẬP NHẬT GIAO DIỆN MỖI GIÂY
  // ============================================================
  function updateEverySecond() {
    // ② Kiểm tra trạng thái phiên: nếu đang tạm dừng thì KHÔNG tích lũy
    if (!window.isSessionActive) return;

    const pose = window.currentPoseStatus || "";

    // --- Cộng dồn giây ---
    if (totalSeconds.hasOwnProperty(pose)) {
      totalSeconds[pose]++;
    }

    // --- Theo dõi giây ĐÚNG trong phút hiện tại ---
    if (pose === "ĐÚNG") correctSecondsThisMinute++;
    secondsInCurrentMinute++;

    // --- Cập nhật 4 ô thống kê với định dạng thời gian đẹp ① ---
    const grandTotal = POSE_KEYS.reduce((sum, k) => sum + totalSeconds[k], 0);
    POSE_KEYS.forEach((key) => {
      const slug = key.replace(/\s/g, "-");
      const secEl = document.getElementById(`dash-sec-${slug}`);
      const pctEl = document.getElementById(`dash-pct-${slug}`);
      // Dùng formatTime() thay vì hiển thị số giây thô
      if (secEl) secEl.textContent = formatTime(totalSeconds[key]);
      if (pctEl)
        pctEl.textContent =
          grandTotal > 0
            ? ((totalSeconds[key] / grandTotal) * 100).toFixed(1) + "%"
            : "0%";
    });

    // --- Cập nhật Doughnut Chart ---
    if (pieChart) {
      const values = POSE_KEYS.map((k) => totalSeconds[k]);
      const hasData = values.some((v) => v > 0);
      pieChart.data.datasets[0].data = hasData ? values : [1, 0, 0, 0];
      pieChart.update("none"); // Không animate để tránh giật khi cập nhật liên tục

      // Cập nhật % ĐÚNG ở giữa vành khuyên
      const pctEl = document.getElementById("dash-pie-pct");
      if (pctEl && grandTotal > 0) {
        pctEl.textContent =
          ((totalSeconds["ĐÚNG"] / grandTotal) * 100).toFixed(1) + "%";
      }
    }

    // --- Cập nhật đếm ngược đến điểm Line Chart tiếp theo ---
    const remaining = MINUTE_SECONDS - secondsInCurrentMinute;
    const cdEl = document.getElementById("dash-minute-countdown");
    if (cdEl) {
      cdEl.textContent =
        remaining > 0 ? `Điểm tiếp theo: ${remaining}s` : "Đang ghi điểm...";
    }

    // --- Mỗi 60 giây → ghi 1 điểm lên Line Chart ---
    if (secondsInCurrentMinute >= MINUTE_SECONDS) {
      const pct = (correctSecondsThisMinute / MINUTE_SECONDS) * 100;

      // Nhãn trục X dạng HH:MM
      const now = new Date();
      const label =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

      if (lineChart) {
        // Thêm điểm mới — KHÔNG .shift(), giữ toàn bộ lịch sử
        lineChart.data.labels.push(label);
        lineChart.data.datasets[0].data.push(parseFloat(pct.toFixed(1)));

        // Tính cửa sổ hiển thị: luôn show 10 điểm gần nhất
        // Dùng min/max theo chỉ số (index) của trục X category
        const total = lineChart.data.labels.length;
        const showCount = MAX_LINE_POINTS;
        if (total > showCount) {
          // Dịch chuyển vùng nhìn sang phải để bám điểm mới nhất
          lineChart.options.scales.x.min =
            lineChart.data.labels[total - showCount];
          lineChart.options.scales.x.max = lineChart.data.labels[total - 1];
        }

        lineChart.update();
      }

      // Reset bộ đếm phút
      correctSecondsThisMinute = 0;
      secondsInCurrentMinute = 0;
    }
  }

  // ============================================================
  // 9. TẢI THƯ VIỆN THEO ĐÚNG THỨ TỰ: Chart.js → Hammer.js → zoom plugin
  //    chartjs-plugin-zoom phụ thuộc vào Hammer.js (xử lý gesture chuột/cảm ứng).
  //    Phải load tuần tự, không load song song.
  // ============================================================
  function loadScript(src, onDone) {
    const s = document.createElement("script");
    s.src = src;
    s.onload = onDone;
    s.onerror = () => console.error("[Dashboard] Lỗi tải:", src);
    document.head.appendChild(s);
  }

  // Bước 1: Chart.js
  loadScript(
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
    () => {
      // Bước 2: Hammer.js (bắt buộc trước zoom plugin)
      loadScript(
        "https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js",
        () => {
          // Bước 3: chartjs-plugin-zoom
          loadScript(
            "https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js",
            () => {
              // Tất cả đã sẵn sàng → khởi tạo biểu đồ và vòng lặp
              initCharts();
              setInterval(updateEverySecond, SAMPLE_INTERVAL);
              console.log(
                "[Dashboard] Sẵn sàng. Zoom/Pan đã bật. Ghi điểm mỗi 60 giây.",
              );
            },
          );
        },
      );
    },
  );
})();
