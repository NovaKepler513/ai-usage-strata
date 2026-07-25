(() => {
  "use strict";

  const STORAGE_KEY = "ai-usage-strata-ledger-v1";
  const SOURCE_KEY = "ai-usage-strata-ledger-source-v1";
  const demoLedger = window.AI_USAGE_STRATA_DEMO;
  const emptyLedger = {
    schema_version: "1.0",
    profile: { label: "" },
    records: []
  };
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
    if (unsupportedEstimate) return t("importEstimate");
    const window = ledger.reference_window;
    if (window && (!/^\d{4}-\d{2}-\d{2}$/.test(window.start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(window.end || "") || window.start > window.end)) return t("importReference");
    return "";
  };
  const read = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return validate(stored) ? null : stored;
    } catch (_) { return null; }
  };
  const write = (ledger, source) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
      localStorage.setItem(SOURCE_KEY, source);
    } catch (_) {}
  };
  const save = (next, source = "imported") => {
    const message = validate(next);
    if (message) throw new Error(message);
    write(next, source);
    window.location.reload();
  };
  const normaliseDate = (value) => {
    const source = String(value || "").trim();
    const match = source.match(/^(\d{4})[-./年]\s*(\d{1,2})[-./月]\s*(\d{1,2})日?$/);
    if (!match) return "";
    const [, year, month, day] = match;
    const candidate = `${year}-${pad(month)}-${pad(day)}`;
    const date = new Date(`${candidate}T12:00:00`);
    return !Number.isNaN(date.getTime()) && iso(date) === candidate ? candidate : "";
  };
  const parseNumeric = (value) => {
    const cleaned = String(value ?? "").replace(/[，,\s]/g, "").replace(/[^\d.+-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const parseDelimited = (text) => {
    const lines = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const readLine = (line) => {
      const values = [];
      let current = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; continue; }
        if (char === '"') { quoted = !quoted; continue; }
        if (char === delimiter && !quoted) { values.push(current.trim()); current = ""; continue; }
        current += char;
      }
      values.push(current.trim());
      return values;
    };
    const headers = readLine(lines[0]).map((header) => String(header).trim().toLowerCase().replace(/[\s_\-（）()]/g, ""));
    return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, readLine(line)[index] || ""])));
  };
  const tableValue = (row, aliases) => aliases.map((key) => row[key]).find((value) => String(value ?? "").trim() !== "") || "";
  const ledgerFromTable = (text, label) => {
    const rows = parseDelimited(text);
    const aliases = {
      date: ["date", "日期", "day", "日期时间", "时间"],
      hours: ["hours", "hour", "小时", "时长", "时数", "duration", "投入时间"],
      minutes: ["minutes", "minute", "分钟", "min"],
      category: ["category", "分类", "类型", "工作分类", "direction"],
      input: ["input", "inputchars", "输入", "输入字数", "prompt", "promptchars"],
      output: ["output", "outputchars", "输出", "输出字数", "response", "responsechars"],
      count: ["count", "activitycount", "次数", "使用次数", "会话数", "sessions", "prompts"],
      note: ["note", "备注", "说明", "当天说明", "evidence", "记录"]
    };
    const records = rows.map((row) => {
      const date = normaliseDate(tableValue(row, aliases.date));
      const hourValue = tableValue(row, aliases.hours);
      const hours = String(hourValue).trim() ? parseNumeric(hourValue) : parseNumeric(tableValue(row, aliases.minutes)) / 60;
      const note = String(tableValue(row, aliases.note)).trim();
      if (!date || !Number.isFinite(hours)) return null;
      return {
        date,
        hours,
        category: String(tableValue(row, aliases.category)).trim() || "其他",
        input_chars: parseNumeric(tableValue(row, aliases.input)),
        output_chars: parseNumeric(tableValue(row, aliases.output)),
        activity_count: parseNumeric(tableValue(row, aliases.count)) || 1,
        confidence: "recorded",
        evidence: note ? [{ type: "note", label: note }] : []
      };
    }).filter(Boolean);
    if (!records.length) throw new Error(t("importTableInvalid"));
    return {
      schema_version: "1.0",
      profile: { label: String(label || "").replace(/\.[^.]+$/, "") || t("importedLedger"), updated_at: new Date().toISOString() },
      records
    };
  };
  const remove = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SOURCE_KEY);
    } catch (_) {}
  };

  const storedLedger = read();
  const source = storedLedger ? (localStorage.getItem(SOURCE_KEY) || "imported") : "empty";
  const ledger = storedLedger || clone(emptyLedger);
  const records = ledger.records.map((record, index) => ({
    ...record,
    id: `${record.date}-${index}`,
    category: String(record.category || "其他"),
    confidence: record.confidence === "estimated" ? "estimated" : "recorded",
    evidence: Array.isArray(record.evidence) ? record.evidence : []
  })).sort((left, right) => left.date.localeCompare(right.date));
  const start = records[0]?.date || iso(new Date());
  const end = records.at(-1)?.date || start;
  const suppliedReference = ledger.reference_window;
  const referenceWindow = suppliedReference && suppliedReference.start >= start && suppliedReference.end <= end
    ? { start: suppliedReference.start, end: suppliedReference.end, label: String(suppliedReference.label || "") }
    : null;
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
    reference_window: referenceWindow,
    profile: { label: ledger.profile?.label || t("emptyLedger"), imported: source === "imported", source, has_records: records.length > 0 },
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
    source,
    importFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const next = JSON.parse(String(reader.result));
          save(next);
        } catch (error) { window.alert(`无法导入这个账本：${error.message}`); }
      };
      reader.readAsText(file);
    },
    importTableFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try { save(ledgerFromTable(String(reader.result), file.name)); }
        catch (error) { window.alert(`${t("importTableError")}：${error.message}`); }
      };
      reader.readAsText(file);
    },
    saveLedger(next) {
      try { save(next); }
      catch (error) { window.alert(`${t("saveLedgerError")}：${error.message}`); }
    },
    exportFile() {
      const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "my-ai-usage-ledger.json";
      anchor.click();
      URL.revokeObjectURL(url);
    },
    downloadTemplate() {
      const blob = new Blob([JSON.stringify(emptyLedger, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ai-usage-ledger-template.json";
      anchor.click();
      URL.revokeObjectURL(url);
    },
    loadDemo() { write(clone(demoLedger), "demo"); window.location.reload(); },
    clear() { remove(); window.location.reload(); }
  });
})();
