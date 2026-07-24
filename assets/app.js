(() => {
  "use strict";

  const STORAGE_KEY = "ai-usage-strata-ledger-v1";
  const app = document.querySelector("#app");
  const fileInput = document.querySelector("#ledger-file");
  const palette = ["#3f71a7", "#6fa8ca", "#b4d9e8", "#f5bda6", "#ee765b", "#bd3949"];
  const storedLedger = readStored();
  let source = storedLedger ? "imported" : "demo";
  let ledger = storedLedger || clone(window.AI_USAGE_STRATA_DEMO);
  let selectedKey = null;
  let activeMonth = "all";
  let hitPoints = [];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  }
  function readStored() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return validateLedger(parsed).valid ? parsed : null;
    } catch (_) { return null; }
  }
  function saveStored(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) { /* The current page still works without persistence. */ }
  }
  function removeStored() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* Nothing to remove when storage is unavailable. */ }
  }
  function isoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : null; }
  function numeric(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }
  function validateLedger(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.records)) return { valid: false, message: "The file needs a records array." };
    const invalid = value.records.find((record) => !record || !isoDate(record.date) || !Number.isFinite(Number(record.hours)) || Number(record.hours) < 0);
    return invalid ? { valid: false, message: "Every record needs an ISO date and non-negative hours." } : { valid: true };
  }
  function normalizedRecords() {
    return ledger.records.map((record, index) => ({
      ...record,
      id: `${record.date}-${index}`,
      hours: numeric(record.hours),
      input_chars: numeric(record.input_chars),
      output_chars: numeric(record.output_chars),
      activity_count: numeric(record.activity_count),
      category: String(record.category || "Unsorted"),
      confidence: record.confidence === "estimated" ? "estimated" : "recorded",
      evidence: Array.isArray(record.evidence) ? record.evidence : []
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
  function months(records) { return [...new Set(records.map((record) => record.date.slice(0, 7)))]; }
  function visibleRecords(records) { return activeMonth === "all" ? records : records.filter((record) => record.date.startsWith(activeMonth)); }
  function total(records, field) { return records.reduce((sum, record) => sum + numeric(record[field]), 0); }
  function formatNumber(value) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0); }
  function formatHours(value) { return `${(value || 0).toFixed(1)}h`; }
  function readableMonth(value) {
    if (value === "all") return "All recorded months";
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));
  }
  function initials(label) { return label.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AI"; }
  function render() {
    const records = normalizedRecords();
    const scoped = visibleRecords(records);
    const periods = months(records);
    const range = scoped.length ? `${scoped[0].date} — ${scoped.at(-1).date}` : "No records yet";
    const recorded = scoped.filter((record) => record.confidence === "recorded");
    const estimated = scoped.filter((record) => record.confidence === "estimated");
    const profile = ledger.profile?.label || "My workspace";
    app.innerHTML = `
      <header class="site-header">
        <a class="brand" href="#top" aria-label="AI Usage Strata home">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span><em>local-first tool</em><strong>AI Usage Strata</strong><small>Time, evidence, and confidence</small></span>
        </a>
        <div class="header-actions">
          <span class="local-note">Local only · no upload</span>
          <button class="quiet-button" data-action="export">Export current ledger</button>
        </div>
      </header>
      <section class="intro" id="top">
        <div>
          <p class="eyebrow">${escapeHtml(profile)} · ${source === "demo" ? "fictional demo" : "your local ledger"}</p>
          <h1>See the shape of your work with AI.</h1>
          <p class="lede">Curved ridges show when the work gathered momentum. Every point can lead back to a note, a log, or another piece of evidence you chose to keep.</p>
        </div>
        <div class="control-card">
          <span>Ledger source</span>
          <strong>${source === "demo" ? "Sample data" : "Imported locally"}</strong>
          <div class="control-row">
            <button class="primary-button" data-action="import">Import ledger</button>
            <button class="text-button" data-action="reset">Return to demo</button>
          </div>
        </div>
      </section>
      <section class="scope-bar" aria-label="Time range">
        <div class="month-scroller" role="tablist" aria-label="Choose time range">
          <button role="tab" aria-selected="${activeMonth === "all"}" class="${activeMonth === "all" ? "active" : ""}" data-month="all">All</button>
          ${periods.map((month) => `<button role="tab" aria-selected="${activeMonth === month}" class="${activeMonth === month ? "active" : ""}" data-month="${month}">${month.slice(0, 4)} · ${Number(month.slice(5))}</button>`).join("")}
        </div>
        <p>${escapeHtml(readableMonth(activeMonth))}<small>${escapeHtml(range)} · ${scoped.length} recorded days</small></p>
      </section>
      <section class="metric-grid" aria-label="Usage summary">
        ${metricCard("Time with AI", formatHours(total(scoped, "hours")), `${recorded.length} recorded · ${estimated.length} estimated`, "hours")}
        ${metricCard("Your input", formatNumber(total(scoped, "input_chars")), "Characters you sent", "input")}
        ${metricCard("AI output", formatNumber(total(scoped, "output_chars")), "Characters returned", "output")}
        ${metricCard("Activity signals", formatNumber(total(scoped, "activity_count")), "Logged sessions or events", "activity")}
      </section>
      <section class="panel ridge-panel">
        <div class="panel-head ridge-head">
          <div><p class="eyebrow">Time and intensity</p><h2 id="ridge-title">${peakTitle(scoped)}</h2><p>Each ridge is one month. Height is hours per day; colour moves from lighter to more intense work.</p></div>
          <div class="legend"><span></span><small>lighter</small><b>→</b><small>more intense</small></div>
        </div>
        <div class="chart-wrap"><canvas id="ridge-chart" aria-label="Curved ridgeline chart of AI work hours" role="img"></canvas></div>
        <div class="chart-foot"><span>Click a small date mark to inspect its evidence.</span><span id="chart-tip">${scoped.length ? "Drag is unnecessary: use the month rail above." : "Import a ledger to begin."}</span></div>
      </section>
      <section class="analysis-grid">
        <section class="panel allocation-panel">
          <div class="panel-head"><div><p class="eyebrow">Scale and direction</p><h2>Weekly investment</h2><p>Length is total time; colour is the mix of work categories.</p></div></div>
          <div id="weekly-bars" class="weekly-bars"></div>
        </section>
        <aside class="panel evidence-panel" id="evidence-panel">
          <p class="eyebrow">Evidence for this view</p>
          <h2 id="evidence-title">Choose a date mark</h2>
          <p id="evidence-copy">Evidence never has to be uploaded. Keep a short label here, and optionally a link that only works in your own local system.</p>
          <div id="evidence-list" class="evidence-list"></div>
        </aside>
      </section>
      <footer><span>AI Usage Strata · MIT © 2026 Nova Kepler</span><span>Static, local-first, no telemetry</span></footer>`;
    attachEvents();
    renderWeeklyBars(scoped);
    requestAnimationFrame(() => drawRidges(scoped));
  }
  function metricCard(label, value, caption, kind) {
    return `<article class="metric-card metric-${kind}"><span>${label}</span><strong>${value}</strong><small>${caption}</small></article>`;
  }
  function peakTitle(records) {
    if (!records.length) return "No time records in this view";
    const peak = [...records].sort((a, b) => b.hours - a.hours)[0];
    return `${peak.date} was the highest recorded peak`;
  }
  function attachEvents() {
    app.querySelectorAll("[data-month]").forEach((button) => button.addEventListener("click", () => { activeMonth = button.dataset.month; selectedKey = null; render(); }));
    app.querySelector('[data-action="import"]').addEventListener("click", () => fileInput.click());
    app.querySelector('[data-action="reset"]').addEventListener("click", () => { removeStored(); ledger = clone(window.AI_USAGE_STRATA_DEMO); source = "demo"; activeMonth = "all"; selectedKey = null; render(); });
    app.querySelector('[data-action="export"]').addEventListener("click", exportLedger);
  }
  function drawRidges(scoped) {
    const canvas = document.querySelector("#ridge-chart");
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(box.width * ratio));
    canvas.height = Math.max(1, Math.floor(box.height * ratio));
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const width = box.width;
    const height = box.height;
    context.clearRect(0, 0, width, height);
    hitPoints = [];
    const grouped = groupByMonth(scoped);
    if (!grouped.length) { context.fillStyle = "#7e8a95"; context.font = "15px system-ui"; context.fillText("No data in this time range.", 24, 42); return; }
    const maxHours = Math.max(...scoped.map((record) => record.hours), 1);
    const left = 52, right = 36, top = 34, bottom = 44;
    const layerGap = Math.max(54, Math.min(86, (height - top - bottom) / grouped.length));
    const chartHeight = Math.max(80, Math.min(190, layerGap * 1.45));
    const maxDay = 31;
    context.lineWidth = 1;
    grouped.forEach((group, index) => {
      const baseline = height - bottom - index * layerGap;
      const points = Array.from({ length: maxDay }, (_, day) => {
        const record = group.records.find((item) => Number(item.date.slice(-2)) === day + 1);
        const x = left + (day / (maxDay - 1)) * (width - left - right);
        const y = baseline - (record ? (record.hours / maxHours) * chartHeight : 0);
        return { x, y, record };
      });
      context.strokeStyle = "rgba(76, 102, 125, .17)";
      context.beginPath(); context.moveTo(left, baseline); context.lineTo(width - right, baseline); context.stroke();
      const color = palette[Math.min(palette.length - 1, Math.round((index / Math.max(1, grouped.length - 1)) * (palette.length - 1)))];
      const area = points.filter((point) => point.record);
      if (area.length) {
        context.beginPath(); context.moveTo(area[0].x, baseline); smoothLine(context, area); context.lineTo(area.at(-1).x, baseline); context.closePath();
        const fill = context.createLinearGradient(0, baseline - chartHeight, 0, baseline);
        fill.addColorStop(0, withAlpha(color, .84)); fill.addColorStop(1, withAlpha(color, .17));
        context.fillStyle = fill; context.fill();
        context.strokeStyle = withAlpha(color, .88); context.lineWidth = 1.7; context.beginPath(); smoothLine(context, area); context.stroke();
        area.forEach((point) => {
          context.fillStyle = point.record.confidence === "estimated" ? "#fffaf4" : color;
          context.strokeStyle = color; context.lineWidth = 1.6; context.beginPath(); context.arc(point.x, point.y, 3.8, 0, Math.PI * 2); context.fill(); context.stroke();
          hitPoints.push({ ...point, radius: 13, color });
        });
      }
      context.fillStyle = "#5c6670"; context.font = "600 12px system-ui"; context.fillText(group.label, width - right + 8, baseline + 4);
    });
    context.fillStyle = "#74808c"; context.font = "12px system-ui";
    [1, 8, 15, 22, 29].forEach((day) => { const x = left + ((day - 1) / (maxDay - 1)) * (width - left - right); context.fillText(String(day), x - 4, height - 14); });
    canvas.onclick = (event) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left; const y = event.clientY - bounds.top;
      const target = hitPoints.map((point) => ({ point, distance: Math.hypot(point.x - x, point.y - y) })).sort((a, b) => a.distance - b.distance)[0];
      if (target?.distance <= target.point.radius) { selectedKey = target.point.record.id; showEvidence(target.point.record); }
    };
  }
  function smoothLine(context, points) {
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length - 1; index += 1) {
      const midpointX = (points[index].x + points[index + 1].x) / 2;
      const midpointY = (points[index].y + points[index + 1].y) / 2;
      context.quadraticCurveTo(points[index].x, points[index].y, midpointX, midpointY);
    }
    if (points.length > 1) context.lineTo(points.at(-1).x, points.at(-1).y);
  }
  function withAlpha(hex, alpha) {
    const raw = hex.replace("#", ""); const value = Number.parseInt(raw, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  function groupByMonth(records) {
    return months(records).map((month) => ({ label: month, records: records.filter((record) => record.date.startsWith(month)) })).reverse();
  }
  function weekKey(date) {
    const value = new Date(`${date}T12:00:00`); const day = (value.getDay() + 6) % 7; value.setDate(value.getDate() - day); return value.toISOString().slice(0, 10);
  }
  function renderWeeklyBars(records) {
    const root = document.querySelector("#weekly-bars");
    const weeks = [...new Set(records.map((record) => weekKey(record.date)))].map((key) => ({ key, records: records.filter((record) => weekKey(record.date) === key) }));
    const categories = [...new Set(records.map((record) => record.category))];
    const largest = Math.max(...weeks.map((week) => total(week.records, "hours")), 1);
    root.innerHTML = weeks.length ? weeks.slice(-7).reverse().map((week) => {
      const amount = total(week.records, "hours");
      const segments = categories.map((category, index) => ({ category, value: total(week.records.filter((record) => record.category === category), "hours"), color: palette[index % palette.length] })).filter((segment) => segment.value);
      const top = [...segments].sort((a, b) => b.value - a.value)[0];
      return `<div class="week-row"><div><strong>${week.key}</strong><small>${week.records.length} active days</small></div><b>${formatHours(amount)}</b><div class="bar-track" aria-label="${escapeHtml(week.key)} ${formatHours(amount)}">${segments.map((segment) => `<span style="width:${(segment.value / largest) * 100}%;background:${segment.color}" title="${escapeHtml(segment.category)} ${formatHours(segment.value)}"></span>`).join("")}</div><small class="top-category">${escapeHtml(top?.category || "")}</small></div>`;
    }).join("") : `<p class="empty-state">No weekly records in this view.</p>`;
  }
  function showEvidence(record) {
    const title = document.querySelector("#evidence-title"); const copy = document.querySelector("#evidence-copy"); const list = document.querySelector("#evidence-list");
    title.textContent = `${record.date} · ${formatHours(record.hours)}`;
    const quality = record.confidence === "estimated" ? `Estimated — ${record.estimate_basis || "basis not yet recorded"}` : "Recorded directly in the ledger";
    copy.textContent = `${quality}. ${record.activity_count || 0} activity signals · ${record.category}.`;
    list.innerHTML = record.evidence.length ? record.evidence.map((item) => item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><span>${escapeHtml(item.type || "evidence")}</span><strong>${escapeHtml(item.label || "Open record")}</strong></a>` : `<div><span>${escapeHtml(item.type || "evidence")}</span><strong>${escapeHtml(item.label || "Untitled record")}</strong></div>`).join("") : `<div><span>evidence</span><strong>No linked evidence was added.</strong></div>`;
    document.querySelector("#evidence-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function exportLedger() {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ai-usage-ledger.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result)); const checked = validateLedger(next);
        if (!checked.valid) throw new Error(checked.message);
        ledger = next; source = "imported"; activeMonth = "all"; selectedKey = null; saveStored(next); render();
      } catch (error) { window.alert(`Could not import this ledger: ${error.message}`); }
      fileInput.value = "";
    };
    reader.readAsText(file);
  });
  window.addEventListener("resize", () => requestAnimationFrame(() => drawRidges(visibleRecords(normalizedRecords()))));
  render();
})();
