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
        <p>${selectedDays.length === 1 ? "这一天" : "这段时间"}留下了什么记录；哪些数字是直接记下的，哪些是据此补出的。</p>
      </section>
      <section class="evidence-method" aria-labelledby="estimate-method-title">
        <header>
          <div><p class="eyebrow">这组数字怎么算</p><h2 id="estimate-method-title">记下来的，和估出来的</h2></div>
          <span class="evidence-status evidence-estimate">估算</span>
        </header>
        <p class="model-lead">账本里有的，按记录算；账本里没有的，不补成一个看似准确的数字。带“估算”的部分，旁边都会写清楚是按什么推的。</p>
        <div class="model-formula">
          <code>已记录：你自己留在账本里的数字。</code>
          <code>估算：根据留下的记录补出的范围，并说明理由。</code>
          <p>这段时间有 ${summary.activeDays} 天留下记录，共 ${summary.commits} 次使用。图上的高低只帮你看忙闲，不等于正式工时。</p>
        </div>
        <div class="model-inputs">
          <div><small>这次看得到的</small><p>你记下的时间、输入输出、做的事，以及当天留下的线索。</p></div>
          <div><small>估算时看什么</small><p>${escapeHtml(baseline.range || "未填写说明")}：已记下 ${baselineHours}，输入 ${baselineInput}，AI 返回 ${baselineOutput}。</p></div>
          <div><small>图表怎么读</small><p>山峰越高，代表那天投入越多。旁边的范围用来比较，不是考勤。</p></div>
        </div>
      </section>
      <section class="evidence-metrics evidence-facts" aria-label="已经查到的活动">
        <span><small>有记录的日子 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.activeDays} 天</b></span>
        <span><small>使用次数 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.commits}</b></span>
        <span><small>当天备注 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.semantic}</b></span>
        <span><small>有用量记录的日子 <em class="evidence-status evidence-confirmed">已记录</em></small><b>${summary.visibleDays} 天</b></span>
      </section>
      <section class="estimate-results" aria-labelledby="estimate-result-title">
        <header><div><p class="eyebrow">数字说明</p><h2 id="estimate-result-title">这里的数字，哪些是直接记下的</h2></div></header>
        <div class="estimate-grid">
          <article><small><span>和 AI 一起工作的时间</span><em class="evidence-status ${isEstimated(summary.timeRange, summary.measuredHours) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.timeRange, summary.measuredHours) ? "估算" : "已记录"}</em></small><strong>${hours(summary.hoursCenter)}</strong><p>${isEstimated(summary.timeRange, summary.measuredHours) ? `大约在 ${hoursRange(summary.timeRange)}` : `已经记下 ${hours(summary.measuredHours)}`}</p><i>${isEstimated(summary.timeRange, summary.measuredHours) ? `其中已记下 ${hours(summary.measuredHours)}` : "来自你的账本"}</i></article>
          <article><small><span>你发给 AI 的文字</span><em class="evidence-status ${isEstimated(summary.inputRange, summary.loggedInput) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.inputRange, summary.loggedInput) ? "估算" : "已记录"}</em></small><strong>${compact(summary.inputCenter)}</strong><p>${isEstimated(summary.inputRange, summary.loggedInput) ? `大约在 ${compactRange(summary.inputRange)}` : `已经记下 ${compact(summary.loggedInput)}`}</p><i>${isEstimated(summary.inputRange, summary.loggedInput) ? `其中已记下 ${compact(summary.loggedInput)}` : "来自你的账本"}</i></article>
          <article><small><span>AI 返回的文字</span><em class="evidence-status ${isEstimated(summary.outputRange, summary.loggedOutput) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.outputRange, summary.loggedOutput) ? "估算" : "已记录"}</em></small><strong>${compact(summary.outputCenter)}</strong><p>${isEstimated(summary.outputRange, summary.loggedOutput) ? `大约在 ${compactRange(summary.outputRange)}` : `已经记下 ${compact(summary.loggedOutput)}`}</p><i>${isEstimated(summary.outputRange, summary.loggedOutput) ? `其中已记下 ${compact(summary.loggedOutput)}` : "来自你的账本"}</i></article>
        </div>
        <p class="coverage-note">${percent(summary.coverage)} 的有记录日子里，能找到用量。这个比例越低，估算越该当作参考，不要把中间值当成准数。</p>
      </section>
      <section class="evidence-section active-day-section">
        <header><p class="eyebrow">按天查看</p><h2>哪些日子留了记录</h2><span>${activeDates.length} 天有记录 · 共 ${activityDates.length} 天留了痕迹</span></header>
        <div class="active-day-list">
          ${activityDates.length ? activityDates.map((item) => {
            const visibleAI = Number(item.measured_hours) || Number(item.input_chars) || Number(item.output_chars);
            return `<a href="evidence.html?date=${encodeURIComponent(item.date)}"><strong>${escapeHtml(item.date)}</strong><span>${item.commits ? `${item.commits} 次使用` : "没有使用记录"}</span><span>${item.semantic} 条当天备注</span><span>${item.files} 条线索</span><em>${visibleAI ? "有用量记录" : "没有用量记录"}</em></a>`;
          }).join("") : `<p class="evidence-empty">这段时间还没有能按日期找到的记录。</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">当天留下的线索</p><h2>${selectedDays.length === 1 ? "这一天留下的资料" : "这段时间留下的资料"}</h2><span>${records.length} 份</span></header>
        <div class="evidence-links">
          ${records.length ? records.map((record) => `<a href="${escapeHtml(record.url)}"><span>${escapeHtml(record.name)}</span><small>${escapeHtml(record.path)}</small></a>`).join("") : `<p class="evidence-empty">没有找到以这个日期命名的文档。</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">使用记录</p><h2>这段时间做了什么</h2><span>显示 ${commits.length} 条 / 共 ${summary.commits} 条</span></header>
        <div class="commit-list">
          ${commits.length ? commits.map((commit) => `<div><code>${escapeHtml(commit.sha)}</code><span>${escapeHtml(commit.subject)}</span><small>${escapeHtml(commit.date)}</small></div>`).join("") : `<p class="evidence-empty">这段时间没有使用记录。</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">外部文件 · 共 ${fileTouches} 条</p><h2>你选择留下的本地链接</h2><span>${currentFiles.length} 项</span></header>
        <div class="file-list">
          ${currentFiles.map((file) => `<a href="${escapeHtml(file.url)}"><span>${escapeHtml(file.path)}</span><small>${escapeHtml(file.date)}</small></a>`).join("") || `<p class="evidence-empty">公开版不会自动读取设备文件；需要时可在账本证据里自行留下链接。</p>`}
        </div>
      </section>
      <footer><span>直接记录来自你主动导入的账本；估算会保留理由</span><span>数据只留在这台设备</span></footer>
    </div>`;

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    root.querySelector(".theme-switch")?.setAttribute("aria-pressed", String(theme === "dark"));
    localStorage.setItem("ai-usage-strata-theme", theme);
  };
  setTheme(localStorage.getItem("ai-usage-strata-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  root.querySelector(".theme-switch")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
})();
