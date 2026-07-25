# Ledger format

AI Usage Strata saves and exports one JSON object with a `records` array. You
do not need to write it by hand: the page can create it from its direct-entry
form or from a CSV/TSV table. It can also give your own AI a bounded task that
creates this JSON for you. JSON is the portable format for backup, sharing a
template, and advanced editing.

For an AI-assisted route, start from [AI-assisted import](ai-assisted-import.md).
The AI should create this format, but the user still reviews and deliberately
imports it; this site does not connect to an AI account or scan local records.

## Bring a normal table first

Save a spreadsheet as CSV or TSV, then choose **Import ledger / table**. The
converter suggests these common headers (Chinese and English can be mixed),
then shows a preview and mapping screen before import. You can choose the
meaning of an unfamiliar column yourself:

| Table column | Saved field |
| --- | --- |
| `日期`, `date`, `day` | `date` |
| `小时`, `hours`, `duration`, or `分钟`, `minutes` | `hours` |
| `分类`, `category` | `category` |
| `输入`, `input`; `输出`, `output`; `次数`, `count` | optional usage fields |
| `备注`, `note`, `说明` | a short evidence note |

Every converted row needs a valid calendar date plus hours or minutes. Rows
that do not meet that minimum are not silently invented; if no valid row can
be read, the import explains what is missing. This is deliberately a local,
deterministic converter rather than an AI guesser: it never uploads your table
or makes a judgement about an ambiguous column without your confirmation.

```json
{
  "schema_version": "1.0",
  "profile": { "label": "My workspace", "updated_at": "2026-07-24T18:00:00" },
  "reference_window": { "start": "2026-07-01", "end": "2026-07-31", "label": "July review" },
  "records": []
}
```

## Record fields

| Field | Required | Meaning |
| --- | --- | --- |
| `date` | yes | Calendar date in `YYYY-MM-DD`. |
| `hours` | yes | Time spent working with AI that day. Use a decimal number. |
| `category` | no | Any work direction, such as `Research` or `Operations`. New values appear automatically. |
| `confidence` | no | `recorded` (default) or `estimated`. |
| `estimate_basis` | required for estimates | Plain-language reason for the estimate. |
| `input_chars` | no | Characters you sent to AI. |
| `output_chars` | no | Characters returned by AI. |
| `activity_count` | no | Sessions, prompts, or another count you define consistently. |
| `evidence` | no | An array of short objects with `type`, `label`, and optional `url`. |

An evidence URL is optional. It can point to a local record in your own system,
but do not put private local paths in a ledger you plan to share.

## Optional reference period

`reference_window` is an optional saved date range. When it is present, the
page adds a “Reference period” shortcut beside All, This month, and Last 4
weeks. It is useful for revisiting one audit, sprint, or reporting period
without replacing the complete ledger.

Its `start` and `end` values must be `YYYY-MM-DD`, be in chronological order,
and fall inside the dates covered by `records`. `label` is optional and stays
in the JSON as a reminder; it is not sent anywhere.

## Honest estimates

This tool never silently turns missing records into a factual number. If you
reconstruct a day, set `confidence` to `estimated` and write down the basis:

```json
{
  "date": "2026-07-24",
  "hours": 2.5,
  "confidence": "estimated",
  "estimate_basis": "Calendar block plus two saved drafts",
  "category": "Writing"
}
```

That distinction is part of the record, not a decorative badge.
