# Contributing to AI Usage Strata

AI Usage Strata is a local-first static tool. A good contribution makes the
record clearer without asking people to give up their data.

## Before you start

1. Open an issue for a substantial feature, data-format change, or visual
   redesign. Small documentation fixes and focused bug fixes can go straight
   to a pull request.
2. Keep personal ledgers, screenshots, exports, browser storage, local paths,
   tokens, and client names out of branches and issues.
3. Keep every visible interface string in both Chinese and English. Add new
   copy to `assets/i18n.js`, not directly into a component.

## Development checks

The app is static HTML, CSS, and JavaScript. No package installation is needed.

```bash
python3 scripts/validate_ledger.py examples/minimal-ledger.json
python3 scripts/release_audit.py
node --check assets/app.js
node --check assets/evidence.js
node --check assets/public-adapter.js
```

Then run `启动·AI Usage Strata.command` on macOS, or any local static-file
server, and check both languages. Test import, export, reset, date rollers,
reference period, category filters, a chart-point evidence link, and all four
camera presets.

## Pull requests

Describe the user-visible change, how you tested it, and any data-format or
privacy impact. Keep pull requests narrow. Do not add analytics, remote
storage, accounts, automatic scanning, or network calls without an explicit
maintainer decision and a corresponding privacy review.

By contributing, you agree that your contribution is licensed under the MIT
License included in this repository.
