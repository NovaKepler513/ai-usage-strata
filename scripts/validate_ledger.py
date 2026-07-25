#!/usr/bin/env python3
"""Validate the portable AI Usage Strata ledger format without uploading it."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path


def fail(message: str) -> None:
    print(f"Invalid ledger: {message}")
    raise SystemExit(1)


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: python3 scripts/validate_ledger.py path/to/ledger.json")
    path = Path(sys.argv[1]).expanduser()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(str(error))
    records = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        fail("records must be an array")
    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            fail(f"record {index} is not an object")
        try:
            date.fromisoformat(str(record["date"]))
            hours = float(record["hours"])
        except (KeyError, TypeError, ValueError):
            fail(f"record {index} needs ISO date and numeric hours")
        if hours < 0:
            fail(f"record {index} has negative hours")
        if record.get("confidence") == "estimated" and not str(record.get("estimate_basis", "")).strip():
            fail(f"record {index} is estimated but has no estimate_basis")
    reference = payload.get("reference_window")
    if reference is not None:
        if not isinstance(reference, dict):
            fail("reference_window must be an object")
        try:
            reference_start = date.fromisoformat(str(reference["start"]))
            reference_end = date.fromisoformat(str(reference["end"]))
        except (KeyError, TypeError, ValueError):
            fail("reference_window needs ISO start and end dates")
        if reference_start > reference_end:
            fail("reference_window start is after end")
        record_dates = [date.fromisoformat(str(record["date"])) for record in records]
        if record_dates and (reference_start < min(record_dates) or reference_end > max(record_dates)):
            fail("reference_window must fall inside the ledger record range")
    print(f"Valid ledger: {len(records)} records")


if __name__ == "__main__":
    main()
