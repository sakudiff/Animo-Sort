#!/usr/bin/env python3
"""Verify synthetic fixture hygiene: no real identity, ID, or fee values."""

from __future__ import annotations

import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE_DIR = os.path.join(HERE, "fixtures")
FORBIDDEN = [
    "SISON",
    "12320609",
    "99,820",
    "AARON JOSHUA",
    "Trimester 10",
    "08/26/2026 03:25 PM",
]
REAL_COURSE_CODES = ["ECOF223", "ECOF366", "LCASEAN", "DATA103", "FINIVBA", "FINSPTO", "GESTSOC"]


def main() -> int:
    failures = []
    for name in sorted(os.listdir(FIXTURE_DIR)):
        if not name.endswith(".pdf"):
            continue
        text = subprocess.run(
            ["pdftotext", os.path.join(FIXTURE_DIR, name), "-"],
            capture_output=True,
            text=True,
        ).stdout
        for token in FORBIDDEN:
            if token.lower() in text.lower():
                failures.append(f"{name} contains forbidden token {token!r}")
        for code in REAL_COURSE_CODES:
            # Real codes must not appear combined with real titles; the titles
            # themselves are common words, so only flag exact code occurrences.
            if re.search(rf"\b{code}\b", text):
                failures.append(f"{name} contains real course code {code!r}")
    if failures:
        print("FIXTURE HYGIENE FAIL")
        for f in failures:
            print(" -", f)
        return 1
    print("FIXTURE HYGIENE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
