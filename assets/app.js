(() => {
  const data = window.AI_USAGE_STRATA_REPORT;
  const root = document.getElementById("report-root");
  if (!data || !root || !Array.isArray(data.timeline)) return;
  const i18n = window.AI_USAGE_STRATA_I18N;
  const t = i18n?.t || ((key) => key);
  const category = i18n?.category || ((name) => name);
  const isEnglish = i18n?.language === "en";

  const categoryDefinitions = Array.isArray(data.category_definitions) ? data.category_definitions : [];
  const observedModules = data.timeline.flatMap((item) => Object.keys(item.modules || {}));
  const moduleOrder = [...new Set([
    ...categoryDefinitions.map((item) => item.name),
    ...observedModules,
    ...(data.modules || []).map((item) => item.name)
  ])].filter((name) => name !== "其他");
  if (observedModules.includes("其他") || (data.modules || []).some((item) => item.name === "其他")) moduleOrder.push("其他");
  const moduleTone = new Map(moduleOrder.map((name, index) => {
    const configured = categoryDefinitions.find((item) => item.name === name)?.tone;
    return [name, `tone-${configured || ((index % 6) + 1)}`];
  }));
  const pad = (value) => String(value).padStart(2, "0");
  const parseISO = (value) => new Date(`${value}T00:00:00`);
  const iso = (value) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const monthKey = (value) => typeof value === "string" ? value.slice(0, 7) : `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
  const monthStart = (key) => parseISO(`${key}-01`);
  const addDays = (value, amount) => {
    const next = new Date(value);
    next.setDate(next.getDate() + amount);
    return next;
  };
  const compact = (value) => {
    const number = Number(value) || 0;
    if (isEnglish && number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
    if (isEnglish && number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
    if (!isEnglish && number >= 100000000) return `${(number / 100000000).toFixed(1)} 亿`;
    if (!isEnglish && number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)} 万`;
    return Math.round(number).toLocaleString(isEnglish ? "en-US" : "zh-CN");
  };
  const hours = (value) => `${Number(value || 0).toFixed(1)}h`;
  const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[char]));
  const formatDay = (value) => `${value.getFullYear()}.${pad(value.getMonth() + 1)}.${pad(value.getDate())}`;
  const formatWeek = (start, end) => `${start.getMonth() + 1}/${start.getDate()}—${end.getMonth() + 1}/${end.getDate()}`;
  const sum = (items, field) => items.reduce((total, item) => total + (Number(item[field]) || 0), 0);
  const evidenceHref = ({ date, start, end } = {}) => {
    if (date) return `evidence.html?date=${encodeURIComponent(date)}`;
    return `evidence.html?from=${encodeURIComponent(iso(start))}&to=${encodeURIComponent(iso(end))}`;
  };

  const historyStart = parseISO(data.history?.start || data.range.start);
  const historyEnd = parseISO(data.history?.end || data.range.end);
  const calibration = data.calibration;
  let selectionStart = parseISO(data.view?.start || data.history?.start || data.range.start);
  let selectionEnd = parseISO(data.view?.end || data.history?.end || data.range.end);
  let activeMetric = "time";
  let selectedModuleNames = new Set(moduleOrder);
  let cleanupWaterfall = () => {};
  let redrawWaterfall = () => {};

  const estimateFor = (days) => window.AI_USAGE_STRATA_ESTIMATOR.estimateFor(days, calibration);

  const groupDays = (days, keyFor) => {
    const groups = new Map();
    days.forEach((item) => {
      const key = keyFor(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return groups;
  };

  const moduleTotals = (days) => {
    const totals = Object.fromEntries(moduleOrder.map((name) => [name, 0]));
    days.forEach((item) => {
      Object.entries(item.modules || {}).forEach(([name, value]) => {
        totals[name] = (totals[name] || 0) + (Number(value) || 0);
      });
    });
    return totals;
  };

  const metrics = {
    time: {
      label: t("time"), short: t("timeShort"), axisLabel: t("timeAxis"), peakLabel: isEnglish ? " was the busiest day" : "最忙",
      dailyPhrase: isEnglish ? "more time was spent with AI that day" : "那天和 AI 一起工作的时间越长",
      barPhrase: isEnglish ? "more time was spent with AI" : "和 AI 一起工作的时间越长",
      field: "hoursCenter",
      range: "timeRange",
      measured: "measuredHours",
      unit: "小时",
      format: hours,
      rangeFormat: (values) => `${hours(values[0])}—${hours(values[1])}`
    },
    input: {
      label: t("input"), short: t("inputShort"), axisLabel: t("inputAxis"), peakLabel: isEnglish ? " had the most input" : "输入最多",
      dailyPhrase: isEnglish ? "more text was sent to AI that day" : "那天你发给 AI 的文字越多",
      barPhrase: isEnglish ? "more text was sent to AI" : "你发给 AI 的文字越多",
      field: "inputCenter",
      range: "inputRange",
      measured: "loggedInput",
      unit: "字",
      format: compact,
      rangeFormat: (values) => `${compact(values[0])}—${compact(values[1])}`
    },
    output: {
      label: t("output"), short: t("outputShort"), axisLabel: t("outputAxis"), peakLabel: isEnglish ? " had the most output" : "的 AI 返回文字最多",
      dailyPhrase: isEnglish ? "more text was returned by AI that day" : "那天 AI 返回的文字越多",
      barPhrase: isEnglish ? "more text was returned by AI" : "AI 返回的文字越多",
      field: "outputCenter",
      range: "outputRange",
      measured: "loggedOutput",
      unit: "字",
      format: compact,
      rangeFormat: (values) => `${compact(values[0])}—${compact(values[1])}`
    }
  };

  const ridgePalette = [
    [69, 111, 158],
    [103, 157, 195],
    [188, 214, 230],
    [231, 235, 234],
    [246, 194, 171],
    [232, 112, 88],
    [188, 61, 70]
  ];
  const mixColor = (from, to, amount) => from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
  const ridgeTone = (index, count) => {
    const progress = count <= 1 ? 0.5 : index / (count - 1);
    const scaled = progress * (ridgePalette.length - 1);
    const start = Math.floor(scaled);
    const end = Math.min(ridgePalette.length - 1, start + 1);
    return mixColor(ridgePalette[start], ridgePalette[end], scaled - start);
  };
  const colorString = ([red, green, blue], alpha = 1) => `rgb(${red} ${green} ${blue} / ${alpha})`;

  root.innerHTML = `
    <div class="report-shell" data-metric="time">
      <header class="app-bar">
        <div class="app-identity">
          <span class="strata-sign" aria-hidden="true">
            <svg viewBox="0 0 82 52">
              <path class="sign-plane sign-plane-back" d="M2 42C13 38 17 28 27 29C37 30 40 39 50 34C61 29 65 15 80 11L80 48H2Z"/>
              <path class="sign-plane sign-plane-mid" d="M2 45C14 42 20 35 30 36C41 38 46 27 57 25C67 24 73 31 80 28L80 48H2Z"/>
              <path class="sign-line sign-line-front" d="M2 46C15 44 22 40 34 41C47 43 53 35 64 33C72 32 77 36 80 35"/>
              <circle class="sign-node" cx="64" cy="33" r="2.4"/>
            </svg>
          </span>
          <div class="app-wordmark"><span>LOCAL-FIRST AI TOOL</span><h1>AI Usage Strata</h1><p>${t("productSubtitle")}</p></div>
        </div>
        <div class="app-actions">
          <span class="generated-at">${escapeHtml(data.profile?.label || "Ledger")} · ${t("localOnly")}</span>
          <button class="ledger-action" type="button" data-ledger-action="import">${t("import")}</button>
          <button class="ledger-action ledger-action-quiet" type="button" data-ledger-action="export">${t("export")}</button>
          <button class="ledger-action ledger-action-quiet" type="button" data-ledger-action="reset">${t("demo")}</button>
          <button class="ledger-action ledger-action-quiet language-switch" type="button" data-language-switch>${t("language")}</button>
          <button class="theme-switch" type="button" aria-label="${t("switchTheme")}" aria-pressed="false"><span></span></button>
        </div>
      </header>

      <main>
        <section class="command-bar" aria-label="${t("range")}">
          <div class="range-selectors">
            <div class="range-labels"><span>${t("startDate")}</span><span>${t("endDate")}</span></div>
            <div class="range-fields">
              <div class="date-roller" aria-label="${t("startDate")}">
                <span><button type="button" data-date-step="start" data-date-part="year" data-date-delta="1" aria-label="${t("startDate")} year up">⌃</button><b id="start-year"></b><button type="button" data-date-step="start" data-date-part="year" data-date-delta="-1" aria-label="${t("startDate")} year down">⌄</button></span>
                <span><button type="button" data-date-step="start" data-date-part="month" data-date-delta="1" aria-label="${t("startDate")} month up">⌃</button><b id="start-month"></b><button type="button" data-date-step="start" data-date-part="month" data-date-delta="-1" aria-label="${t("startDate")} month down">⌄</button></span>
                <span><button type="button" data-date-step="start" data-date-part="day" data-date-delta="1" aria-label="${t("startDate")} day up">⌃</button><b id="start-day"></b><button type="button" data-date-step="start" data-date-part="day" data-date-delta="-1" aria-label="${t("startDate")} day down">⌄</button></span>
              </div>
              <i aria-hidden="true"></i>
              <div class="date-roller" aria-label="${t("endDate")}">
                <span><button type="button" data-date-step="end" data-date-part="year" data-date-delta="1" aria-label="${t("endDate")} year up">⌃</button><b id="end-year"></b><button type="button" data-date-step="end" data-date-part="year" data-date-delta="-1" aria-label="${t("endDate")} year down">⌄</button></span>
                <span><button type="button" data-date-step="end" data-date-part="month" data-date-delta="1" aria-label="${t("endDate")} month up">⌃</button><b id="end-month"></b><button type="button" data-date-step="end" data-date-part="month" data-date-delta="-1" aria-label="${t("endDate")} month down">⌄</button></span>
                <span><button type="button" data-date-step="end" data-date-part="day" data-date-delta="1" aria-label="${t("endDate")} day up">⌃</button><b id="end-day"></b><button type="button" data-date-step="end" data-date-part="day" data-date-delta="-1" aria-label="${t("endDate")} day down">⌄</button></span>
              </div>
            </div>
          </div>
          <div class="range-presets" aria-label="${t("quickRange")}">
            <button type="button" data-preset="all">${t("all")}</button>
            <button type="button" data-preset="current">${t("currentMonth")}</button>
            <button type="button" data-preset="four-weeks">${t("fourWeeks")}</button>
          </div>
          <p class="selection-reading" id="selection-reading"></p>
        </section>

        <section class="overview-section" aria-labelledby="metric-title">
          <header class="overview-header">
            <div class="metric-reading" aria-live="polite">
              <p class="eyebrow">${t("period")}</p>
              <div class="metric-heading"><h2 id="metric-title"></h2><span id="metric-status" class="evidence-status"></span></div>
              <strong id="metric-total"></strong>
              <p id="metric-scope"></p>
            </div>
            <div class="metric-switch" role="group" aria-label="${t("time")}">
              <button type="button" data-metric="time" aria-pressed="true"><span>${t("timeShort")}</span><b id="switch-time"></b></button>
              <button type="button" data-metric="input" aria-pressed="false"><span>${t("inputShort")}</span><b id="switch-input"></b></button>
              <button type="button" data-metric="output" aria-pressed="false"><span>${t("outputShort")}</span><b id="switch-output"></b></button>
            </div>
          </header>
          <div class="metric-context" aria-label="${t("calculation")}">
            <span><small>${t("estimateRange")}</small><b id="metric-range"></b></span>
            <span><small>${t("recordedValue")}</small><b id="metric-measured"></b></span>
            <span><small>${t("coverage")}</small><b id="metric-coverage"></b></span>
          </div>
        </section>

        <section class="hero-analysis" aria-labelledby="chart-title">
          <header class="chart-intro">
            <div class="chart-copy">
              <p class="eyebrow">${t("busiest")}</p>
              <h2><a id="chart-title" href="#"></a></h2>
              <p id="chart-subtitle"></p>
            </div>
            <div class="chart-key">
              <span class="ridge-legend"><i aria-hidden="true"></i><span>${t("earlier")}</span><em>→</em><span>${t("later")}</span></span>
              <a id="chart-peak" href="#"></a>
            </div>
          </header>
          <div class="primary-chart" id="primary-chart"></div>
        </section>

        <section class="weekly-section" aria-labelledby="weekly-title">
          <header class="section-header">
            <div>
              <p class="eyebrow">${t("workDirection")}</p>
              <h2 id="weekly-title"></h2>
              <p id="weekly-subtitle"></p>
            </div>
          </header>
          <div class="module-legend" id="module-legend" aria-label="${isEnglish ? "Work categories" : "工作分类"}"></div>
          <div class="week-table-head" aria-hidden="true"><span id="period-label"></span><span id="week-metric-label"></span><span>${t("allocation")}</span></div>
          <div class="weekly-list" id="weekly-list"></div>
        </section>

        <details class="evidence-panel">
          <summary><span>${t("calculation")}</span><small id="evidence-summary"></small></summary>
          <div class="evidence-list" id="evidence-grid"></div>
          <div class="method-copy">
            <p>${t("estimateHint", { basis: escapeHtml(data.baseline.range) })}</p>
            <p>${t("privacyHint")}</p>
          </div>
        </details>
      </main>

      <footer><span>${t("ledgerRange")} ${escapeHtml(data.history.start)} — ${escapeHtml(data.history.end)}</span><span>${t("privacyFooter")}</span></footer>
    </div>`;

  const shell = root.querySelector(".report-shell");
  const fileInput = document.getElementById("ledger-file");
  root.querySelectorAll("[data-ledger-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.ledgerAction === "import") fileInput?.click();
      if (button.dataset.ledgerAction === "export") window.AI_USAGE_STRATA_LEDGER?.exportFile();
      if (button.dataset.ledgerAction === "reset") window.AI_USAGE_STRATA_LEDGER?.reset();
    });
  });
  root.querySelector("[data-language-switch]")?.addEventListener("click", () => i18n?.setLanguage(isEnglish ? "zh" : "en"));
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) window.AI_USAGE_STRATA_LEDGER?.importFile(file);
    fileInput.value = "";
  });
  const maxMonth = monthKey(historyEnd);

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    root.querySelector(".theme-switch")?.setAttribute("aria-pressed", String(theme === "dark"));
    localStorage.setItem("ai-usage-strata-theme", theme);
    requestAnimationFrame(() => redrawWaterfall());
  };
  setTheme(localStorage.getItem("ai-usage-strata-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  root.querySelector(".theme-switch")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  const syncInputs = () => {
    root.querySelector("#start-year").textContent = selectionStart.getFullYear();
    root.querySelector("#start-month").textContent = isEnglish ? `${pad(selectionStart.getMonth() + 1)}` : `${pad(selectionStart.getMonth() + 1)} 月`;
    root.querySelector("#start-day").textContent = isEnglish ? pad(selectionStart.getDate()) : `${pad(selectionStart.getDate())} 日`;
    root.querySelector("#end-year").textContent = selectionEnd.getFullYear();
    root.querySelector("#end-month").textContent = isEnglish ? `${pad(selectionEnd.getMonth() + 1)}` : `${pad(selectionEnd.getMonth() + 1)} 月`;
    root.querySelector("#end-day").textContent = isEnglish ? pad(selectionEnd.getDate()) : `${pad(selectionEnd.getDate())} 日`;
  };

  const setSelection = (start, end) => {
    selectionStart = start < historyStart ? new Date(historyStart) : (start > historyEnd ? new Date(historyEnd) : start);
    selectionEnd = end < historyStart ? new Date(historyStart) : (end > historyEnd ? new Date(historyEnd) : end);
    if (selectionStart > selectionEnd) selectionEnd = new Date(selectionStart);
    syncInputs();
    render();
  };

  const stepDate = (target, part, delta) => {
    const next = new Date(target === "start" ? selectionStart : selectionEnd);
    if (part === "year" || part === "month") {
      const day = next.getDate();
      next.setDate(1);
      if (part === "year") next.setFullYear(next.getFullYear() + delta);
      if (part === "month") next.setMonth(next.getMonth() + delta);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
    }
    if (part === "day") next.setDate(next.getDate() + delta);
    setSelection(target === "start" ? next : selectionStart, target === "end" ? next : selectionEnd);
  };
  root.querySelectorAll("[data-date-step]").forEach((button) => {
    button.addEventListener("click", () => stepDate(button.dataset.dateStep, button.dataset.datePart, Number(button.dataset.dateDelta)));
  });
  root.querySelectorAll(".date-roller span").forEach((roller) => {
    roller.addEventListener("wheel", (event) => {
      event.preventDefault();
      const button = roller.querySelector("[data-date-step]");
      stepDate(button.dataset.dateStep, button.dataset.datePart, event.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  });

  const weeklyGroups = (days) => [...groupDays(days, (item) => {
    const day = parseISO(item.date);
    return iso(addDays(day, -((day.getDay() + 6) % 7)));
  }).entries()].map(([key, weekDays]) => ({
    key,
    label: formatWeek(parseISO(weekDays[0].date), parseISO(weekDays[weekDays.length - 1].date)),
    start: parseISO(weekDays[0].date),
    end: parseISO(weekDays[weekDays.length - 1].date),
    days: weekDays,
    summary: estimateFor(weekDays),
    modules: moduleTotals(weekDays)
  }));

  const monthlyGroups = (days) => [...groupDays(days, (item) => item.date.slice(0, 7)).entries()].map(([key, monthDays]) => ({
    key,
    label: `${Number(key.slice(0, 4))}.${Number(key.slice(5, 7))}`,
    start: parseISO(monthDays[0].date),
    end: parseISO(monthDays[monthDays.length - 1].date),
    days: monthDays,
    summary: estimateFor(monthDays),
    modules: moduleTotals(monthDays)
  }));

  const chartGroups = (days) => {
    if (days.length <= 62) return { granularity: "按周", slots: 7, items: weeklyGroups(days) };
    return {
      granularity: "按月",
      slots: 31,
      items: monthlyGroups(days).map((item) => ({ ...item, label: `${Number(item.key.slice(5, 7))}月` }))
    };
  };

  const ridgeSeries = (item, granularity, slots, metric) => {
    const values = Array.from({ length: slots }, () => ({ date: null, value: 0, hasEvidence: false }));
    item.days.forEach((day) => {
      const date = parseISO(day.date);
      const index = granularity === "按月" ? date.getDate() - 1 : (date.getDay() + 6) % 7;
      values[index] = {
        date: day.date,
        value: Number(estimateFor([day])[metric.field]) || 0,
        hasEvidence: Boolean(
          Number(day.commits)
          || Number(day.measured_hours)
          || Number(day.input_chars)
          || Number(day.output_chars)
          || day.evidence?.records?.length
          || day.evidence?.commits?.length
          || day.evidence?.files?.length
        )
      };
    });
    return values;
  };

  const pointInPolygon = (point, polygon) => {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
      const currentPoint = polygon[index];
      const previousPoint = polygon[previous];
      const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
        && (point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / ((previousPoint.y - currentPoint.y) || 0.0001) + currentPoint.x);
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const softenProfile = (values, granularity) => {
    const weights = granularity === "按月" ? [0.06, 0.23, 0.42, 0.23, 0.06] : [0.13, 0.74, 0.13];
    const radius = Math.floor(weights.length / 2);
    const softened = values.map((point, index) => weights.reduce((total, weight, offset) => {
      const source = values[index + offset - radius];
      return total + (source?.y || 0) * weight;
    }, 0));
    const originalMaximum = Math.max(0, ...values.map((point) => point.y));
    const softenedMaximum = Math.max(0, ...softened);
    const scale = softenedMaximum ? originalMaximum / softenedMaximum : 1;
    return values.map((point, index) => ({ ...point, displayY: Math.max(0, softened[index] * scale) }));
  };

  const smoothProfile = (values, samplesPerSegment) => {
    if (values.length < 2) return values.map((point) => ({ x: point.x, y: point.displayY }));
    const deltas = values.slice(0, -1).map((point, index) => {
      const next = values[index + 1];
      return (next.displayY - point.displayY) / Math.max(0.0001, next.x - point.x);
    });
    const tangents = values.map((point, index) => {
      if (index === 0) return deltas[0];
      if (index === values.length - 1) return deltas[deltas.length - 1];
      return deltas[index - 1] * deltas[index] <= 0 ? 0 : (deltas[index - 1] + deltas[index]) / 2;
    });
    deltas.forEach((delta, index) => {
      if (!delta) {
        tangents[index] = 0;
        tangents[index + 1] = 0;
        return;
      }
      const left = tangents[index] / delta;
      const right = tangents[index + 1] / delta;
      const length = Math.hypot(left, right);
      if (length > 3) {
        const scale = 3 / length;
        tangents[index] = scale * left * delta;
        tangents[index + 1] = scale * right * delta;
      }
    });
    const curve = [];
    values.slice(0, -1).forEach((point, index) => {
      const next = values[index + 1];
      const span = next.x - point.x;
      for (let step = 0; step < samplesPerSegment; step += 1) {
        const amount = step / samplesPerSegment;
        const square = amount * amount;
        const cube = square * amount;
        const y = (2 * cube - 3 * square + 1) * point.displayY
          + (cube - 2 * square + amount) * span * tangents[index]
          + (-2 * cube + 3 * square) * next.displayY
          + (cube - square) * span * tangents[index + 1];
        curve.push({ x: point.x + span * amount, y: Math.max(0, y) });
      }
    });
    const last = values[values.length - 1];
    curve.push({ x: last.x, y: last.displayY });
    return curve;
  };

  const mountWaterfallModel = ({ ridges, granularity, slots, metric, maximum }) => {
    const canvas = root.querySelector("#waterfall-canvas");
    const resetButton = root.querySelector("#model-reset");
    const viewButtons = [...root.querySelectorAll("[data-view]")];
    if (!canvas || !resetButton) return;
    const context = canvas.getContext("2d");
    const viewPresets = {
      front: { yaw: 0, pitch: 0, zoom: 1.05, orthographic: true, layerOrder: "recent" },
      side: { yaw: -0.62, pitch: 0.5, zoom: 1.18, orthographic: false, layerOrder: "depth" },
      back: { yaw: 0, pitch: 0, zoom: 1.05, orthographic: true, layerOrder: "early" },
      top: { yaw: -0.5, pitch: 1.04, zoom: 1.0, orthographic: false, layerOrder: "depth" }
    };
    const defaults = { ...viewPresets.side };
    const camera = { ...defaults };
    const model = ridges.map((ridge, index) => {
      const tone = ridgeTone(index, ridges.length);
      const values = softenProfile(ridge.series.map((point, pointIndex) => ({
        ...point,
        x: -1.72 + (pointIndex / Math.max(1, slots - 1)) * 3.44,
        y: (point.value / maximum) * 1.42
      })), granularity);
      return {
        ...ridge,
        tone,
        color: colorString(tone),
        z: ridges.length <= 1 ? 0 : 1.2 - (index / (ridges.length - 1)) * 2.4,
        values,
        curve: smoothProfile(values, granularity === "按月" ? 7 : 15)
      };
    });
    const tickIndexes = granularity === "按月" ? [0, 7, 14, 21, 30] : [0, 1, 2, 3, 4, 5, 6];
    const tickLabels = granularity === "按月" ? ["1", "8", "15", "22", "31"] : (isEnglish ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["一", "二", "三", "四", "五", "六", "日"]);
    let hitPoints = [];
    let hoveredKey = "";
    let dragging = false;
    let moved = false;
    let suppressClick = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let frame = 0;

    const project = (point, width, height) => {
      const cosYaw = Math.cos(camera.yaw);
      const sinYaw = Math.sin(camera.yaw);
      const cosPitch = Math.cos(camera.pitch);
      const sinPitch = Math.sin(camera.pitch);
      const rotatedX = point.x * cosYaw - point.z * sinYaw;
      const yawDepth = point.x * sinYaw + point.z * cosYaw;
      const rotatedY = point.y * cosPitch - yawDepth * sinPitch;
      const depth = point.y * sinPitch + yawDepth * cosPitch;
      const scale = camera.orthographic
        ? camera.zoom * Math.min(width, height) * 0.31
        : camera.zoom * Math.min(width, height) * 1.3 / Math.max(2.4, 4.7 - depth);
      return {
        x: width * 0.47 + rotatedX * scale,
        y: height * 0.68 - rotatedY * scale,
        depth
      };
    };

    const trace = (points, close = false) => {
      if (!points.length) return;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      if (close) context.closePath();
    };

    const draw = () => {
      const rectangle = canvas.getBoundingClientRect();
      const width = Math.max(320, rectangle.width);
      const height = Math.max(360, rectangle.height);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const styles = getComputedStyle(shell);
      const ink = styles.getPropertyValue("--ink").trim();
      const muted = styles.getPropertyValue("--ink-3").trim();
      const line = styles.getPropertyValue("--line-soft").trim();
      const paper = styles.getPropertyValue("--paper-strong").trim();
      const frontZ = model[0]?.z || 0;
      const backZ = model[model.length - 1]?.z || 0;

      context.lineWidth = 1;
      context.strokeStyle = line;
      model.forEach((ridge) => {
        const baseline = [project({ x: -1.72, y: 0, z: ridge.z }, width, height), project({ x: 1.72, y: 0, z: ridge.z }, width, height)];
        trace(baseline);
        context.stroke();
      });
      tickIndexes.forEach((tickIndex) => {
        const x = -1.72 + (tickIndex / Math.max(1, slots - 1)) * 3.44;
        const depthLine = [project({ x, y: 0, z: frontZ }, width, height), project({ x, y: 0, z: backZ }, width, height)];
        trace(depthLine);
        context.stroke();
      });
      const faces = model.map((ridge, index) => {
        const top = ridge.curve.map((point) => project({ x: point.x, y: point.y, z: ridge.z }, width, height));
        const bottom = ridge.curve.map((point) => project({ x: point.x, y: 0, z: ridge.z }, width, height));
        const polygon = [...top, ...bottom.slice().reverse()];
        const averageDepth = top.reduce((total, point) => total + point.depth, 0) / Math.max(1, top.length);
        const projectedValues = ridge.values.map((point) => project({ x: point.x, y: point.displayY, z: ridge.z }, width, height));
        const dayPoints = ridge.values.map((point, pointIndex) => {
          if (!point.date || !point.hasEvidence) return null;
          const current = projectedValues[pointIndex];
          const previous = projectedValues[Math.max(0, pointIndex - 1)];
          const next = projectedValues[Math.min(projectedValues.length - 1, pointIndex + 1)];
          const deltaX = next.x - previous.x;
          const deltaY = next.y - previous.y;
          const length = Math.max(0.001, Math.hypot(deltaX, deltaY));
          const base = project({ x: point.x, y: 0, z: ridge.z }, width, height);
          let normalX = -deltaY / length;
          let normalY = deltaX / length;
          if (normalX * (base.x - current.x) + normalY * (base.y - current.y) < 0) {
            normalX *= -1;
            normalY *= -1;
          }
          return {
            key: `${ridge.key}|${point.date}`,
            date: point.date,
            value: point.value,
            label: ridge.label,
            tone: ridge.tone,
            ...current,
            normalX,
            normalY,
            base
          };
        }).filter(Boolean);
        return { ridge, index, top, bottom, polygon, averageDepth, dayPoints };
      }).sort((left, right) => {
        if (camera.layerOrder === "recent") return left.index - right.index;
        if (camera.layerOrder === "early") return right.index - left.index;
        return left.averageDepth - right.averageDepth;
      });

      hitPoints = [];
      faces.forEach((face) => {
        trace(face.polygon, true);
        const topY = Math.min(...face.top.map((point) => point.y));
        const baselineY = Math.max(...face.bottom.map((point) => point.y));
        const highlight = mixColor(face.ridge.tone, [255, 255, 255], 0.28);
        const fill = context.createLinearGradient(0, topY, 0, Math.max(topY + 1, baselineY));
        fill.addColorStop(0, colorString(face.ridge.tone, 0.88));
        fill.addColorStop(0.48, colorString(face.ridge.tone, 0.72));
        fill.addColorStop(1, colorString(highlight, 0.36));
        context.fillStyle = fill;
        context.globalAlpha = 1;
        context.fill();
        context.globalAlpha = 0.94;
        context.strokeStyle = colorString(face.ridge.tone, 0.9);
        context.lineWidth = 1.15;
        context.lineJoin = "round";
        context.lineCap = "round";
        trace(face.top);
        context.stroke();
        context.globalAlpha = 1;
        hitPoints.push(...face.dayPoints);
      });

      model.forEach((ridge, index) => {
        const listedLabel = camera.orthographic || width < 520;
        const projectedLabel = listedLabel
          ? { x: width - (width < 520 ? 72 : 124), y: 78 + index * (width < 520 ? 34 : 24) }
          : project({ x: 1.88, y: 0.03, z: ridge.z }, width, height);
        const labelPoint = listedLabel
          ? projectedLabel
          : { ...projectedLabel, x: Math.min(width - 116, projectedLabel.x) };
        context.strokeStyle = ridge.color;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(labelPoint.x - (listedLabel ? 18 : 0), labelPoint.y - 4);
        context.lineTo(labelPoint.x - (listedLabel ? 7 : 0), labelPoint.y - 4);
        if (listedLabel) context.stroke();
        context.fillStyle = ink;
        context.font = `500 ${Math.max(10, Math.min(12, width / 82))}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        context.textAlign = "left";
        context.fillText(ridge.label, labelPoint.x, labelPoint.y - (listedLabel ? 0 : 5));
        if (!camera.orthographic || width < 520) {
          context.fillStyle = muted;
          context.font = `400 ${Math.max(9, Math.min(10, width / 96))}px "SFMono-Regular", Menlo, monospace`;
          context.fillText(metric.format(ridge.summary[metric.field]), labelPoint.x, labelPoint.y + 9);
        }
      });

      const frontRidge = model[0];
      if (frontRidge) {
        context.fillStyle = muted;
        context.font = `400 ${Math.max(9, Math.min(10, width / 96))}px "SFMono-Regular", Menlo, monospace`;
        context.textAlign = "center";
        tickIndexes.forEach((tickIndex, index) => {
          const x = -1.72 + (tickIndex / Math.max(1, slots - 1)) * 3.44;
          const point = project({ x, y: 0, z: frontRidge.z }, width, height);
          context.fillText(tickLabels[index], point.x, point.y + 20);
        });
      }

      hitPoints.forEach((point) => {
        const hovered = point.key === hoveredKey;
        if (hovered && Math.abs(point.base.y - point.y) > 3) {
          context.beginPath();
          context.moveTo(point.base.x, point.base.y);
          context.lineTo(point.x, point.y);
          context.strokeStyle = colorString(point.tone, 0.22);
          context.lineWidth = 0.8;
          context.stroke();
        }
        const outward = hovered ? 2.2 : 0.45;
        const inward = hovered ? 9 : (point.value ? 4.8 : 3.2);
        const startX = point.x - point.normalX * outward;
        const startY = point.y - point.normalY * outward;
        const endX = point.x + point.normalX * inward;
        const endY = point.y + point.normalY * inward;
        const incisionTone = mixColor(point.tone, [28, 33, 39], 0.24);
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.strokeStyle = hovered ? colorString(point.tone, 0.98) : colorString(incisionTone, point.value ? 0.72 : 0.42);
        context.lineWidth = hovered ? 3.6 : 2;
        context.lineCap = "round";
        context.stroke();
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.strokeStyle = paper;
        context.globalAlpha = hovered ? 0.92 : (point.value ? 0.62 : 0.34);
        context.lineWidth = hovered ? 1.15 : 0.7;
        context.stroke();
        context.globalAlpha = 1;
      });

      const rulerX = 18;
      const rulerTop = height * 0.24;
      const rulerBottom = height * 0.69;
      context.strokeStyle = colorString(ridgePalette[1], 0.42);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(rulerX, rulerTop);
      context.lineTo(rulerX, rulerBottom);
      context.stroke();
      context.font = `500 ${Math.max(9, Math.min(10, width / 96))}px "SFMono-Regular", Menlo, monospace`;
      context.textAlign = "left";
      [0, 0.5, 1].forEach((amount) => {
        const y = rulerBottom - (rulerBottom - rulerTop) * amount;
        context.beginPath();
        context.moveTo(rulerX, y);
        context.lineTo(rulerX + 5, y);
        context.stroke();
        context.fillStyle = muted;
        context.fillText(amount === 0 ? "0" : metric.format(maximum * amount), rulerX + 9, y + 3);
      });
      context.fillStyle = ink;
      context.font = `600 ${Math.max(9, Math.min(10, width / 96))}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
      context.fillText(metric.axisLabel, rulerX, rulerTop - 13);

      const hoveredPoint = hitPoints.find((point) => point.key === hoveredKey);
      if (hoveredPoint) {
        const date = parseISO(hoveredPoint.date);
        const label = `${date.getMonth() + 1}月${date.getDate()}日 · ${metric.format(hoveredPoint.value)} · 点击看当天记录`;
        context.font = `500 ${Math.max(10, Math.min(11, width / 92))}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        const tooltipWidth = context.measureText(label).width + 22;
        const tooltipX = Math.max(8, Math.min(width - tooltipWidth - 8, hoveredPoint.x + 12));
        const tooltipY = Math.max(12, hoveredPoint.y - 38);
        context.fillStyle = paper;
        context.strokeStyle = colorString(hoveredPoint.tone, 0.55);
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(tooltipX, tooltipY, tooltipWidth, 28, 8);
        context.fill();
        context.stroke();
        context.fillStyle = ink;
        context.textAlign = "left";
        context.fillText(label, tooltipX + 11, tooltipY + 18);
      }
    };

    const scheduleDraw = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    };
    redrawWaterfall = scheduleDraw;

    const pointerPosition = (event) => {
      const rectangle = canvas.getBoundingClientRect();
      return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top };
    };
    const onPointerDown = (event) => {
      suppressClick = false;
      dragging = true;
      moved = false;
      startX = lastX = event.clientX;
      startY = lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
    };
    const onPointerMove = (event) => {
      if (!dragging) {
        const pointer = pointerPosition(event);
        const hit = hitPoints.slice().reverse().map((point) => ({
          ...point,
          distance: Math.hypot(pointer.x - point.x, pointer.y - point.y)
        })).sort((left, right) => left.distance - right.distance)[0];
        const nextKey = hit && hit.distance <= 12 ? hit.key : "";
        canvas.classList.toggle("has-point", Boolean(nextKey));
        if (nextKey !== hoveredKey) {
          hoveredKey = nextKey;
          scheduleDraw();
        }
        return;
      }
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 5) moved = true;
      if (moved && camera.orthographic) {
        camera.orthographic = false;
        camera.pitch = 0.18;
        camera.layerOrder = "depth";
        viewButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
      }
      camera.yaw += deltaX * 0.008;
      camera.pitch = Math.max(-0.05, Math.min(1.15, camera.pitch + deltaY * 0.006));
      lastX = event.clientX;
      lastY = event.clientY;
      scheduleDraw();
    };
    const onPointerUp = (event) => {
      if (!dragging) return;
      dragging = false;
      suppressClick = moved;
      canvas.classList.remove("is-dragging");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onClick = (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const pointer = pointerPosition(event);
      const point = hitPoints.slice().reverse().map((item) => ({
        ...item,
        distance: Math.hypot(pointer.x - item.x, pointer.y - item.y)
      })).sort((left, right) => left.distance - right.distance)[0];
      if (point?.date && point.distance <= 12) window.location.assign(evidenceHref({ date: point.date }));
    };
    const onPointerLeave = () => {
      if (dragging || !hoveredKey) return;
      hoveredKey = "";
      canvas.classList.remove("has-point");
      scheduleDraw();
    };
    const onWheel = (event) => {
      event.preventDefault();
      camera.zoom = Math.max(0.68, Math.min(2.2, camera.zoom * Math.exp(-event.deltaY * 0.001)));
      scheduleDraw();
    };
    const setView = (name) => {
      Object.assign(camera, viewPresets[name] || defaults);
      viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === name)));
      scheduleDraw();
    };
    const resetView = () => setView("side");
    const viewHandlers = viewButtons.map((button) => {
      const handler = () => setView(button.dataset.view);
      button.addEventListener("click", handler);
      return [button, handler];
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", resetView);
    resetButton.addEventListener("click", resetView);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleDraw);
    observer?.observe(canvas);
    window.addEventListener("resize", scheduleDraw);
    scheduleDraw();

    cleanupWaterfall = () => {
      observer?.disconnect();
      viewHandlers.forEach(([button, handler]) => button.removeEventListener("click", handler));
      window.removeEventListener("resize", scheduleDraw);
      if (frame) cancelAnimationFrame(frame);
      redrawWaterfall = () => {};
    };
    setView("side");
  };

  const renderPrimaryChart = (days) => {
    cleanupWaterfall();
    const metric = metrics[activeMetric];
    const { granularity, slots, items } = chartGroups(days);
    const ridges = items.map((item) => ({ ...item, series: ridgeSeries(item, granularity, slots, metric) }));
    const visiblePoints = ridges.flatMap((ridge) => ridge.series.filter((point) => point.date));
    const maximum = Math.max(1, ...visiblePoints.map((point) => point.value));
    const peakPoint = visiblePoints.reduce((peak, point) => point.value > (peak?.value || 0) ? point : peak, null);
    const chartTitle = root.querySelector("#chart-title");
    const chartPeak = root.querySelector("#chart-peak");
    chartTitle.textContent = peakPoint?.value
      ? (isEnglish ? `${peakPoint.date} ${metric.peakLabel}` : `${Number(peakPoint.date.slice(5, 7))} 月 ${Number(peakPoint.date.slice(8, 10))} 日${metric.peakLabel}`)
      : t("noRecords");
    chartTitle.href = peakPoint?.date ? evidenceHref({ date: peakPoint.date }) : "#";
    root.querySelector("#chart-subtitle").textContent = granularity === "按月"
      ? (isEnglish ? `Each ridge is a month. Read dates across; higher ridges mean ${metric.dailyPhrase}.` : `每层是一个月，横向看日期；山峰越高，${metric.dailyPhrase}。`)
      : (isEnglish ? `Each ridge is a week, from Monday to Sunday; higher ridges mean ${metric.dailyPhrase}.` : `每层是一周，横向从周一排到周日；山峰越高，${metric.dailyPhrase}。`);
    chartPeak.textContent = peakPoint?.value
      ? `${t("dayPeak")} ${metric.format(peakPoint.value)}`
      : t("noRecords");
    chartPeak.href = peakPoint?.date ? evidenceHref({ date: peakPoint.date }) : "#";
    if (!ridges.length) {
      root.querySelector("#primary-chart").innerHTML = `<p class="empty-state">${t("noRecords")}</p>`;
      return;
    }
    root.querySelector("#primary-chart").innerHTML = `
      <div class="waterfall-model">
        <div class="view-presets" role="group" aria-label="${t("busiest")}">
          <button type="button" data-view="front" aria-pressed="false">${t("viewFront")}</button>
          <button type="button" data-view="side" aria-pressed="true">${t("viewSide")}</button>
          <button type="button" data-view="back" aria-pressed="false">${t("viewBack")}</button>
          <button type="button" data-view="top" aria-pressed="false">${t("viewTop")}</button>
        </div>
        <canvas id="waterfall-canvas" role="img" aria-label="${escapeHtml(metric.label)}瀑布图。可以切换视角，也可以拖动旋转、滚轮缩放；点击山脊上的日期刻痕可查看当天记录。"></canvas>
        <div class="model-hud"><span>${t("canvasHint")}</span><button id="model-reset" type="button">${t("resetView")}</button></div>
      </div>`;
    mountWaterfallModel({ ridges, granularity, slots, metric, maximum });
  };

  const renderWeekly = (days) => {
    const metric = metrics[activeMetric];
    const useMonths = days.length > 62;
    const periods = (useMonths ? monthlyGroups(days) : weeklyGroups(days)).reverse();
    const rangeModules = moduleTotals(days);
    const availableModules = moduleOrder.filter((name) => rangeModules[name] > 0);
    let activeModules = availableModules.filter((name) => selectedModuleNames.has(name));
    if (!activeModules.length && availableModules.length) {
      selectedModuleNames = new Set(availableModules);
      activeModules = availableModules;
    }
    const totalRangeTouches = Object.values(rangeModules).reduce((total, value) => total + value, 0);
    const selectedRangeTouches = activeModules.reduce((total, name) => total + (rangeModules[name] || 0), 0);
    const selectedRatio = totalRangeTouches ? selectedRangeTouches / totalRangeTouches : 0;
    const selectedTotal = metric.format(estimateFor(days)[metric.field] * selectedRatio);
    const periodValues = periods.map((period) => {
      const totalTouches = Object.values(period.modules).reduce((total, value) => total + value, 0);
      const activeTouches = activeModules.reduce((total, name) => total + (period.modules[name] || 0), 0);
      return totalTouches ? period.summary[metric.field] * activeTouches / totalTouches : 0;
    });
    const maximum = Math.max(1, ...periodValues);
    root.querySelector("#weekly-title").textContent = useMonths ? t("monthView") : t("weekView");
    root.querySelector("#weekly-subtitle").textContent = t("categoryHint");
    root.querySelector("#period-label").textContent = useMonths ? t("monthLabel") : t("weekLabel");
    root.querySelector("#module-legend").innerHTML = availableModules.length ? `
      <div class="module-toolbar"><p>${t("categoryChoose")}</p><button type="button" data-module-action="all">${t("selectAll")}</button></div>
      <div class="module-filters">${availableModules.map((name) => {
        const share = totalRangeTouches ? rangeModules[name] / totalRangeTouches : 0;
        const allocation = metric.format(estimateFor(days)[metric.field] * share);
        const checked = selectedModuleNames.has(name);
        return `<button type="button" class="module-filter ${moduleTone.get(name)}" data-module="${escapeHtml(name)}" aria-pressed="${checked}"><i></i><span>${escapeHtml(category(name))}</span><b>${t("approx")} ${escapeHtml(allocation)}</b></button>`;
      }).join("")}</div>
      <p class="module-reading">${t("selectedCategories", { count: activeModules.length, value: selectedTotal, share: percent(selectedRatio) })}</p>
    ` : "";
    root.querySelector("#week-metric-label").textContent = t("selectedMetric", { metric: metric.short });
    root.querySelector("#weekly-list").innerHTML = periods.length ? periods.map((period, index) => {
      const totalTouches = Object.values(period.modules).reduce((total, value) => total + value, 0);
      const activeTouches = activeModules.reduce((total, name) => total + (period.modules[name] || 0), 0);
      const segments = activeModules.filter((name) => period.modules[name] > 0).map((name) => {
        const share = activeTouches ? period.modules[name] / activeTouches : 0;
        return `<span class="week-segment ${moduleTone.get(name)}" style="--share:${share * 100}" aria-label="${escapeHtml(category(name))} ${percent(share)}"></span>`;
      }).join("");
      const leading = activeModules.map((name) => [name, period.modules[name] || 0]).sort((a, b) => b[1] - a[1])[0];
      const leadingLabel = leading && leading[1] > 0 ? category(leading[0]) : (isEnglish ? "Uncategorised" : "没有分类");
      const value = periodValues[index];
      const magnitude = value / maximum;
      return `<article class="week-row">
        <a class="week-label" href="${evidenceHref({ start: period.start, end: period.end })}"><strong>${escapeHtml(useMonths ? period.label : formatWeek(period.start, period.end))}</strong><small>${period.summary.activeDays} ${t("recordedDays")} · ${period.summary.commits} ${t("uses")} · ${t("viewRecords")}</small></a>
        <b class="week-metric">${t("approx")} ${escapeHtml(metric.format(value))}</b>
        <div class="week-allocation">
          <div class="week-scale"><div class="week-track" style="--magnitude:${Math.max(magnitude ? 4 : 0, magnitude * 100)}%" role="img" aria-label="${escapeHtml(period.label)} ${t("selectedMetric", { metric: metric.short })} ${escapeHtml(metric.format(value))}; ${escapeHtml(leadingLabel)}">${segments || "<span class=\"week-empty\"></span>"}</div></div>
          <small>${escapeHtml(leadingLabel)}</small>
        </div>
      </article>`;
    }).join("") : `<p class="empty-state">${t("noRecords")}</p>`;
    root.querySelector("[data-module-action=all]")?.addEventListener("click", () => {
      selectedModuleNames = new Set(availableModules);
      renderWeekly(days);
    });
    root.querySelectorAll("[data-module]").forEach((button) => {
      button.addEventListener("click", () => {
        const name = button.dataset.module;
        if (selectedModuleNames.has(name) && activeModules.length === 1) return;
        if (selectedModuleNames.has(name)) selectedModuleNames.delete(name);
        else selectedModuleNames.add(name);
        renderWeekly(days);
      });
    });
  };

  const renderEvidence = (summary) => {
    const rows = [
      { label: t("evidenceRecorded"), state: t("recorded"), tone: "measured", detail: isEnglish ? `${summary.commits} uses across ${summary.activeDays} recorded days.` : `${summary.commits} 次使用，分布在 ${summary.activeDays} 个有记录的日子。` },
      { label: t("evidenceUsage"), state: t("recorded"), tone: "measured", detail: isEnglish ? `${hours(summary.measuredHours)} written down; input ${compact(summary.loggedInput)}, output ${compact(summary.loggedOutput)}.` : `记下 ${hours(summary.measuredHours)}；你输入 ${compact(summary.loggedInput)}，AI 返回 ${compact(summary.loggedOutput)}。` },
      { label: t("evidenceEstimated"), state: t("estimate"), tone: "estimated", detail: isEnglish ? `${percent(summary.coverage)} of recorded days include usage; incomplete days only show a range.` : `有用量记录的日子占 ${percent(summary.coverage)}；没有记全的部分，只给出大致范围。` }
    ];
    root.querySelector("#evidence-summary").textContent = isEnglish ? `${percent(summary.coverage)}${t("dateEvidence")}` : `${percent(summary.coverage)} 的有记录日子里能找到用量`;
    root.querySelector("#evidence-grid").innerHTML = rows.map((item) => `<div class="evidence-row evidence-${item.tone}"><strong>${item.label}</strong><span>${item.state}</span><p>${item.detail}</p></div>`).join("");
  };

  const renderPresetState = () => {
    root.querySelectorAll("[data-preset]").forEach((button) => {
      let active = false;
      if (button.dataset.preset === "all") active = iso(selectionStart) === iso(historyStart) && iso(selectionEnd) === iso(historyEnd);
      if (button.dataset.preset === "current") active = iso(selectionStart) === iso(monthStart(maxMonth)) && iso(selectionEnd) === iso(historyEnd);
      if (button.dataset.preset === "four-weeks") active = iso(selectionStart) === iso(addDays(historyEnd, -27)) && iso(selectionEnd) === iso(historyEnd);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const render = () => {
    const days = data.timeline.filter((item) => {
      const day = parseISO(item.date);
      return day >= selectionStart && day <= selectionEnd;
    });
    const summary = estimateFor(days);
    const metric = metrics[activeMetric];
    const metricRange = summary[metric.range];
    const metricMeasured = summary[metric.measured];
    const isEstimated = Math.abs(metricRange[0] - metricMeasured) > 0.001 || Math.abs(metricRange[1] - metricMeasured) > 0.001;
    shell.dataset.metric = activeMetric;
    root.querySelector("#selection-reading").textContent = `${formatDay(selectionStart)} — ${formatDay(selectionEnd)} · ${days.length} ${t("days")}`;
    root.querySelector("#metric-title").textContent = metric.label;
    const metricStatus = root.querySelector("#metric-status");
    metricStatus.textContent = isEstimated ? t("estimate") : t("recorded");
    metricStatus.className = `evidence-status ${isEstimated ? "evidence-estimate" : "evidence-confirmed"}`;
    root.querySelector("#metric-total").textContent = metric.format(summary[metric.field]);
    root.querySelector("#metric-scope").textContent = `${summary.activeDays} ${t("recordedDays")} · ${summary.commits} ${t("uses")}`;
    root.querySelector("#metric-range").textContent = metric.rangeFormat(metricRange);
    root.querySelector(".metric-context small").textContent = isEstimated ? t("estimateRange") : t("recordedValue");
    root.querySelector("#metric-measured").textContent = metric.format(summary[metric.measured]);
    root.querySelector("#metric-coverage").textContent = percent(summary.coverage);
    root.querySelector("#switch-time").textContent = hours(summary.hoursCenter);
    root.querySelector("#switch-input").textContent = compact(summary.inputCenter);
    root.querySelector("#switch-output").textContent = compact(summary.outputCenter);
    root.querySelectorAll(".metric-switch [data-metric]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.metric === activeMetric)));
    renderPresetState();
    renderPrimaryChart(days);
    renderWeekly(days);
    renderEvidence(summary);
  };

  root.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.preset === "all") setSelection(new Date(historyStart), new Date(historyEnd));
      if (button.dataset.preset === "current") setSelection(monthStart(maxMonth), new Date(historyEnd));
      if (button.dataset.preset === "four-weeks") setSelection(addDays(historyEnd, -27), new Date(historyEnd));
    });
  });
  root.querySelectorAll(".metric-switch [data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      activeMetric = button.dataset.metric;
      render();
    });
  });

  syncInputs();
  render();
})();
