# AI Usage Strata local-write task

Use this file when a local coding AI is helping prepare an AI Usage Strata
ledger. The user must explicitly name the folders or exports you may read.

## Permission boundary

- Read only the folders, files, or exports the user explicitly authorises.
- Do not inspect browser profiles, hidden caches, credentials, login state,
  unrelated directories, or network services.
- Do not send material to any remote service unless the user separately asks.
- Before reading, state the source scope. Ask a question instead of widening it.

## Write boundary

- Write only `ai-usage-ledger.json` in the current directory.
- If that file exists, first create `ai-usage-ledger.json.bak` beside it.
- Do not edit source logs, chat exports, or other project files.

## Ledger rules

- Group approved material by calendar date.
- Use `confidence: "recorded"` only for values directly present in a source.
- Use `confidence: "estimated"` only with a specific `estimate_basis`.
- Omit days without evidence.
- Keep `evidence.label` short and non-sensitive. Never copy raw chat text,
  credentials, client names, or private paths into it.
- End by reporting the source scope, record count, date range, recorded total,
  and estimated total.

Use the format documented in `../../docs/ledger-format.md`. The completed JSON is
reviewed and imported by the user in the browser; do not upload it.
