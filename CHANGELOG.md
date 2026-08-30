# Changelog

All notable changes to AnimoSort are documented here.

---

## v0.3.0 — 2026-08-30

### Night classes, responsive previews, and an auditable data path

This release closes the gap between what an Archershub EAF contains and what a
usable timetable needs to display. It addresses truncated hyphenated course
codes, meetings after the standard daytime periods, short cards whose content
could overflow their time slot, and previews that required horizontal scrolling
on narrow screens.

#### Course identity normalization

- `assets/js/eaf-parser.js` now separates course identity parsing into
  `parseCourseIdentity()` instead of relying on a single prefix match inside
  `parseCourseRow()`.
- The parser accepts both compact and hyphenated forms, including
  `THSST2-THESIS IN SOFTWARE TECHNOLOGY 2` and
  `THS-ST2-THESIS IN SOFTWARE TECHNOLOGY 2`.
- Whitespace and code-internal hyphens are removed only from the code portion,
  so both forms normalize to the canonical `THSST2` while title punctuation such
  as `THESIS-BASED PROJECT` remains intact.
- The normalized code is used consistently for the sanitized meeting object,
  DOM course cards, course-color keys, legend badges, accessibility labels, and
  SVG/PNG export text. Codes such as `FINSBRE`, `THSADV1`, `THSADV2`, `COBIBFM`,
  `GELITPH`, `LCFAITH`, `FINARTS`, and `INFOECO` are preserved in full.

#### Time parsing and arbitrary meeting intervals

- `parseTimeLabel()` converts 12-hour labels into comparable minute offsets,
  including the 12 AM and 12 PM boundaries.
- `parseTimeRange()` validates each start/end pair and keeps the original
  display labels for the UI and export. It does not restrict a meeting to the
  canonical `STANDARD_PERIODS` list.
- `splitMeetingSegments()` extracts every `DAY | start - end | room` segment
  from the EAF schedule column, including PDF text where the separator spacing
  varies.
- The renderer derives its vertical range from the earliest and latest actual
  meeting endpoints, with a 15-minute visual breathing room on either side.
  Canonical DLSU periods remain layout guides, not parser limits; actual meeting
  starts and ends are added as guides as well.
- `fitScheduleBody()` measures the rendered card content and increases the day
  body when a long title, room label, or short meeting interval needs more
  vertical space. The proportional calculation is based on
  `contentHeight * timeSpan / duration`, so a short late class receives enough
  room without changing the relative placement of other meetings.
- This covers meetings such as 7:45 PM–9:15 PM, 9:00 PM–11:00 PM, and short
  9:00 PM–9:30 PM intervals rather than treating 7:30 PM as a hard cutoff.

#### Export sizing and preview/export separation

- `assets/js/export.js` centralizes vertical layout in `getTimelineLayout()`.
  It calculates `canvasStart`, `canvasEnd`, `minutesInSpan`, `gridHeight`, and
  the resulting `svgHeight` from the actual schedule.
- Export cards use the same numeric time mapping as the grid, while the
  exporter also checks each card's content requirements before selecting a
  minimum grid height. Late cards and their time labels therefore remain inside
  the SVG bounds instead of being clipped by the old fixed 1000px canvas.
- `downloadSchedulePng()` derives the raster canvas height from the generated
  SVG and still renders at a 2x scale. The exported PNG remains a fixed,
  independent 1400px-wide schedule surface.
- Mobile preview transforms live only in `assets/js/app.js` and `styles.css`;
  no responsive CSS transform is applied to the SVG/PNG exporter. This keeps
  screen-fit behavior from changing downloaded image dimensions or typography.

#### Uniform timetable scaling

- The preview uses a stable 1096px master surface: an 88px time gutter plus six
  168px day columns. The internal grid, cards, labels, and controls are laid
  out once at that size.
- `fitTimetablePreview()` measures the actual `#schedule-scroll` content width
  after rendering and on window resize. It applies only a downscale factor,
  `min(1, availableWidth / naturalWidth)`, with `transform-origin: top left`.
- The wrapper receives the scaled canvas height, preventing the CSS transform
  from collapsing the layout's occupied vertical space. Horizontal overflow is
  hidden only while the preview is scaled, so the six-day surface cannot be
  accidentally scrolled out of view.
- This produces a birds-eye view at 320px, 390px, tablet widths, and the
  intermediate 900px layout where the old viewport-only mobile gate failed.
  Desktop widths retain the same master geometry without upscaling.

#### Mobile course-color controls

- The course legend gains an accessible disclosure control below 480px.
- `initCourseLegendToggle()` synchronizes the disclosure state with the media
  query and maintains `aria-expanded` for keyboard and assistive-technology
  users.
- Individual course dots still open the full palette popover, including pastel
  presets, custom hex input, Randomize, and Set All Plain. The compact legend
  changes only how controls are revealed; it does not change course-color
  persistence or PNG color synchronization.

#### Import, story, and project surfaces

- The landing page keeps the protected hero promise unchanged: local parsing,
  Monday-through-Saturday output, no uploads, no accounts, and no schedule data
  leaving the browser.
- The import panel now explains the 1 MiB limit, official Archershub-only
  compatibility, local processing, and the unsupported legacy Animo.sys format
  without competing with the primary upload action.
- The story section uses the supplied Archershub screenshot as a clickable
  source receipt and generates its sample output through the same
  `createScheduleSvg()` export function used by the application.
- The story bridge arrow was rebuilt from separate shaft and filled-head
  pseudo-elements so the line stops before the arrowhead on both orientations.
- Footer content is grouped into About AnimoSort, Compatibility, and Project
  sections, with direct author, releases, and source links.

#### Verification

- `tests/eaf-parser.test.mjs` covers compact and PDF.js-separated hyphenated
  course codes, full-length standard codes, title hyphens, late intervals, and
  non-standard intervals.
- `tests/export.test.mjs` covers dynamic SVG height, complete late-card text,
  canonical course-code output, and a short 9:00 PM–9:30 PM class.
- The supplied official EAF parses to 7 courses and 14 meetings, with all 14
  course-code instances preserved.
- Browser checks cover 320px, 390px, 900px, and 1440px viewports; the timetable
  surface fits its wrapper without horizontal scrolling, and PNG download
  remains available from the live production site.
- `npm test` passes all 6 tests. No dependency changes were required.

---

## v0.2.0 — 2026-08-28

### We Have Colors Now

Apparently chronological order wasn't enough innovation for one week.

- **Course colors** — Subjects can now have their own colors, consistently applied across their meetings. Recognizing a class no longer requires reading the same course code six times.
- **Aesthetic pastel presets** — Pick from eight curated pastel palettes (Sage, Sky, Lavender, Peach, Mint, Rose, Sand, Slate) for people who want something pretty without turning schedule creation into an industrial design project.
- **Plain minimal mode** — A dedicated "Plain" option removes all color tints for minimalists, cowards, and people whose schedules already contain enough suffering.
- **Custom colors & hex codes** — Full native color picker plus direct `#HEX` code input with live synchronization. Yes, your 7:30 AM class can now be displayed in the exact shade of resentment it deserves.
- **Randomize** — Automatically assign aesthetic pastel colors to all courses for people who have better things to do than pick eight colors.
- **Set All Plain** — Resets every class to monochrome in one click.
- **Consistent meetings** — A course keeps its chosen color across different days, rooms, and modalities. We have discovered visual encoding.
- **Spacious card layout** — Expanded card padding, row gaps, and typography so multi-line course titles, rooms, and times no longer feel like a packed LRT-1 commute.
- **Theme-aware PNG export** — Custom colors, active AMOLED dark mode counter-tints, and top-right swatch dots carry directly into downloaded timetable images. Your suffering is now exportable in high resolution.
- **Velasco Hall mapping** — Room codes starting with `V` (e.g., `V204`) properly expand to `Velasco Hall` instead of leaving you stranded.
- **AMOLED dark mode** — Added a full `#000000` AMOLED dark theme with a header toggle button for late-night schedule contemplation.
- **Archershub branding alignment** — Updated portal references to Archershub across the interface and documentation.

> **Engineering note:** AnimoSort now supports chronological order, dark mode, custom hex codes, and colors. At this rate we may accidentally build a functional schedule application.

---

## v0.1.0 — 2026-08-28

### The "Your Timetable Has Now Been Created" Release

For students who continue to experience time chronologically.

- **Chronological sorting** — Cutting-edge technological breakthrough where morning classes appear before afternoon classes.
- **Browser-only local parsing** — PDF.js processes your official DLSU Archershub EAF completely in-memory. Zero server uploads, zero accounts, zero tracking, zero AI reading your data.
- **Room decoder** — Translates cryptic building abbreviations (`L`, `M`, `A`, `G`, `Y`, `V`, `STRC`, etc.) into actual human campus locations.
- **High-res PNG export** — Generates clean weekly schedule images so you don't have to keep opening a 4-page PDF receipt.
- **Standard period gutter** — Clear time markers and gridlines aligned with DLSU course blocks.
- **Responsive timetable** — Works across desktop and mobile screens with horizontal scrolling.

> **Engineering note:** Turns out converting a list of class times into a calendar grid is technically feasible in the 21st century. Who knew.
