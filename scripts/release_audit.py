#!/usr/bin/env python3
"""Fail closed on common accidental disclosure patterns in a public release."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".py", ".txt", ".yml", ".yaml"}
EXCLUDED_PARTS = {".git", "node_modules", "__pycache__"}
FORBIDDEN = {
    "local home path": re.compile("/" + "Users" + "/", re.I),
    "local document URL": re.compile("file:" + "//", re.I),
    "local note URL": re.compile("obsidian:" + "//", re.I),
    "generic API secret": re.compile(r"\b(?:sk|ghp)_[A-Za-z0-9_-]{10,}\b"),
    "cloud access key": re.compile(r"\bAKIA[A-Z0-9]{12,}\b"),
    "assigned password": re.compile(r"(?i)password\s*[:=]\s*\S+"),
    "assigned API key": re.compile(r"(?i)api[_-]?key\s*[:=]\s*\S+"),
}
BAD_NAMES = {".DS_Store", ".env"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--term", action="append", default=[], help="Additional private term; repeat as needed")
    parser.add_argument("--terms-file", type=Path, help="One additional private term per line; keep it outside this repository")
    return parser.parse_args()


def custom_terms(args: argparse.Namespace) -> list[str]:
    terms = [term.strip() for term in args.term if term.strip()]
    if args.terms_file:
        try:
            terms.extend(line.strip() for line in args.terms_file.read_text(encoding="utf-8").splitlines() if line.strip() and not line.lstrip().startswith("#"))
        except OSError as error:
            print(f"Cannot read terms file: {error}", file=sys.stderr)
            raise SystemExit(2)
    return sorted(set(terms), key=str.casefold)


def files() -> list[Path]:
    return [path for path in ROOT.rglob("*") if path.is_file() and not any(part in EXCLUDED_PARTS for part in path.parts)]


def main() -> None:
    args = parse_args()
    rules = dict(FORBIDDEN)
    rules.update({f"custom term: {term}": re.compile(re.escape(term), re.I) for term in custom_terms(args)})
    findings: list[str] = []
    for path in files():
        relative = path.relative_to(ROOT)
        if path.name in BAD_NAMES or path.suffix == ".log":
            findings.append(f"release clutter: {relative}")
        if path.suffix not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            findings.append(f"non-UTF-8 text candidate: {relative}")
            continue
        for label, pattern in rules.items():
            if pattern.search(text):
                findings.append(f"{label}: {relative}")
    if findings:
        print("Release audit failed:")
        print("\n".join(f"- {finding}" for finding in findings))
        raise SystemExit(1)
    print("Release audit passed: no generic disclosure pattern found.")


if __name__ == "__main__":
    main()
