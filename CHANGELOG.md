# Changelog

All notable changes to AnimoSort are documented here.

---

## Unreleased

No changes yet.

## v0.4.4 - 2026-09-02

This release makes schedule customization more precise, carries safe online
meeting links into calendar files, expands Laguna room-code support, refreshes
the user guide and verification fixtures, and delivers a copy hotfix that clarifies
the Enrollment Assessment Form (EAF) and De La Salle University context for external
visitors and employers.

### Copy and institutional context hotfix

- Refined the landing page hero subtext to introduce the official Enrollment
  Assessment Form from De La Salle University while preserving the core headline.
- Clarified the Enrollment Assessment Form definition in the About page story
  section and How to Use guide as the official proof of enrollment generated
  through Archershub.
- Expanded user-facing DLSU references across the landing page, guides, error
  messages, and documentation to De La Salle University.

### Effective schedule customization

- Added section-level editing for course code, section, title, room, time,
  delivery mode, color, and professor details.
- Added `Automatic`, `Paired meetings`, and `This meeting` scopes so paired
  meetings can share intentional changes without erasing normal EAF
  differences such as day, time, room, or delivery mode.
- Added manual time entry for asynchronous or no-fixed-time rows while keeping
  those rows visible in the timetable and excluding unresolved rows from
  calendar export.
- Added conflict review and atomic validation for paired edits, including
  overlap protection and scoped restoration from the source EAF.
- Kept profile JSON portable and presentation/detail-only: source EAF data,
  identity data, session data, and meeting records are not exported.

### Calendar links and room labels

- Added recurring `.ics` export for effective timed meetings.
- When an Online platform field contains a full `http://` or `https://` URL,
  the exporter writes it to the standard calendar `URL` field and includes a
  description fallback. Text labels such as `Zoom` remain descriptive text,
  and unsafe URL schemes are not serialized.
- Added building-code expansions for St. Mutien Marie Hall (`MM`) and the
  DLSU Laguna mappings `MRR`, `UH`, `EKR`, `RL`, and `LC1`/`LC2`.

### Guide, screenshots, and verification

- Reworked the How to Use page around task-based guidance for importing,
  effective details, profiles, PNG export, and calendar handoff, including the
  supported building-code reference and the calendar-link disclosure.
- Replaced the broad calendar screenshot with a focused handoff capture and
  documented the Google Calendar computer import path beside the iPhone Apple
  Calendar handoff and Save to Files fallback.
- Added a comprehensive EAF fixture, controller tests, and browser acceptance
  coverage for imports, paired edits, conflict choices, responsive layouts,
  reduced motion, PNG export, and calendar export.
- Kept the README product screenshots focused on local import, timetable
  output, customization profiles, and the architecture pipeline, while
  linking the current workflow captures from the How to use guide.

### Implementation details for maintainers

The release preserves a source schedule and derives an effective schedule from
it. The parser owns normalized EAF data. The customization resolver produces a
projection for the active profile. The renderer, PNG exporter, and calendar
serializer consume that projection. This boundary matters because editing a
profile must not rewrite the imported receipt, and each output must represent
the same effective values.

The main browser-side path is implemented in the following modules.

- [`assets/js/eaf-parser.js`](assets/js/eaf-parser.js) performs local PDF.js
  extraction, structure checks, row parsing, normalization, and validation.
  `extractPdfTextItems()` loads the vendored PDF.js module and worker, reads
  each page into text items with string, horizontal position, vertical
  position, and width values, and reports bounded progress phases. It does not
  send the file to a parsing service.
- `groupItemsIntoLines()` sorts PDF.js coordinates top-first and joins items
  whose vertical positions are within a 2.5 point tolerance. The row parser
  then detects the `Day/Time/Room` header, derives column boundaries from the
  stable Section, Credits, and schedule headers, and keeps wrapped row lines
  within a 16 point vertical gap. This is a coordinate-aware parser rather
  than a plain text split, because PDF extraction does not guarantee that
  visual columns arrive in reading order.
- `validateArchershubEaf()` checks for the Enrollment Assessment Form marker
  and an academic session. `parseScheduleRows()` rejects unreadable rows
  instead of replacing a working timetable with partial data. `sanitizeSchedule()`
  applies the final allowed-field contract to every scheduled and unplaced
  meeting before the result reaches the UI.
- `normalizeMeeting()` converts twelve-hour labels into integer minute values,
  retains the source display labels, preserves the original room string, and
  attaches the normalized building code, building name, modality, and stable
  meeting identity. `parseTimeRange()` accepts non-standard intervals as long
  as the end is after the start, so layout hints do not become parser limits.
- `normalizeUnplacedMeeting()` represents an explicit asynchronous row with
  null day, time, and location values plus `scheduled` set to false. The eight
  supported asynchronous markers are centralized in
  `ASYNC_SCHEDULE_MARKERS`. `validateNoOverlaps()` ignores unplaced meetings
  and performs same-day interval checks on scheduled meetings before import
  completes.
- `BUILDING_NAMES`, `getBuildingCode()`, `getBuildingName()`, and
  `expandLocation()` keep the source label while adding a human-readable
  suffix. The `LC` registry entry intentionally covers both `LC1` and `LC2`
  through prefix matching. Unknown prefixes remain unchanged instead of being
  guessed.

The profile and effective-value layer lives in
[`assets/js/customization.js`](assets/js/customization.js).

- The portable profile contract is versioned with `CONFIG_FORMAT`,
  `CONFIG_VERSION`, `PROFILE_STORE_FORMAT`, and `PROFILE_STORE_VERSION`. A
  profile contains a name, defaults, course color overrides, and section or
  meeting detail overrides. `normalizeProfile()` rejects an unexpected format
  or version, rejects imported `session` and `meetings` data, and reconstructs
  only the permitted fields.
- `normalizeCourseCode()`, `normalizeSection()`, `normalizeHexColor()`, and
  the text normalizers collapse equivalent input forms before storage. The
  implementation enforces limits of 64 characters for profile names, 100 for
  professor names, 24 for course codes, 64 for sections, 160 for titles, and
  120 for rooms. Customization imports are capped at 256 KiB in
  `app.js` before JSON parsing begins.
- `cloneMaps()` makes profile updates copy-on-write across defaults, courses,
  sections, and nested meeting overrides. `setCourseColor()`,
  `setSectionCustomization()`, and `setMeetingCustomization()` therefore
  return new profile values rather than mutating the active object in place.
- `resolveMeetingCustomization()` applies meeting-level values first, section
  values second, and source EAF values last. It separately resolves course
  color, delivery mode, identity, title, professor, room or platform, and
  time. `resolveScheduleEntries()` preserves the source meeting alongside an
  `effective` copy so all consumers can compare or render both views without
  modifying the imported schedule.
- Course colors remain course-wide. An explicit course override wins over the
  profile default. Otherwise the resolver uses the plain palette or assigns a
  deterministic pastel palette by first-seen course order. `randomizeCourseColors()`
  uses a bounded Fisher-Yates shuffle before writing explicit course values.
- A meeting with `automatic` set to true is an explicit restoration state.
  The resolver suppresses section details for that meeting and reads its
  editable values from the EAF source again. This is different from deleting
  an entire section record because a paired section can retain shared values
  for its other meeting.
- The browser store uses `PROFILE_STORAGE_KEY` and adds a protected Default
  profile. `loadProfileStore()` repairs malformed stored state and migrates
  the legacy `animosort_course_colors` key only when a versioned profile store
  does not already exist. `addProfile()` and `renameProfile()` generate unique
  names, while `deleteProfile()` protects the built-in Default profile.

Pair behavior is implemented as explicit state resolution rather than a
boolean synchronization flag.

- `sourceMeetingId()` derives a stable identity from normalized course,
  section, and meeting ordinal values. This lets a profile address one source
  meeting even when its day, time, or room differs from its peer.
- `getPairCustomizationState()` first identifies the meetings with the same
  normalized course and section. It then separates ordinary source EAF
  variation from actionable manual conflicts. A Monday and Thursday source
  pair is therefore not treated as a conflict merely because the receipt
  contains different days.
- `getPairScopeLabel()` exposes the state as This meeting or Paired meetings
  and reports whether the group is linked, an EAF variation, partially
  independent, or in manual conflict. The editor can communicate the actual
  state instead of presenting a misleading sync toggle.
- `applySyncConflictChoice()` implements Cancel, Use pair settings, and Use
  this meeting for both. The latter promotes only the fields in the conflict
  set or the current draft and then clears the corresponding independent
  meeting fields. Unrelated peer values survive the merge.
- `getPairChoiceDraftPatch()` in `app.js` filters the current form to fields
  changed in this edit. This prevents an untouched stale value in the form from
  becoming a new pair-wide override during conflict resolution.
- `readCustomizationPatch()` enforces delivery boundaries. F2F cannot retain
  Online as a physical room. Online cannot accept a value that matches a
  physical room pattern. Switching between F2F and Online clears the old
  location field. Adding a time to an asynchronous row requires an explicit
  delivery mode.
- `validateEffectiveProfile()` resolves the proposed profile, removes
  unresolved meetings from the overlap set, and calls `validateNoOverlaps()`
  before `saveCustomizationDraft()` persists anything. A rejected overlap
  therefore leaves the stored profile and rendered timetable unchanged.

Calendar export is isolated in
[`assets/js/calendar.js`](assets/js/calendar.js) and consumes effective
entries rather than source rows.

- `validateDateRange()` accepts real ISO calendar dates, rejects impossible
  dates and reversed ranges, and returns inclusive start and end dates.
  `getFirstOccurrenceDate()` and `getLastOccurrenceDate()` trim each weekly
  series to the selected range instead of assuming that the term starts on a
  Monday or ends on a Saturday.
- Events use `Asia/Manila` as the calendar timezone. The DTSTART and DTEND
  values preserve the local meeting time. The RRULE UNTIL value is calculated
  from the last local occurrence and converted to UTC, avoiding the common
  one-day or eight-hour boundary error around a Manila term end.
- `resolveCalendarEvent()` calls `resolveMeetingCustomization()` for each
  meeting. It returns null for unresolved asynchronous entries and for
  scheduled entries outside the selected range. It sets physical rooms only
  for F2F events and uses Online as the location for Online events.
- `normalizeHttpUrl()` uses the platform URL parser and allows only HTTP and
  HTTPS protocols. A complete Online URL becomes the event URL and is also
  inserted as a Join link line in the description. A label such as Zoom stays
  text. An unsafe scheme is omitted from both the URL property and the link
  fallback.
- `formatIcsCalendar()` tracks exported, skipped, unresolved, and out-of-range
  counts. It fails with `NO_EVENTS_IN_RANGE` when the selected range would
  produce an empty calendar rather than downloading a misleading blank file.
- `escapeIcsText()` escapes iCalendar control characters. `foldIcsLine()`
  folds at 75 UTF-8 octets and prefixes continuation lines correctly. The
  serializer emits recurring VEVENT records with stable UIDs derived from
  session, meeting identity, range, and index values.
- `downloadCalendarFile()` creates a local `text/calendar` Blob, clicks a
  temporary download link, and revokes the object URL. No Google account API,
  OAuth token, or Google Meet conference object is involved.

The visual exporters share the same effective projection.

- [`assets/js/export.js`](assets/js/export.js) calls `resolveScheduleEntries()`
  before building SVG or PNG output. `formatMeetingMetadataLines()` is shared
  with the live card path, which keeps room, Online, professor, and time line
  order consistent between the browser preview and downloaded image.
- `getTimelineLayout()` derives the visible range from actual effective
  meeting endpoints with 15 minutes of surrounding space. It treats
  `STANDARD_PERIODS` as grid hints and raises the grid height when wrapped
  titles or metadata would not fit in a short meeting block.
- `createScheduleSvg()` emits a 1400 pixel-wide SVG with escaped text, theme
  colors, wrapped titles, day columns, time guides, and a linked footer. The
  PNG path in `downloadSchedulePng()` rasterizes that SVG at a scale of two,
  uses `toBlob()` when available, and falls back to a data URL when necessary.
  The supplied About image is 2800 pixels wide and 2488 pixels high, which is
  consistent with the two-times raster scale and content-driven height.
- [`assets/js/app.js`](assets/js/app.js) owns the state transitions. `handleFile()`
  uses an import generation token to ignore stale asynchronous completions.
  `renderSchedule()` resolves the profile once, renders only scheduled entries
  into the timetable, and sends unresolved entries to the Manual class details
  panel. The calendar dialog validates dates before enabling export and
  reports skipped meeting counts after download.

### Verification matrix

- [`tests/fixtures/comprehensive-eaf/README.md`](tests/fixtures/comprehensive-eaf/README.md)
  documents a deterministic synthetic fixture generated with ReportLab. It
  contains 26 rows and 41 meetings, with 40 scheduled meetings and one
  explicit asynchronous row. The fixture includes paired schedules, source
  day and time variation, online and hybrid delivery, single-day classes, late
  evening intervals, all seven NSTP form codes, and eight Laguna room samples
  covering `MM101`, `MM-BLACKBOX`, `MRR101`, `UH208`, `EKR101`, `RL101`, `LC1`,
  and `LC2`.
- [`tests/comprehensive-eaf.test.mjs`](tests/comprehensive-eaf.test.mjs)
  imports the generated PDF through `parseEafFile()` instead of testing a
  hand-built object. It checks session extraction, all 26 rows, all 41
  meetings, building normalization, asynchronous null fields, distinct NSTP
  codes, and the no-overlap invariant.
- [`tests/customization.test.mjs`](tests/customization.test.mjs),
  [`tests/app-controller.test.mjs`](tests/app-controller.test.mjs), and
  [`tests/calendar.test.mjs`](tests/calendar.test.mjs) cover copy-on-write
  profile updates, import and legacy migration, hex normalization, pair
  state, automatic restoration, conflict winners, manual async slots, date
  boundaries, Manila recurrence, URL serialization, unsafe URL rejection,
  escaping, and UTF-8 line folding.
- [`tests/browser_acceptance.py`](tests/browser_acceptance.py) exercises the
  actual static site through Playwright. The suite covers fixture import,
  manual async completion, paired EAF variation, conflict cancellation and
  winner choices, F2F and Online mode boundaries, calendar and PNG downloads,
  the About output image, five clickable How to use figures, responsive focus
  behavior, no horizontal overflow, and reduced-motion behavior across 320,
  390, 480, 768, 1024, and 1440 pixel viewports.
- The release-preparation run completed with 62 passing Node tests and eight
  passing browser acceptance checks. The repository hygiene scan passed after
  retaining five previously reviewed CE002 findings for existing CSS section
  labels. The binary PDF fixture is excluded from text whitespace inspection
  because its internal stream contains intentional trailing byte content.

### Boundaries and disclosure

- The parser accepts the official Archershub EAF shape supported by the
  project. Files from legacy Animo.sys are outside this release boundary, and
  a PDF larger than 1 MiB is rejected by the application before parsing.
- A room prefix absent from `BUILDING_NAMES` remains the source text. The
  resolver does not infer a building from an unfamiliar code.
- A PNG is a static raster image. It cannot carry a clickable meeting link.
  Link transport is available only through the calendar export, and the
  receiving calendar application controls whether it renders a clickable URL
  or a native join affordance.
- The About-page output now uses the supplied
  `assets/images/animosort-schedule-export.png`. Its course, day, time, and
  room layout follows the Term 3 sample, while professor names such as the
  Avengers characters are fictional presentation values. They are not DLSU
  faculty data and must not be read as enrollment evidence.
- Profile state remains browser-local. A downloaded profile can contain
  manually entered class details and meeting links, but it does not contain
  the imported EAF, session, or source meeting records.

## v0.4.3 - 2026-09-01

This release stabilizes mobile viewport layouts, resolves WebKit dropdown
popover detachment on iOS Safari, and refines the landing page reading flow.

### Custom select dropdowns and WebKit popover fix

- Replaced native select controls for Active profile and PNG export theme with
  accessible, DOM-rendered custom dropdown menus using details and summary
  elements. This resolves WebKit popover coordinate misalignment on iOS Safari
  when opening controls inside dynamically unhidden drawer containers.
- Retained underlying hidden select elements in the DOM for automated tests and
  form compatibility while presenting styled options with active indicators and
  checkmarks.
- Added global outside-click dismissal and animated chevron rotation across all
  custom select components.

### Hero reading flow and navigation alignment

- Moved the About and architecture links directly inside the product intro
  block below the subtitle and above the upload form, consolidating the pitch
  and documentation entry points into a single cohesive reading column.
- Updated grid template areas across desktop and mobile layouts so the hero text
  hierarchy renders consistently without awkward vertical whitespace.

### Mobile customization drawer and touch targets

- Structured customization action buttons into a responsive two-column grid on
  narrow viewports with 44px minimum tap targets complying with Apple HIG.
- Placed the primary Download JSON action as a prominent full-width button at
  the top of the action grid.
- Resolved excessive vertical spacing caused by desktop flex-basis rules
  operating along the column orientation on mobile screens.
- Suppressed empty status and feedback regions to eliminate phantom vertical
  padding.

### Viewport bounds and layout containment

- Enforced strict horizontal overflow constraints on root document and shell
  elements to prevent the 1096px timetable canvas from expanding the mobile
  viewport layout box.
- Constrained the preview canvas bounding box during timetable scaling to ensure
  touch coordinates remain accurate.
- Switched customization drawer scroll alignment to instant behavior to avoid
  touch coordinate lag during animated transitions.

### Guide and documentation polish

- Streamlined task-based guidance in the How to Use guide for importing,
  profile management, and calendar export workflows.

## v0.4.0 - 2026-08-31

This release adds a private, browser-local customization workflow, a manual
Google Calendar handoff, a clearer import and About experience, responsive
navigation, and a reviewable Archify pipeline diagram. It also finishes the
diagram's light and dark Editorial themes, readable menu surfaces, and looping
trace animation.

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
  export metadata tests. See the [customization guide on the website](https://animosort.netlify.app/how-to-use.html#customization-profiles)
  or the [guide source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/how-to-use.html)
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
  The [calendar handoff guide on the website](https://animosort.netlify.app/how-to-use.html#google-calendar)
  and its [guide source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/how-to-use.html)
  explain what an `.ics` file is, how to import it into Google Calendar, and
  why importing works best on a computer.

### About page, source receipts, and import clarity

- Moved the landing-page pitch into a dedicated, full-width [About page on the website](https://animosort.netlify.app/about),
  with the [page source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/about.html),
  keeping the main page focused on importing an EAF and viewing a timetable.
- Added a responsive before/after story using the supplied Archershub Schedule
  screenshot. The source receipt and generated AnimoSort output are clickable
  and expandable so the evidence can be inspected without permanently taking
  over the page.
- Updated the after image with the supplied AY 2025-2026 Term 3 output and
  synchronized the hypothetical Archershub rows with its 8 courses, 15
  meetings, and non-chronological received order.
- Added import guidance that explains the supported official Archershub EAF,
  local-only processing, and the file-size/format constraints.
- Replaced the generic import loading treatment with an accessible progress bar
  that advances through the actual parser stages, while keeping the dropzone as
  the primary upload surface.

### Navigation and discoverability

- Added shared responsive navigation with a mobile hamburger menu, outside-click
  and Escape dismissal, and automatic close after navigation.
- Added clear About and How to use entry points in the header, footer, and hero.
  The main page now exposes [See how the code works on the website](https://animosort.netlify.app/about#pipeline), with the
  [home-page source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/index.html), and reader-facing links use green
  underlines/highlights so they are discoverable without overpowering the
  interface.
- Added the persistent, subtle “Click to learn more” nudge while the About CTA
  is visible, with reduced-motion behavior for users who request less motion.
- Kept GitHub as the source/audit destination while removing the redundant
  question-mark icon from the mobile menu.

### Interactive Archify pipeline

- Added a responsive architecture reference at [About → How the code works on the website](https://animosort.netlify.app/about#pipeline),
  with the [About-page source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/about.html), rendered with
  [Archify](https://github.com/tt-a1i/archify). Desktop and narrow screens use
  separate generated viewers so the pipeline remains readable at both widths.
- Added light/dark viewer synchronization with the site theme and a direct
  full-view link. The diagram names the actual browser-side modules and
  functions, including `initApp`, `parseEafFile`, `parseScheduleRows`,
  `renderSchedule`, `downloadCustomization`, `downloadSchedulePng`, and
  `formatIcsCalendar`.
- Added the generated [desktop viewer on the website](https://animosort.netlify.app/assets/animosort-workflow.html)
  with its [HTML source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/assets/animosort-workflow.html),
  and the [mobile viewer on the website](https://animosort.netlify.app/assets/animosort-workflow-mobile.html)
  with its [HTML source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/assets/animosort-workflow-mobile.html).
  Their companion [desktop workflow specification on the website](https://animosort.netlify.app/assets/animosort-workflow.workflow.json)
  and [mobile workflow specification on the website](https://animosort.netlify.app/assets/animosort-workflow-mobile.workflow.json)
  have matching [desktop JSON source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/assets/animosort-workflow.workflow.json)
  and [mobile JSON source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/assets/animosort-workflow-mobile.workflow.json).
  Archify is used to generate the reviewable artifacts; it is not added as a
  runtime dependency of the app.
- Linked the pipeline from the main page and documented the artifacts and
  regeneration boundary in the [pipeline page on the website](https://animosort.netlify.app/about#pipeline)
  and the [README source on GitHub](https://github.com/sakudiff/Animo-Sort/blob/main/README.md#interactive-pipeline-diagram).

### Release commit ledger

The following commits were audited from the v0.3.0 tag through the current
v0.4.0 release candidate. The release-polish commits are already described in the v0.3.0
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

Work included in v0.4.0:

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
- [`dc52453`](https://github.com/sakudiff/Animo-Sort/commit/dc52453) — integrate
  portable profiles, calendar export, and the site guide.
- [`5401fb1`](https://github.com/sakudiff/Animo-Sort/commit/5401fb1) — refresh
  the README with current product screenshots.
- [`e6dba35`](https://github.com/sakudiff/Animo-Sort/commit/e6dba35) — improve
  Archify theme contrast and loop the pipeline trace animation.

#### Verification

- The audited commit range contains no dependency or server-side data path for
  EAF processing; parsing and export remain browser-local.
- `npm test` passes all 29 tests. JavaScript syntax checks and `git diff --check`
  also pass.
- Playwright checks pass at 390px and 1440px for the home, About, and How to use
  pages, including the hamburger menu, GitHub icon, Archify section, links,
  horizontal-overflow guard, looping animation, and hover pause/resume behavior.

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
