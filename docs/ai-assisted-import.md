# Use your own AI to prepare a ledger

AI Usage Strata has two AI-assisted routes. Neither route connects this website
to Codex, Claude, ChatGPT, or any other provider. There is no API key, account
link, cloud sync, or background reading.

## Route 1: ask AI to organise a ledger

This is the default route and works for most people.

1. In the app, choose **Ask AI to organise**.
2. Choose the kind of AI you are using and copy or download the task.
3. Tell the AI exactly which files, exports, or notes it may use.
4. Let it create `ai-usage-ledger.json`.
5. Import that file into the app. Review the date range, totals, categories,
   and estimated records before relying on the chart.

For a cloud or web AI, upload or paste only the records you choose. A cloud AI
does not have safe, automatic access to files on your computer.

## Route 2: let a local coding AI write one file

This is for local Codex or Claude Code sessions that already work in a folder
you control.

1. Put the downloaded `AI_USAGE_STRATA.md` task guide in the folder you want
   the AI to work from, or paste its contents into the AI conversation.
2. Name the exact subfolders or exports it may inspect.
3. Require a source summary before it writes.
4. Let it create or update only `ai-usage-ledger.json` in that folder.
5. Import the resulting file into the app.

The website does not grant this permission. The AI's own local permissions and
your approval decide what it can read or write. The task guide asks it to make
a `.bak` backup before replacing an existing ledger.

## The non-negotiable record rule

An AI may make a ledger easier to prepare, but it must not turn inference into
fact.

| If the source contains… | The ledger should say… |
| --- | --- |
| An explicit duration or count | `"confidence": "recorded"` |
| A reconstruction from several traces | `"confidence": "estimated"` plus `estimate_basis` |
| No reliable trace for that day | Nothing; do not invent a row |

Do not include raw conversations, credentials, client names, private file
paths, or personal identifiers in evidence labels. Keep a short description
such as `"Codex session export: product brief"` instead.

## What the app validates

The import only accepts a calendar date plus a non-negative hours value for
each row. Estimated rows must include `estimate_basis`. JSON, CSV, and TSV are
all reviewed locally before the browser saves a copy. See the full
[ledger format](ledger-format.md) and [privacy notes](privacy.md).
