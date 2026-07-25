(() => {
  const data = window.AI_USAGE_STRATA_REPORT;
  const root = document.getElementById("evidence-root");
  const estimator = window.AI_USAGE_STRATA_ESTIMATOR;
  if (!data || !root || !estimator || !Array.isArray(data.timeline)) return;
  const i18n = window.AI_USAGE_STRATA_I18N;
  const t = i18n?.t || ((key) => key);
  const isEnglish = i18n?.language === "en";

  const params = new URLSearchParams(window.location.search);
  const requestedDate = params.get("date");
  const requestedFrom = params.get("from");
  const requestedTo = params.get("to");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[char]));
  const compact = (value) => {
    const number = Number(value) || 0;
    if (isEnglish && number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
    if (isEnglish && number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
    if (!isEnglish && number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)} 万`;
    return Math.round(number).toLocaleString(isEnglish ? "en-US" : "zh-CN");
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
        <a class="evidence-back" href="index.html">${t("evidenceBack")}</a>
        <div class="app-actions"><button class="ledger-action ledger-action-quiet language-switch" type="button" data-language-switch>${t("language")}</button><button class="theme-switch" type="button" aria-label="${t("switchTheme")}" aria-pressed="false"><span></span></button></div>
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
        <p class="eyebrow">${t("source")}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${isEnglish ? `This ${selectedDays.length === 1 ? "day" : "period"} shows ${t("sourceIntro")}` : `${selectedDays.length === 1 ? "这一天" : "这段时间"}${t("sourceIntro")}`}</p>
      </section>
      <section class="evidence-method" aria-labelledby="estimate-method-title">
        <header>
          <div><p class="eyebrow">${t("howCalculated")}</p><h2 id="estimate-method-title">${t("recordedAndEstimated")}</h2></div>
          <span class="evidence-status evidence-estimate">${t("estimate")}</span>
        </header>
        <p class="model-lead">${isEnglish ? "What is in the ledger stays recorded. What is missing is never turned into a falsely precise number. Every estimate keeps its reason beside it." : "账本里有的，按记录算；账本里没有的，不补成一个看似准确的数字。带“估算”的部分，旁边都会写清楚是按什么推的。"}</p>
        <div class="model-formula">
          <code>${isEnglish ? "Recorded: numbers you put in the ledger." : "已记录：你自己留在账本里的数字。"}</code>
          <code>${isEnglish ? "Estimated: a range rebuilt from those records, with a reason." : "估算：根据留下的记录补出的范围，并说明理由。"}</code>
          <p>${isEnglish ? `${summary.activeDays} days left a record, with ${summary.commits} uses in total. Height shows relative intensity, not payroll time.` : `这段时间有 ${summary.activeDays} 天留下记录，共 ${summary.commits} 次使用。图上的高低只帮你看忙闲，不等于正式工时。`}</p>
        </div>
        <div class="model-inputs">
          <div><small>${t("visibleNow")}</small><p>${isEnglish ? "The time, input, output, work, and traces you chose to keep." : "你记下的时间、输入输出、做的事，以及当天留下的线索。"}</p></div>
          <div><small>${t("estimatedFrom")}</small><p>${escapeHtml(baseline.range || (isEnglish ? "No note provided" : "未填写说明"))}：${isEnglish ? `recorded ${baselineHours}, input ${baselineInput}, output ${baselineOutput}.` : `已记下 ${baselineHours}，输入 ${baselineInput}，AI 返回 ${baselineOutput}。`}</p></div>
          <div><small>${t("chartRead")}</small><p>${isEnglish ? "A higher ridge means more work that day. The range helps comparison; it is not attendance." : "山峰越高，代表那天投入越多。旁边的范围用来比较，不是考勤。"}</p></div>
        </div>
      </section>
      <section class="evidence-metrics evidence-facts" aria-label="已经查到的活动">
        <span><small>${isEnglish ? "Recorded days" : "有记录的日子"} <em class="evidence-status evidence-confirmed">${t("recorded")}</em></small><b>${summary.activeDays} ${t("days")}</b></span>
        <span><small>${isEnglish ? "Uses" : "使用次数"} <em class="evidence-status evidence-confirmed">${t("recorded")}</em></small><b>${summary.commits}</b></span>
        <span><small>${isEnglish ? "Daily notes" : "当天备注"} <em class="evidence-status evidence-confirmed">${t("recorded")}</em></small><b>${summary.semantic}</b></span>
        <span><small>${isEnglish ? "Days with usage" : "有用量记录的日子"} <em class="evidence-status evidence-confirmed">${t("recorded")}</em></small><b>${summary.visibleDays} ${t("days")}</b></span>
      </section>
      <section class="estimate-results" aria-labelledby="estimate-result-title">
        <header><div><p class="eyebrow">${isEnglish ? "Reading the numbers" : "数字说明"}</p><h2 id="estimate-result-title">${isEnglish ? "Which numbers were written down" : "这里的数字，哪些是直接记下的"}</h2></div></header>
        <div class="estimate-grid">
          <article><small><span>${t("time")}</span><em class="evidence-status ${isEstimated(summary.timeRange, summary.measuredHours) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.timeRange, summary.measuredHours) ? t("estimate") : t("recorded")}</em></small><strong>${hours(summary.hoursCenter)}</strong><p>${isEstimated(summary.timeRange, summary.measuredHours) ? (isEnglish ? `About ${hoursRange(summary.timeRange)}` : `大约在 ${hoursRange(summary.timeRange)}`) : (isEnglish ? `${hours(summary.measuredHours)} written down` : `已经记下 ${hours(summary.measuredHours)}`)}</p><i>${isEstimated(summary.timeRange, summary.measuredHours) ? (isEnglish ? `${hours(summary.measuredHours)} recorded` : `其中已记下 ${hours(summary.measuredHours)}`) : (isEnglish ? "From your ledger" : "来自你的账本")}</i></article>
          <article><small><span>${t("input")}</span><em class="evidence-status ${isEstimated(summary.inputRange, summary.loggedInput) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.inputRange, summary.loggedInput) ? t("estimate") : t("recorded")}</em></small><strong>${compact(summary.inputCenter)}</strong><p>${isEstimated(summary.inputRange, summary.loggedInput) ? (isEnglish ? `About ${compactRange(summary.inputRange)}` : `大约在 ${compactRange(summary.inputRange)}`) : (isEnglish ? `${compact(summary.loggedInput)} written down` : `已经记下 ${compact(summary.loggedInput)}`)}</p><i>${isEstimated(summary.inputRange, summary.loggedInput) ? (isEnglish ? `${compact(summary.loggedInput)} recorded` : `其中已记下 ${compact(summary.loggedInput)}`) : (isEnglish ? "From your ledger" : "来自你的账本")}</i></article>
          <article><small><span>${t("output")}</span><em class="evidence-status ${isEstimated(summary.outputRange, summary.loggedOutput) ? "evidence-estimate" : "evidence-confirmed"}">${isEstimated(summary.outputRange, summary.loggedOutput) ? t("estimate") : t("recorded")}</em></small><strong>${compact(summary.outputCenter)}</strong><p>${isEstimated(summary.outputRange, summary.loggedOutput) ? (isEnglish ? `About ${compactRange(summary.outputRange)}` : `大约在 ${compactRange(summary.outputRange)}`) : (isEnglish ? `${compact(summary.loggedOutput)} written down` : `已经记下 ${compact(summary.loggedOutput)}`)}</p><i>${isEstimated(summary.outputRange, summary.loggedOutput) ? (isEnglish ? `${compact(summary.loggedOutput)} recorded` : `其中已记下 ${compact(summary.loggedOutput)}`) : (isEnglish ? "From your ledger" : "来自你的账本")}</i></article>
        </div>
        <p class="coverage-note">${isEnglish ? `${percent(summary.coverage)} of recorded days include usage. The lower this share, the more the estimate should be treated as a guide, not a fact.` : `${percent(summary.coverage)} 的有记录日子里，能找到用量。这个比例越低，估算越该当作参考，不要把中间值当成准数。`}</p>
      </section>
      <section class="evidence-section active-day-section">
        <header><p class="eyebrow">${t("dayView")}</p><h2>${t("daysWithRecords")}</h2><span>${activeDates.length} ${t("recordedDays")} · ${isEnglish ? `${activityDates.length} days left traces` : `共 ${activityDates.length} 天留了痕迹`}</span></header>
        <div class="active-day-list">
          ${activityDates.length ? activityDates.map((item) => {
            const visibleAI = Number(item.measured_hours) || Number(item.input_chars) || Number(item.output_chars);
            return `<a href="evidence.html?date=${encodeURIComponent(item.date)}"><strong>${escapeHtml(item.date)}</strong><span>${item.commits ? (isEnglish ? `${item.commits} uses` : `${item.commits} 次使用`) : (isEnglish ? "No usage record" : "没有使用记录")}</span><span>${isEnglish ? `${item.semantic} daily notes` : `${item.semantic} 条当天备注`}</span><span>${isEnglish ? `${item.files} traces` : `${item.files} 条线索`}</span><em>${visibleAI ? (isEnglish ? "Usage recorded" : "有用量记录") : (isEnglish ? "No usage recorded" : "没有用量记录")}</em></a>`;
          }).join("") : `<p class="evidence-empty">${isEnglish ? "There are no date-linked records in this period." : "这段时间还没有能按日期找到的记录。"}</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">${t("evidence")}</p><h2>${isEnglish ? (selectedDays.length === 1 ? "Material kept that day" : "Material kept in this period") : (selectedDays.length === 1 ? "这一天留下的资料" : "这段时间留下的资料")}</h2><span>${records.length} ${isEnglish ? "items" : "份"}</span></header>
        <div class="evidence-links">
          ${records.length ? records.map((record) => `<a href="${escapeHtml(record.url)}"><span>${escapeHtml(record.name)}</span><small>${escapeHtml(record.path)}</small></a>`).join("") : `<p class="evidence-empty">${isEnglish ? "No material was found for this date." : "没有找到以这个日期命名的文档。"}</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">${t("useRecord")}</p><h2>${isEnglish ? "What happened in this period" : "这段时间做了什么"}</h2><span>${isEnglish ? `${commits.length} shown / ${summary.commits} total` : `显示 ${commits.length} 条 / 共 ${summary.commits} 条`}</span></header>
        <div class="commit-list">
          ${commits.length ? commits.map((commit) => `<div><code>${escapeHtml(commit.sha)}</code><span>${escapeHtml(commit.subject)}</span><small>${escapeHtml(commit.date)}</small></div>`).join("") : `<p class="evidence-empty">${isEnglish ? "There are no usage records in this period." : "这段时间没有使用记录。"}</p>`}
        </div>
      </section>
      <section class="evidence-section">
        <header><p class="eyebrow">${t("files")} · ${fileTouches} ${isEnglish ? "items" : "条"}</p><h2>${t("links")}</h2><span>${currentFiles.length} ${isEnglish ? "items" : "项"}</span></header>
        <div class="file-list">
          ${currentFiles.map((file) => `<a href="${escapeHtml(file.url)}"><span>${escapeHtml(file.path)}</span><small>${escapeHtml(file.date)}</small></a>`).join("") || `<p class="evidence-empty">${isEnglish ? "The public edition never reads device files automatically; add a link to your ledger evidence when you want one." : "公开版不会自动读取设备文件；需要时可在账本证据里自行留下链接。"}</p>`}
        </div>
      </section>
      <footer><span>${isEnglish ? "Direct records come from the ledger you choose to import; estimates keep their reason." : "直接记录来自你主动导入的账本；估算会保留理由"}</span><span>${t("localData")}</span></footer>
    </div>`;

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    root.querySelector(".theme-switch")?.setAttribute("aria-pressed", String(theme === "dark"));
    localStorage.setItem("ai-usage-strata-theme", theme);
  };
  setTheme(localStorage.getItem("ai-usage-strata-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  root.querySelector("[data-language-switch]")?.addEventListener("click", () => i18n?.setLanguage(isEnglish ? "zh" : "en"));
  root.querySelector(".theme-switch")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
})();
