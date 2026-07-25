# AI Usage Strata

[English](README.md) · [简体中文](README.zh-CN.md)

Local-first visual bookkeeping for time spent working with AI.

AI Usage Strata turns a small, portable activity ledger into an interactive
view of time, input, output, confidence, and work direction. It is designed
for people who want the useful question — “what did I actually put into this?”
— without handing their work record to another dashboard.

中文：这是一个完全在本机浏览器运行的 AI 协作用量账本。导入自己的 JSON 后，可以看时间强度、每周投入、工作分类和当天证据；数据不会上传。

## What is included

- The same time-strata reading structure throughout: overview, 3D waterfall
  ridges, preset views, date marks, weekly allocation, and evidence.
- Direct start/end date rollers, all-history views, and point-level evidence inspection.
- Automatic category expansion: new categories appear without changing code.
- Import, export, and reset controls. Imported data stays in the browser.
- A compact JSON format and a validator for keeping the ledger readable.
- A release audit that rejects common private paths, local URLs, secret-like
  strings, accidental local data, and release clutter.

## What is deliberately not included

- Any real person’s activity, chat content, filesystem path, Git history, or
  generated report.
- Any cloud sync, telemetry, account system, or hidden network request.
- A claim that estimated hours are factual. Estimates must be labelled and
  carry an `estimate_basis` field in the ledger.

## Start in 30 seconds

1. Download or clone this repository.
2. Open `index.html` in a modern browser. No build step or server is needed.
   On macOS, double-click `启动·AI Usage Strata.command`.
3. Use the sample data first, then choose “导入账本” to select your own JSON
   file.
4. Click a point on the ridgeline to inspect that day’s evidence.

Your imported ledger is held in browser storage for that browser profile. Use
“Export current ledger” for a portable backup; use “Return to demo” to remove
the imported copy from this app.

## Ledger format

The complete field guide is in [docs/ledger-format.md](docs/ledger-format.md).
At minimum, each record needs a date and a number of hours:

```json
{
  "schema_version": "1.0",
  "profile": { "label": "My workspace" },
  "records": [
    {
      "date": "2026-07-24",
      "hours": 2.5,
      "category": "Research",
      "confidence": "recorded",
      "activity_count": 3,
      "evidence": [{ "type": "note", "label": "Daily working note" }]
    }
  ]
}
```

Validate before importing:

```bash
python3 scripts/validate_ledger.py path/to/my-ledger.json
```

[`examples/minimal-ledger.json`](examples/minimal-ledger.json) is a small,
valid file you can import or adapt.

## Privacy model

The app has no server-side component and makes no network request. The JSON
you choose is parsed in the browser, then kept in that browser’s local storage
until you export or reset it. Read the limits and safe-use rules in
[docs/privacy.md](docs/privacy.md).

## Release safety

Before making a fork or a release public, run:

```bash
python3 scripts/release_audit.py
```

Add your own identifying terms only on your machine:

```bash
python3 scripts/release_audit.py --term "my-private-project" --terms-file private-terms.txt
```

The terms file should stay outside this repository. More detail is in
[docs/release-checklist.md](docs/release-checklist.md).

## License and author

MIT © 2026 Nova Kepler. See [LICENSE](LICENSE).

The included demo ledger is fictional and may be reused with the code.
