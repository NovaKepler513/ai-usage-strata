(() => {
  "use strict";

  const STORAGE_KEY = "ai-usage-strata-ledger-v1";
  const source = window.AI_USAGE_STRATA_DEMO;
  const t = window.AI_USAGE_STRATA_I18N?.t || ((key) => key);
  const pad = (value) => String(value).padStart(2, "0");
  const iso = (value) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const number = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sum = (items, field) => items.reduce((total, item) => total + number(item[field]), 0);

  const validate = (ledger) => {
    if (!ledger || !Array.isArray(ledger.records)) return t("importMissingRecords");
    const invalid = ledger.records.find((record) => !record || !/^\d{4}-\d{2}-\d{2}$/.test(record.date || "") || !Number.isFinite(Number(record.hours)) || Number(record.hours) < 0);
    if (invalid) return t("importInvalid");
    const unsupportedEstimate = ledger.records.find((record) => record.confidence === "estimated" && !String(record.estimate_basis || "").trim());
    return unsupportedEstimate ? t("importEstimate") : "";
  };
  const read = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return validate(stored) ? null : stored;
    } catch (_) { return null; }
  };
  const write = (ledger) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)); } catch (_) {} };
  const remove = () => { try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} };

  const ledger = read() || clone(source);
  const records = ledger.records.map((record, index) => ({
    ...record,
    id: `${record.date}-${index}`,
    category: String(record.category || "其他"),
    confidence: record.confidence === "estimated" ? "estimated" : "recorded",
    evidence: Array.isArray(record.evidence) ? record.evidence : []
  })).sort((left, right) => left.date.localeCompare(right.date));
  const start = records[0]?.date || iso(new Date());
  const end = records.at(-1)?.date || start;
  const byDate = new Map();
  records.forEach((record) => {
    if (!byDate.has(record.date)) byDate.set(record.date, []);
    byDate.get(record.date).push(record);
  });
  const categories = [...new Set(records.map((record) => record.category))];
  const categoryDefinitions = categories.map((name, index) => ({ name, tone: (index % 6) + 1 }));
  const timeline = [];
  for (let cursor = new Date(`${start}T12:00:00`); iso(cursor) <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = iso(cursor);
    const items = byDate.get(day) || [];
    const modules = {};
    items.forEach((item) => { modules[item.category] = (modules[item.category] || 0) + Math.max(item.activity_count || 1, 1); });
    const evidence = items.flatMap((item) => item.evidence.map((entry) => ({
      name: entry.label || "当天记录",
      path: entry.type || "记录",
      url: entry.url || "",
      confidence: item.confidence,
      estimate_basis: item.estimate_basis || ""
    })));
    timeline.push({
      date: day,
      label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
      commits: items.reduce((total, item) => total + Math.max(number(item.activity_count), 1), 0),
      semantic: items.length,
      files: evidence.length,
      hours: sum(items, "hours"),
      measured_hours: sum(items.filter((item) => item.confidence === "recorded"), "hours"),
      input_chars: sum(items, "input_chars"),
      output_chars: sum(items, "output_chars"),
      modules,
      evidence: {
        commits: items.map((item, index) => ({ sha: `record-${index + 1}`, subject: item.evidence?.[0]?.label || item.category })),
        files: [],
        records: evidence
      }
    });
  }
  const activeDays = timeline.filter((item) => item.commits).length;
  const activitySignals = sum(records, "activity_count") || records.length;
  const calibration = {
    commits_per_active_day: Math.max(1, activitySignals / Math.max(1, activeDays)),
    hours_per_active_day: [0.5, 5],
    input_chars_per_active_day: [800, 14000],
    output_chars_per_active_day: [1800, 32000]
  };
  const totals = Object.fromEntries(categories.map((category) => [category, 0]));
  timeline.forEach((item) => Object.entries(item.modules).forEach(([category, count]) => { totals[category] += count; }));
  const modules = categories.map((name) => ({ name, touches: totals[name], share: totals[name] / Math.max(1, Object.values(totals).reduce((total, value) => total + value, 0)) }));

  window.AI_USAGE_STRATA_REPORT = {
    schema_version: 1,
    generated_at: ledger.profile?.updated_at || new Date().toISOString(),
    range: { start, end, days: timeline.length, title: `${start} — ${end}` },
    view: { start, end },
    history: { start, end, days: timeline.length },
    profile: { label: ledger.profile?.label || "我的 AI 用量账本", imported: Boolean(read()) },
    git: { commits: activitySignals, semantic_commits: records.length, active_days: activeDays },
    ai_logs: { entries: records.length },
    category_definitions: categoryDefinitions,
    modules,
    timeline,
    highlights: { busiest_day: [...timeline].sort((left, right) => right.hours - left.hours)[0], leading_module: [...modules].sort((left, right) => right.share - left.share)[0] },
    baseline: {
      range: "你自己的已记录数据与估算依据",
      human_ai_hours: [sum(records.filter((item) => item.confidence === "recorded"), "hours"), sum(records, "hours")],
      input_chars: [sum(records, "input_chars"), sum(records, "input_chars")],
      visible_output_chars: [sum(records, "output_chars"), sum(records, "output_chars")],
      active_git_days: activeDays,
      git_commits: activitySignals
    },
    calibration,
    evidence: [
      { name: "这次留下的记录", status: "已记录", detail: "只来自你主动导入的账本；不会读取电脑里的聊天、文件或日历。" },
      { name: "已经记下的用量", status: "已记录", detail: "时间、输入和输出，按你账本里的数字显示。" },
      { name: "还原出来的部分", status: "估算", detail: "每条估算都要写清楚为什么这么算，不会被装成精确数字。" }
    ]
  };

  window.AI_USAGE_STRATA_LEDGER = Object.freeze({
    source: read() ? "imported" : "demo",
    importFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const next = JSON.parse(String(reader.result));
          const message = validate(next);
          if (message) throw new Error(message);
          write(next);
          window.location.reload();
        } catch (error) { window.alert(`无法导入这个账本：${error.message}`); }
      };
      reader.readAsText(file);
    },
    exportFile() {
      const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ai-usage-ledger.json";
      anchor.click();
      URL.revokeObjectURL(url);
    },
    reset() { remove(); window.location.reload(); }
  });
})();
