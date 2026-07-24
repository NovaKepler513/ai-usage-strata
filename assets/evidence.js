(() => {
  const data = window.AI_USAGE_STRATA_REPORT;
  const root = document.getElementById("evidence-root");
  const estimator = window.AI_USAGE_STRATA_ESTIMATOR;
  if (!data || !root || !estimator || !Array.isArray(data.timeline)) return;

  const params = new URLSearchParams(window.location.search);
  const requestedDate = params.get("date");
  const requestedFrom = params.get("from");
  const requestedTo = params.get("to");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[char]));
  const compact = (value) => {
    const number = Number(value) || 0;
    if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)} 万`;
    return Math.round(number).toLocaleString("zh-CN");
  };
  const hours = (value) => `${Number(value || 0).toFixed(1)}h`;
  const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
  const compactRange = (values) => `${compact(values[0])}—${compact(values[1])}`;
  const hoursRange = (values) => `${hours(values[0])}—${hours(values[1])}`;
  const isEstimated = (range, measured) => Math.abs(range[0] - measured) > 0.001 || Math.abs(range[1] - measured) > 0.001;
  const selectedDays = data.timeline.filter((item) => {
    if (requestedDate) return item.date === requestedDate;
    if (requestedFrom && requestedTo) return item.date >= requestedFrom && item.date <= requestedTo;
    return item.date === data.history.end;
  });
  const title = requestedDate || (requestedFrom && requestedTo ? `${requestedFrom} — ${requestedTo}` : data.history.end);
  const summary = estimator.estimateFor(selectedDays, data.calibration);
  const activeDates = selectedDays.filter((item) => Number(item.commits) > 0);
  const activityDates = selectedDays.filter((item) =>
    Number(item.commits) > 0 ||
    Number(item.measured_hours) > 0 ||
    Number(item.input_chars) > 0 ||
    Number(item.output_chars) > 0 ||
    Number(item.files) > 0 ||
    (item.evidence?.records || []).length > 0
  );
  const fileTouches = selectedDays.reduce((total, item) => total + (Number(item.files) || 0), 0);
  const records = selectedDays.flatMap((item) => (item.evidence?.records || []).map((record) => ({ ...record, date: item.date })));
  const commits = selectedDays.flatMap((item) => (item.evidence?.commits || []).map((commit) => ({ ...commit, date: item.date })));
  const files = selectedDays.flatMap((item) => (item.evidence?.files || []).map((file) => ({ ...file, date: item.date })));
  const uniqueFiles = [...new Map(files.map((item) => [item.path, item])).values()];
  const currentFiles = uniqueFiles.filter((item) => item.exists);
  const calibration = data.calibration;
  const baseline = data.baseline || {};
  const baselineHours = Array.isArray(baseline.human_ai_hours) ? hoursRange(baseline.human_ai_hours) : "未登记";
  const baselineInput = Array.isArray(baseline.input_chars) ? compactRange(baseline.input_chars) : "未登记";
  const baselineOutput = Array.isArray(baseline.visible_output_chars) ? compactRange(baseline.visible_output_chars) : "未登记";

  root.innerHTML = `
    <div class="evidence-shell">
      <header class="evidence-topbar">
        <a class="evidence-back" href="index.html">← 返回时间地层</a>
        <button class="theme-switch" type="button" aria-label="切换明暗主题" aria-pressed="false"><span></span></button>
      </header>
      <section class="evidence-hero">
        <div class="strata-sign strata-sign-small" aria-hidden="true">
          <svg viewBox="0 0 82 52">
            <path class="sign-plane sign-plane-back" d="M2 42C13 38 17 28 27 29C37 30 40 39 50 34C61 29 65 15 80 11L80 48H2Z"/>
            <path class="sign-plane sign-plane-mid" d="M2 45C14 42 20 35 30 36C41 38 46 27 57 25C67 24 73 31 80 28L80 48H2Z"/>
            <path class="sign-line sign-line-front" d="M2 46C15 44 22 40 34 41C47 43 53 35 64 33C72 32 77 36 80 35"/>
            <circle class="sign-node" cx="64" cy="33" r="2.4"/>
          </svg>
        </div>
        <p class="eyebrow">这组数字从哪里来</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${selectedDays.length === 1 ? "这一天" : "这段时间"}已经记录了什么，还有哪些数字是估出来的。</p>
      </section>
      <section class="evidence-method" aria-labelledby="estimate-method-title">
        <header>
          <div><p class="eyebrow">估算方法</p><h2 id="estimate-method-title">没有记录的部分，是这样估出来的</h2></div>
          <span class="evidence-status evidence-estimate">估算</span>
        </header>
        <p class="model-lead">不是让 AI 凭感觉猜。已记录的数据直接来自你导入的账本；标为“估算”的日期必须附带估算依据。页面不会把已记录的值改小，也不会把没有依据的空白伪装成数字。</p>
        <div class="model-formula">
          <code>已记录 = 账本中 confidence 为 recorded 的数据</code>
          <code>估算 = 账本中 confidence 为 estimated，并写明 estimate_basis 的数据</code>
          <p>这次范围内：${summary.activeDays} 个活跃日，${summary.commits} 条活动信号，平均每天 ${summary.averageCommits.toFixed(1)} 条。页面只把它用作展示尺度，不把它当成工时考勤。</p>
        </div>
        <div class="model-inputs">
          <div><small>这次直接查到的</small><p>你导入的时间、输入、输出、活动次数、分类和当天证据标签。</p></div>
          <div><small>估算依据</small><p>${escapeHtml(baseline.range || "未登记范围")}：已经记录 ${baselineHours}，输入 ${baselineInput}，AI 返回 ${baselineOutput}。</p></div>
          <div><small>展示尺度</small><p>每个活跃日约 ${calibration.hours_per_active_day[0]}—${calibration.hours_per_active_day[1]} 小时；输入 ${compactRange(calibration.input_chars_per_active_day)}；AI 返回 ${compactRange(calibration.output_chars_per_active_day)}。</p></div>
        </div>
      </section>
      <section class="evidence-metrics evidence-facts" aria-label="已经查到的活动">
        <span><small>活跃日 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.activeDays} 天</b></span>
        <span><small>活动信号 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.commits}</b></span>
        <span><small>当天记录 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.semantic}</b></span>
        <span><small>有 AI 用量的日期 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.visibleDays} 天</b></span>
      </section>
      <section class="estimate-results" aria-labelledby="estimate-result-title">
        <header><div><p class="eyebrow">数字说明</p><h2 id="estimate-result-title">哪些已经记录，哪些只是估算</h2></div></header>
        <div class="estimate-grid">
          <article><small><span>和 AI 一起工作的时间</span><em class="evidence-status ${isEstimated(summary.timeRange, summary.measuredHours) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.timeRange, summary.measuredHours) ? "估算" : "已记录"}</em></small><strong>${hours(summary.hoursCenter)}</strong><p>${isEstimated(summary.timeRange, summary.measuredHours) ? `大约在 ${hoursRange(summary.timeRange)}` : `已经记录 ${hours(summary.measuredHours)}`}</p><i>${isEstimated(summary.timeRange, summary.measuredHours) ? `本机已记录 ${hours(summary.measuredHours)}` : "来自本机记录"}</i></article>
          <article><small><span>你发给 AI 的文字</span><em class="evidence-status ${isEstimated(summary.inputRange, summary.loggedInput) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.inputRange, summary.loggedInput) ? "估算" : "已记录"}</em></small><strong>${compact(summary.inputCenter)}</strong><p>${isEstimated(summary.inputRange, summary.loggedInput) ? `大约在 ${compactRange(summary.inputRange)}` : `已经记录 ${compact(summary.loggedInput)}`}</p><i>${isEstimated(summary.inputRange, summary.loggedInput) ? `本机已记录 ${compact(summary.loggedInput)}` : "来自本机记录"}</i></article>
          <article><small><span>AI 返回的文字</span><em class="evidence-status ${isEstimated(summary.outputRange, summary.loggedOutput) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.outputRange, summary.loggedOutput) ? "估算" : "已记录"}</em></small><strong>${compact(summary.outputCenter)}</strong><p>${isEstimated(summary.outputRange, summary.loggedOutput) ? `大约在 ${compactRange(summary.outputRange)}` : `已经记录 ${compact(summary.loggedOutput)}`}</p><i>${isEstimated(summary.outputRange, summary.loggedOutput) ? `本机已记录 ${compact(summary.loggedOutput)}` : "来自本机记录"}</i></article>
        </div>
        <p class="coverage-note">${percent(summary.coverage)} 的活跃日有已记录 AI 用量。这个比例越低，估算就越不确定，应该先看范围，不要只看中间值。</p>
      </section>
      <section class="evidence-section active-day-section">
        <header><p class="eyebrow">按天查看</p><h2>哪几天有记录</h2><span>${activeDates.length} 个活跃日 · 共 ${activityDates.length} 天有记录</span></header>
        <div class="active-day-list">
          ${activityDates.length ? activityDates.map((item) => {
            const visibleAI = Number(item.measured_hours) || Number(item.input_chars) || Number(item.output_chars);
            return `<a href="evidence.html?date=${encodeURIComponent(item.date)}"><strong>${escapeHtml(item.date)}</strong><span>${item.commits ? `${item.commits} 条活动` : "没有活动信号"}</span><span>${item.semantic} 条当天记录</span><span>证据标签 ${item.files} 条</span><em>${visibleAI ? "有已记录 AI 用量" : "没有已记录 AI 用量"}</em></a>`;
          }).join("") : `<p class="evidence-empty">这段时间还没有能按日期找到的记录。</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">按日期找到的文档</p><h2>${selectedDays.length === 1 ? "这一天的相关文档" : "这段时间的相关文档"}</h2><span>${records.length} 份</span></header>
        <div class="evidence-links">
          ${records.length ? records.map((record) => `<a href="${escapeHtml(record.url)}"><span>${escapeHtml(record.name)}</span><small>${escapeHtml(record.path)}</small></a>`).join("") : `<p class="evidence-empty">没有找到以这个日期命名的文档。</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">活动记录</p><h2>这段时间做了什么</h2><span>显示 ${commits.length} 条 / 共 ${summary.commits} 条</span></header>
        <div class="commit-list">
          ${commits.length ? commits.map((commit) => `<div><code>${escapeHtml(commit.sha)}</code><span>${escapeHtml(commit.subject)}</span><small>${escapeHtml(commit.date)}</small></div>`).join("") : `<p class="evidence-empty">这段时间没有活动记录。</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">外部文件 · 共 ${fileTouches} 条</p><h2>你选择留下的本地链接</h2><span>${currentFiles.length} 项</span></header>
        <div class="file-list">
          ${currentFiles.map((file) => `<a href="${escapeHtml(file.url)}"><span>${escapeHtml(file.path)}</span><small>${escapeHtml(file.date)}</small></a>`).join("") || `<p class="evidence-empty">公开版不会自动读取设备文件；需要时可在账本证据里自行留下链接。</p>`}
        </div>
      </section>
      <footer><span>直接记录只来自你主动导入的账本；估算必须保留依据</span><span>数据只留在这台设备</span></footer>
    </div>`;

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    root.querySelector(".theme-switch")?.setAttribute("aria-pressed", String(theme === "dark"));
    localStorage.setItem("ai-usage-strata-theme", theme);
  };
  setTheme(localStorage.getItem("ai-usage-strata-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  root.querySelector(".theme-switch")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
})();
