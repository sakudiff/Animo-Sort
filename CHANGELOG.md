# Changelog

All notable changes to AnimoSort are documented here.

---

## Unreleased

This section records the work on `dev` after the v0.3.0 release, including the
portable customization, calendar handoff, documentation, navigation, and
Archify presentation work. The package version is still `0.3.0`; these changes
remain unreleased until a new version is cut.

### Portable customization profiles

- Added named, browser-local customization profiles using a versioned
  `animosort-customization` JSON format. Profiles can be downloaded, moved to
  another browser, and imported later without sending timetable data to a
  server.
- Kept one active profile at a time. Importing a saved profile creates and
  activates a new profile instead of silently merging it into the current one;
  duplicate names receive a safe suffix. Users can rename profiles afterward.
- Kept the built-in `Default` profile protected. It is the neutral fallback
  used by the existing random/default-color flow and cannot be deleted.
- Unified the resolved values used by the live timetable, customization
  controls, preview, and PNG/SVG export. Course cards present metadata in a
  predictable order: `CourseCode Section · customization dot`, course title,
  room or online mode, professor when supplied, and time.
- Added course-wide colors, section-specific F2F/Online overrides, optional
  professor labels, and arbitrary opaque 3- or 6-digit hex values entered
  through the native color picker or text field. Long titles, rooms, and
  professor names wrap and expand their cards instead of being clipped.
- Added scoped reset actions for colors, details, or everything. Resetting
  returns the selected profile to the transparent/neutral baseline while
  preserving the protected built-in default.
- Added Match site, Light, and Dark PNG export themes. The on-site preview
  follows the selected export theme so the downloaded image matches what the
  user is shown before downloading.
- Migrated legacy `animosort_course_colors` values into the Default profile
  without deleting the legacy key, preserving existing users' choices.
- Added profile persistence, migration, reset, resolution, custom-color, and
  export metadata tests. See the [customization guide](how-to-use.html#customization-profiles)
  for the user-facing workflow.

### Google Calendar handoff

- Added a manual **Export to Google Calendar (.ics)** handoff. It generates a
  standard calendar file locally; it does not request Google account access or
  call the Google Calendar API.
- Requires an actual term start date and end date. Both dates are inclusive,
  are not saved, and may begin or end mid-week. Weekly classes are emitted only
  for occurrences inside that exact range, so partial first and last weeks are
  handled correctly.
- Writes Manila-timezone events (`Asia/Manila`) with the course code, section,
  room or Online mode, professor when available, meeting day, time, and session
  information. Classes with no occurrence in the selected range are skipped.
- Adds no reminders and blocks an empty export with a useful explanation.
  The [calendar handoff guide](how-to-use.html#google-calendar) explains what
  an `.ics` file is, how to import it into Google Calendar, and why importing
  works best on a computer.

### About page, source receipts, and import clarity

- Moved the landing-page pitch into a dedicated, full-width [About page](about.html),
  keeping the main page focused on importing an EAF and viewing a timetable.
- Added a responsive before/after story using the supplied Archershub Schedule
  screenshot. The source receipt and generated AnimoSort output are clickable
  and expandable so the evidence can be inspected without permanently taking
  over the page.
- Added import guidance that explains the supported official Archershub EAF,
  local-only processing, and the file-size/format constraints.
- Replaced the generic import loading treatment with an accessible progress bar
  that advances through the actual parser stages, while keeping the dropzone as
  the primary upload surface.

### Navigation and discoverability

- Added shared responsive navigation with a mobile hamburger menu, outside-click
  and Escape dismissal, and automatic close after navigation.
- Added clear About and How to use entry points in the header, footer, and hero.
  The main page now exposes [See how the code works](about.html#pipeline), and
  reader-facing links use green underlines/highlights so they are discoverable
  without overpowering the interface.
- Added the persistent, subtle “Click to learn more” nudge while the About CTA
  is visible, with reduced-motion behavior for users who request less motion.
- Kept GitHub as the source/audit destination while removing the redundant
  question-mark icon from the mobile menu.

### Interactive Archify pipeline

- Added a responsive architecture reference at [About → How the code works](about.html#pipeline),
  rendered with [Archify](https://github.com/tt-a1i/archify). Desktop and narrow
  screens use separate generated viewers so the pipeline remains readable at
  both widths.
- Added light/dark viewer synchronization with the site theme and a direct
  full-view link. The diagram names the actual browser-side modules and
  functions, including `initApp`, `parseEafFile`, `parseScheduleRows`,
  `renderSchedule`, `downloadCustomization`, `downloadSchedulePng`, and
  `formatIcsCalendar`.
- Added the generated [desktop viewer](assets/animosort-workflow.html),
  [mobile viewer](assets/animosort-workflow-mobile.html), and their companion
  `.workflow.json` source specifications. Archify is used to generate the
  reviewable artifacts; it is not added as a runtime dependency of the app.
- Linked the pipeline from the main page and documented the artifacts and
  regeneration boundary in the [README](README.md#interactive-pipeline-diagram).

### Unreleased commit ledger

The following commits were audited from the v0.3.0 tag through the current
`dev` tip. The release-polish commits are already described in the v0.3.0
section below, so they are linked here instead of repeating their details.

Release-polish commits covered by v0.3.0:

- [`553f55d`](https://github.com/sakudiff/Animo-Sort/commit/553f55d) — normalize
  course codes and size exports.
- [`650ff40`](https://github.com/sakudiff/Animo-Sort/commit/650ff40) — fit the
  timetable across mobile screens.
- [`2ca353a`](https://github.com/sakudiff/Animo-Sort/commit/2ca353a) — scale the
  mobile timetable and collapse the color legend.
- [`6c76bf0`](https://github.com/sakudiff/Animo-Sort/commit/6c76bf0) — prepare
  v0.3.0 release notes and footer credit.
- [`1916cfe`](https://github.com/sakudiff/Animo-Sort/commit/1916cfe) — organize
  footer information hierarchy.
- [`d52e72c`](https://github.com/sakudiff/Animo-Sort/commit/d52e72c) — add the
  schedule story and import guidance.
- [`196eeeb`](https://github.com/sakudiff/Animo-Sort/commit/196eeeb) — preserve
  timetable proportions across viewports.
- [`1caddfb`](https://github.com/sakudiff/Animo-Sort/commit/1caddfb) — detail
  the v0.3.0 release changes.

Work added after the v0.3.0 release:

- [`523ea4a`](https://github.com/sakudiff/Animo-Sort/commit/523ea4a) — portable
  customization profiles and PNG themes.
- [`e69776c`](https://github.com/sakudiff/Animo-Sort/commit/e69776c) — weekly
  timetable ICS export.
- [`762fcbe`](https://github.com/sakudiff/Animo-Sort/commit/762fcbe) — About page
  story and import progress.
- [`938ff6d`](https://github.com/sakudiff/Animo-Sort/commit/938ff6d) — responsive
  navigation menu.
- [`6bd6d27`](https://github.com/sakudiff/Animo-Sort/commit/6bd6d27) — About page
  prompts on the home page.
- [`d1141d2`](https://github.com/sakudiff/Animo-Sort/commit/d1141d2) — nudge users
  toward the About page.
- [`4e0f241`](https://github.com/sakudiff/Animo-Sort/commit/4e0f241) — refine the
  About nudge entrance.
- [`9188179`](https://github.com/sakudiff/Animo-Sort/commit/9188179) — keep the
  About nudge active while it is in view.
- [`041da9f`](https://github.com/sakudiff/Animo-Sort/commit/041da9f) — make
  reader-facing links discoverable.

#### Verification

- The audited commit range contains no dependency or server-side data path for
  EAF processing; parsing and export remain browser-local.
- `npm test` passes all 26 tests. JavaScript syntax checks and `git diff --check`
  also pass.
- Playwright checks pass at 390px and 1440px for the home, About, and How to use
  pages, including the hamburger menu, GitHub icon, Archify section, links, and
  horizontal-overflow guard.

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
