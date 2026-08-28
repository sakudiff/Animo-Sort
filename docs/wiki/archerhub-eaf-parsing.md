---
title: "ArcherHub EAF parsing in the browser"
date: "2026-08-27T17:45:00+08:00"
tags:
  - architecture
  - parser
  - privacy
  - pattern
related_logs:
  - docs/logs/2026-08-27-animo-sort-functionality-first.md
---

## Overview

Animo Sort reads an official DLSU ArcherHub Enrollment Assessment Form PDF entirely in the browser using a locally vendored PDF.js runtime and reconstructs the schedule table from text-item coordinates. The parser returns only a normalized `Schedule` object and rejects the whole import on any structural or semantic error, preserving whatever valid schedule was previously held in memory.

## Details

The pipeline is `parseEafFile(file)` → `extractPdfTextItems` (every page via PDF.js, no network) → `validateArcherHubEaf` (ENROLLMENT ASSESSMENT FORM marker plus `ACADEMIC SESSION : AY yyyy-yyyy Term n`) → `parseScheduleRows` (coordinate-aware rows with wrapped-line continuation) → `normalizeMeeting` (day, time range, location) → `validateNoOverlaps` → `sanitizeSchedule`.

The normalized model is exactly `{ session, meetings: [{ id, courseCode, title, section, credits, day, startMinutes, endMinutes, startLabel, endLabel, location, modality }] }`. Times are minutes after midnight; the display labels preserve the source form (for example `02:30 PM`). The eight standard DLSU periods map to exact minutes and serve only as layout hints; custom intervals are placed by their actual endpoints.

Error handling uses a typed `EafParseError` with stable codes: `NOT_A_PDF`, `EMPTY_FILE`, `PDF_READ_FAILED`, `NOT_ARCHERHUB_EAF`, `SESSION_NOT_FOUND`, `SCHEDULE_NOT_FOUND`, `ROW_UNREADABLE`, `MEETING_UNREADABLE`, `UNSUPPORTED_DAY`, `INVALID_TIME`, `MEETING_OVERLAP`, `SCHEDULE_SANITIZATION_FAILED`. Errors carry only safe messages and non-sensitive details such as row numbers or course codes.

## Known Pitfalls

- PDF.js text-item y coordinates are bottom-up. Group lines by sorting descending y.
- Extracted header tokens merge across column gaps (`Sr.No` and `Course` become one string). Anchor column boundaries on stable later tokens and derive earlier ones.
- The no/course boundary should be treated as a fixed x=100 split; deriving it from the Course Type position breaks when that column sits at different x on different EAFs.
- The schedule column continues past x=466 into the payments section. Continuation lines must satisfy a vertical gap bound (16 points) even when they contain schedule-column words, or the payments table bleeds into the last row.
- Row numbers sit at x=79-92 and are caught by the no column, not by the leftmost-word heuristic.
- reportlab `drawString` silently clips text wider than the printable area; wrap synthetic schedule text to about 1.7 inches when the real column is ~129 points wide.

## References

| Date | Log | Summary |
|------|-----|---------|
| 2026-08-27 | [Animo Sort functionality-first implementation](../logs/2026-08-27-animo-sort-functionality-first.md) | Full implementation session, including the parser fixes listed above |
