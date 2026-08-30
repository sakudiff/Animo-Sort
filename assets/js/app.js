// AnimoSort application shell. Owns in-memory schedule state and UI wiring.
// Imports only the sanitized Schedule produced by eaf-parser.js.

import {
  EafParseError,
  DAY_ORDER,
  STANDARD_PERIODS,
  expandLocation,
} from './eaf-parser.js';
import {
  COURSE_PALETTES,
  buildCourseColorMap,
  getPaletteById,
  downloadSchedulePng,
} from './export.js';

const MAX_EAF_FILE_SIZE = 1024 * 1024;

let currentSchedule = null;
let importInProgress = false;
let importGeneration = 0;
let activeImportGeneration = null;
let showCourseTitles = true;
let customCourseColors = loadCustomCourseColors();
let activePopover = null;

function loadCustomCourseColors() {
  try {
    const raw = localStorage.getItem('animosort_course_colors');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCustomCourseColor(courseCode, paletteId) {
  customCourseColors[courseCode] = paletteId;
  try {
    localStorage.setItem('animosort_course_colors', JSON.stringify(customCourseColors));
  } catch (e) {}
}

function closeActivePopover() {
  if (activePopover) {
    activePopover.element.remove();
    activePopover = null;
  }
}

function setCourseLegendOpen(isOpen) {
  if (!els.courseLegend || !els.courseLegendToggle) return;
  els.courseLegend.classList.toggle('is-open', isOpen);
  els.courseLegendToggle.setAttribute('aria-expanded', String(isOpen));
}

function initCourseLegendToggle() {
  const mobileQuery = window.matchMedia('(max-width: 480px)');
  const sync = () => setCourseLegendOpen(!mobileQuery.matches);

  els.courseLegendToggle.addEventListener('click', () => {
    const isOpen = !els.courseLegend.classList.contains('is-open');
    setCourseLegendOpen(isOpen);
  });

  sync();
  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', sync);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(sync);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    if (!activePopover) return;
    if (!activePopover.element.contains(event.target) && !activePopover.anchor.contains(event.target)) {
      closeActivePopover();
    }
  });

  window.addEventListener('resize', () => {
    closeActivePopover();
    fitTimetablePreview();
  }, { passive: true });
}

function updateCourseCardsLive(courseCode, paletteOrHex) {
  const palette = getPaletteById(paletteOrHex);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const colors = isDark ? palette.dark : palette.light;

  document.querySelectorAll(`.meeting-block[data-course="${courseCode}"]`).forEach((block) => {
    for (const p of COURSE_PALETTES) {
      block.classList.remove(`palette-${p.id}`);
    }
    if (!palette.isCustom) {
      block.classList.add(`palette-${palette.id}`);
    }
    block.style.setProperty('--card-bg', colors.bg);
    block.style.setProperty('--card-border', colors.border);
    block.style.setProperty('--card-code', colors.code);
    block.style.setProperty('--card-title', colors.title);
    block.style.setProperty('--card-meta', colors.meta);
    block.style.setProperty('--card-swatch', palette.swatch);

    const btn = block.querySelector('.meeting-color-btn');
    if (btn) btn.style.background = palette.swatch;
  });

  if (els.legendBadges) {
    els.legendBadges.querySelectorAll('.course-badge').forEach((badge) => {
      const codeSpan = badge.querySelector('.course-badge-code');
      if (codeSpan && codeSpan.textContent === courseCode) {
        for (const p of COURSE_PALETTES) {
          badge.classList.remove(`palette-${p.id}`);
        }
        if (!palette.isCustom) {
          badge.classList.add(`palette-${palette.id}`);
        }
        badge.style.setProperty('--card-border', colors.border);
        badge.style.setProperty('--card-code', colors.code);
        badge.style.setProperty('--card-swatch', palette.swatch);
        const swatch = badge.querySelector('.course-badge-swatch');
        if (swatch) swatch.style.background = palette.swatch;
      }
    });
  }
}

function openPalettePopover(anchor, courseCode, currentPaletteId) {
  if (activePopover && activePopover.anchor === anchor) {
    closeActivePopover();
    return;
  }
  closeActivePopover();

  const popover = document.createElement('div');
  popover.className = 'palette-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', `Choose color for ${courseCode}`);

  const popoverHeader = document.createElement('div');
  popoverHeader.className = 'popover-header';
  popoverHeader.textContent = `Color for ${courseCode}`;
  popover.appendChild(popoverHeader);

  // 1. Plain (Minimal) option
  const plainBtn = document.createElement('button');
  plainBtn.type = 'button';
  plainBtn.className = `palette-plain-btn${currentPaletteId === 'plain' ? ' active' : ''}`;
  plainBtn.innerHTML = `<span class="plain-swatch"></span><span>Plain / Neutral</span>`;
  plainBtn.title = 'Plain minimal style with no pastel tint';
  plainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    saveCustomCourseColor(courseCode, 'plain');
    updateCourseCardsLive(courseCode, 'plain');
    closeActivePopover();
  });
  popover.appendChild(plainBtn);

  // 2. Pastel presets grid
  const grid = document.createElement('div');
  grid.className = 'palette-presets-grid';
  for (const palette of COURSE_PALETTES.slice(1)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `palette-option-btn${palette.id === currentPaletteId ? ' active' : ''}`;
    btn.style.background = palette.swatch;
    btn.title = palette.name;
    btn.setAttribute('aria-label', palette.name);

    if (palette.id === currentPaletteId) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveCustomCourseColor(courseCode, palette.id);
      updateCourseCardsLive(courseCode, palette.id);
      closeActivePopover();
    });

    grid.appendChild(btn);
  }
  popover.appendChild(grid);

  // 3. Hex code & native color picker form
  const hexForm = document.createElement('form');
  hexForm.className = 'palette-hex-form';
  hexForm.setAttribute('action', 'javascript:void(0);');

  const initialHex = typeof currentPaletteId === 'string' && currentPaletteId.startsWith('#')
    ? currentPaletteId
    : (COURSE_PALETTES.find((p) => p.id === currentPaletteId)?.swatch || '#52796f');

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'palette-color-input';
  colorInput.value = initialHex.length === 7 ? initialHex : '#52796f';
  colorInput.title = 'Open system color picker';

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'palette-hex-input';
  hexInput.placeholder = '#HEX';
  hexInput.maxLength = 7;
  hexInput.spellcheck = false;
  hexInput.value = initialHex.toUpperCase();
  hexInput.setAttribute('aria-label', `Hex code for ${courseCode}`);

  const applyBtn = document.createElement('button');
  applyBtn.type = 'submit';
  applyBtn.className = 'palette-hex-apply-btn';
  applyBtn.textContent = 'Set';
  applyBtn.title = 'Apply hex code';

  const parseAndNormalizeHex = (val) => {
    let clean = String(val || '').trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean.toLowerCase();
    if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
      const r = clean[1];
      const g = clean[2];
      const b = clean[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return null;
  };

  colorInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    hexInput.value = val.toUpperCase();
    hexInput.classList.remove('invalid');
    saveCustomCourseColor(courseCode, val);
    updateCourseCardsLive(courseCode, val);
  });

  colorInput.addEventListener('change', (e) => {
    const val = e.target.value.toLowerCase();
    hexInput.value = val.toUpperCase();
    hexInput.classList.remove('invalid');
    saveCustomCourseColor(courseCode, val);
    updateCourseCardsLive(courseCode, val);
  });

  hexInput.addEventListener('input', (e) => {
    const valid = parseAndNormalizeHex(e.target.value);
    if (valid) {
      colorInput.value = valid;
      hexInput.classList.remove('invalid');
      saveCustomCourseColor(courseCode, valid);
      updateCourseCardsLive(courseCode, valid);
    }
  });

  hexForm.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const valid = parseAndNormalizeHex(hexInput.value);
    if (valid) {
      saveCustomCourseColor(courseCode, valid);
      updateCourseCardsLive(courseCode, valid);
      closeActivePopover();
    } else {
      hexInput.classList.add('invalid');
      hexInput.focus();
    }
  });

  hexForm.append(colorInput, hexInput, applyBtn);
  popover.appendChild(hexForm);

  document.body.appendChild(popover);

  const rect = anchor.getBoundingClientRect();
  const popoverWidth = 180;
  let left = rect.left + window.scrollX + (rect.width / 2) - (popoverWidth / 2);
  if (left < 10) left = 10;
  if (left + popoverWidth > window.innerWidth - 10) left = window.innerWidth - popoverWidth - 10;
  const top = rect.bottom + window.scrollY + 6;

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;

  activePopover = { element: popover, anchor };
}

function initNavigation() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

function initSmoothScroll() {
  const getScrollBehavior = () => (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  );

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (href === '#') {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: getScrollBehavior() });
        return;
      }
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: getScrollBehavior() });
      }
    });
  });
}

function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const toggleText = document.getElementById('theme-toggle-text');

  function updateToggleUI(theme) {
    const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (toggleText) {
      toggleText.textContent = isDark ? 'Light' : 'Dark';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      toggleBtn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  const savedTheme = localStorage.getItem('animosort_theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  updateToggleUI(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const currentlyDark = activeTheme ? activeTheme === 'dark' : isSystemDark;
      const nextTheme = currentlyDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('animosort_theme', nextTheme);
      updateToggleUI(nextTheme);
    });
  }

  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem('animosort_theme')) {
        updateToggleUI(e.matches ? 'dark' : 'light');
      }
    });
  }
}

function initReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealEls.forEach((el) => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach((el) => observer.observe(el));
}

const DAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday' };

const els = {
  form: null,
  fileInput: null,
  browseBtn: null,
  dropZone: null,
  statusRegion: null,
  schedulePanel: null,
  emptyState: null,
  sessionLabel: null,
  summaryLabel: null,
  scheduleScroll: null,
  scheduleCanvas: null,
  courseLegend: null,
  courseLegendToggle: null,
  legendBadges: null,
  randomizeColorsBtn: null,
  clearColorsBtn: null,
  replaceBtn: null,
  clearBtn: null,
  downloadPngBtn: null,
  showCourseTitles: null,
};

function requireElements() {
  const ids = {
    form: 'eaf-form',
    fileInput: 'eaf-file',
    browseBtn: 'browse-btn',
    dropZone: 'drop-zone',
    statusRegion: 'status-region',
    schedulePanel: 'schedule-panel',
    emptyState: 'empty-state',
    sessionLabel: 'session-label',
    summaryLabel: 'summary-label',
    scheduleScroll: 'schedule-scroll',
    scheduleCanvas: 'schedule-canvas',
    courseLegend: 'course-legend',
    courseLegendToggle: 'course-legend-toggle',
    legendBadges: 'legend-badges',
    randomizeColorsBtn: 'randomize-colors-btn',
    clearColorsBtn: 'clear-colors-btn',
    replaceBtn: 'replace-btn',
    clearBtn: 'clear-btn',
    downloadPngBtn: 'download-png-btn',
    showCourseTitles: 'show-course-titles',
  };
  for (const [key, id] of Object.entries(ids)) {
    const node = document.getElementById(id);
    if (!node) {
      throw new Error(`AnimoSort failed to start: missing #${id}`);
    }
    els[key] = node;
  }
}

function formatRoomLabel(meeting) {
  const location = meeting.expandedLocation || expandLocation(meeting.location) || meeting.location;
  return `Room: ${location}`;
}

export function formatMeetingDetails(meeting) {
  const parts = [
    meeting.courseCode,
    `Section ${meeting.section}`,
    meeting.title,
    `Time: ${DAY_LABELS[meeting.day] || meeting.day} ${meeting.startLabel} - ${meeting.endLabel}`,
    formatRoomLabel(meeting),
  ];
  return parts.join(', ');
}

function formatTimeLabel(minutes) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
}

function setStatus(message, kind = '') {
  els.statusRegion.textContent = message;
  els.statusRegion.className = `status-region${kind ? ` ${kind}` : ''}`;
  if (kind === 'error') {
    els.statusRegion.setAttribute('role', 'alert');
  } else {
    els.statusRegion.setAttribute('role', 'status');
  }
}

function setImporting(isImporting) {
  importInProgress = isImporting;
  els.fileInput.disabled = isImporting;
  els.browseBtn.disabled = isImporting;
  els.replaceBtn.disabled = isImporting;
  els.dropZone.setAttribute('aria-disabled', String(isImporting));
  els.dropZone.setAttribute('tabindex', isImporting ? '-1' : '0');
  if (isImporting) els.dropZone.classList.remove('drop-active');
}

export function renderEmptyState() {
  closeActivePopover();
  els.schedulePanel.hidden = true;
  els.emptyState.hidden = true;
  els.sessionLabel.textContent = '';
  els.summaryLabel.textContent = '';
  els.scheduleCanvas.style.removeProperty('height');
  els.scheduleCanvas.replaceChildren();
  if (els.legendBadges) els.legendBadges.replaceChildren();
  setStatus('');
}

function meetingTop(meeting, canvasStart, pixelsPerMinute) {
  return ((meeting.startMinutes - canvasStart) / pixelsPerMinute) * 100;
}

function meetingHeight(meeting, pixelsPerMinute) {
  return ((meeting.endMinutes - meeting.startMinutes) / pixelsPerMinute) * 100;
}

function createGuideEntries(guides) {
  const starts = new Set(guides.map(([start]) => start));
  const entries = new Map();
  for (const [start, end] of guides) {
    if (!entries.has(start)) entries.set(start, { minutes: start, kind: 'major', labelKind: 'start' });
    if (!starts.has(end) && !entries.has(end)) entries.set(end, { minutes: end, kind: 'minor', labelKind: 'end' });
  }
  return [...entries.values()].sort((a, b) => a.minutes - b.minutes);
}

function fitScheduleBody(canvas, meetingBlocks, span) {
  const baseHeight = 1050;
  let bodyHeight = baseHeight;

  for (const { block, duration } of meetingBlocks) {
    const contentHeight = block.scrollHeight + (block.offsetHeight - block.clientHeight) + 14;
    bodyHeight = Math.max(bodyHeight, (contentHeight * span) / duration);
  }
  canvas.style.setProperty('--day-body-height', `${Math.ceil(bodyHeight)}px`);
}

function fitTimetablePreview(timetable = els.scheduleCanvas?.querySelector('.timetable')) {
  if (!els.scheduleCanvas || !els.scheduleScroll) return;
  if (!timetable) {
    els.scheduleCanvas.style.removeProperty('height');
    els.scheduleScroll.classList.remove('is-scaled');
    return;
  }

  timetable.style.removeProperty('width');
  timetable.style.removeProperty('transform');
  els.scheduleCanvas.style.removeProperty('height');
  els.scheduleScroll.classList.remove('is-scaled');

  const availableWidth = els.scheduleScroll.clientWidth;
  const naturalWidth = Math.max(timetable.offsetWidth, timetable.scrollWidth);
  const naturalHeight = timetable.offsetHeight;
  if (!availableWidth || !naturalWidth || !naturalHeight) return;

  const scale = Math.min(1, availableWidth / naturalWidth);
  if (scale >= 1) return;

  timetable.style.width = `${naturalWidth}px`;
  const scaledNaturalHeight = timetable.offsetHeight;
  timetable.style.transform = `scale(${scale})`;
  els.scheduleCanvas.style.height = `${Math.ceil(scaledNaturalHeight * scale)}px`;
  els.scheduleScroll.classList.add('is-scaled');
}

function createDayGridline(minutes, canvasStart, pixelsPerMinute, kind) {
  const line = document.createElement('div');
  line.className = `day-gridline ${kind}`;
  line.style.top = `${meetingTop({ startMinutes: minutes }, canvasStart, pixelsPerMinute)}%`;
  return line;
}

function renderCourseLegend(schedule, courseColorMap) {
  if (!els.legendBadges) return;
  els.legendBadges.replaceChildren();

  const distinctCourses = [...new Set(schedule.meetings.map((m) => m.courseCode))];
  if (!distinctCourses.length) {
    if (els.courseLegend) els.courseLegend.hidden = true;
    return;
  }
  if (els.courseLegend) els.courseLegend.hidden = false;

  for (const code of distinctCourses) {
    const meeting = schedule.meetings.find((m) => m.courseCode === code);
    const palette = courseColorMap[code] || COURSE_PALETTES[0];

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = `course-badge${palette.isCustom ? '' : ` palette-${palette.id}`}`;
    badge.setAttribute('aria-label', `Change color for ${code}`);
    badge.title = `Click dot to change color for ${code} (${palette.name})`;

    if (palette.isCustom) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const colors = isDark ? palette.dark : palette.light;
      badge.style.setProperty('--card-border', colors.border);
      badge.style.setProperty('--card-code', colors.code);
      badge.style.setProperty('--card-swatch', palette.swatch);
    }

    const swatch = document.createElement('span');
    swatch.className = 'course-badge-swatch';
    swatch.style.background = palette.swatch;

    const codeSpan = document.createElement('span');
    codeSpan.className = 'course-badge-code';
    codeSpan.textContent = code;

    const sectionSpan = document.createElement('span');
    sectionSpan.className = 'course-badge-section';
    sectionSpan.textContent = meeting ? meeting.section : '';

    badge.append(swatch, codeSpan, sectionSpan);

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      openPalettePopover(badge, code, palette.id || palette.swatch);
    });

    els.legendBadges.appendChild(badge);
  }
}

export function renderSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule.meetings)) {
    throw new Error('Invalid schedule passed to renderSchedule');
  }
  closeActivePopover();
  els.scheduleCanvas.replaceChildren();

  const courseColorMap = buildCourseColorMap(schedule, customCourseColors);
  renderCourseLegend(schedule, courseColorMap);

  const allMinutes = schedule.meetings.flatMap((m) => [m.startMinutes, m.endMinutes]);
  const canvasStart = Math.min(...allMinutes) - 15;
  const canvasEnd = Math.max(...allMinutes) + 15;
  const span = canvasEnd - canvasStart;
  const pixelsPerMinute = span > 0 ? span : 1;

  const canvas = document.createElement('div');
  canvas.className = 'timetable';
  canvas.setAttribute('role', 'table');
  canvas.setAttribute('aria-label', `Weekly timetable for ${schedule.session}`);

  const timeGutter = document.createElement('div');
  timeGutter.className = 'time-gutter';
  timeGutter.setAttribute('role', 'rowheader');
  canvas.appendChild(timeGutter);

  const guides = [
    ...STANDARD_PERIODS.filter(([s, e]) => s >= canvasStart && e <= canvasEnd),
    ...schedule.meetings.map((m) => [m.startMinutes, m.endMinutes]),
  ];
  const guideEntries = createGuideEntries(guides);
  for (const entry of guideEntries) {
    const guide = document.createElement('div');
    guide.className = `guide-line ${entry.kind}`;
    guide.style.top = `${meetingTop({ startMinutes: entry.minutes }, canvasStart, pixelsPerMinute)}%`;
    const label = document.createElement('span');
    label.className = `guide-label ${entry.labelKind}`;
    label.textContent = formatTimeLabel(entry.minutes);
    guide.appendChild(label);
    timeGutter.appendChild(guide);
  }

  const meetingBlocks = [];
  for (const day of DAY_ORDER) {
    const column = document.createElement('div');
    column.className = 'day-column';
    column.setAttribute('role', 'columnheader');
    column.dataset.day = day;
    const dayLabel = document.createElement('div');
    dayLabel.className = 'day-header';
    dayLabel.textContent = DAY_LABELS[day];
    column.appendChild(dayLabel);

    const body = document.createElement('div');
    body.className = 'day-body';
    for (const entry of guideEntries) {
      body.appendChild(createDayGridline(entry.minutes, canvasStart, pixelsPerMinute, entry.kind));
    }
    const dayMeetings = schedule.meetings.filter((m) => m.day === day);
    if (!dayMeetings.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-day';
      empty.textContent = 'No classes';
      body.appendChild(empty);
    } else {
      for (const meeting of dayMeetings) {
        const palette = courseColorMap[meeting.courseCode] || COURSE_PALETTES[0];
        const block = document.createElement('div');
        block.className = `meeting-block${palette.isCustom ? '' : ` palette-${palette.id}`}`;
        if (palette.isCustom) {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
            (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
          const colors = isDark ? palette.dark : palette.light;
          block.style.setProperty('--card-bg', colors.bg);
          block.style.setProperty('--card-border', colors.border);
          block.style.setProperty('--card-code', colors.code);
          block.style.setProperty('--card-title', colors.title);
          block.style.setProperty('--card-meta', colors.meta);
          block.style.setProperty('--card-swatch', palette.swatch);
        }
        block.style.top = `${meetingTop(meeting, canvasStart, pixelsPerMinute)}%`;
        block.style.height = `${meetingHeight(meeting, pixelsPerMinute)}%`;
        block.setAttribute('role', 'cell');
        block.setAttribute('aria-label', formatMeetingDetails(meeting));
        block.dataset.course = meeting.courseCode;
        block.dataset.day = meeting.day;
        meetingBlocks.push({ block, duration: meeting.endMinutes - meeting.startMinutes });

        const code = document.createElement('strong');
        code.className = 'meeting-code';
        code.textContent = meeting.courseCode;
        const section = document.createElement('span');
        section.className = 'meeting-section';
        section.textContent = meeting.section;
        const codeGroup = document.createElement('span');
        codeGroup.className = 'meeting-code-group';
        codeGroup.append(code, section);

        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'meeting-color-btn';
        colorBtn.style.background = palette.swatch;
        colorBtn.title = `Click dot to change color for ${meeting.courseCode}`;
        colorBtn.setAttribute('aria-label', `Click dot to change color for ${meeting.courseCode}`);
        colorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openPalettePopover(colorBtn, meeting.courseCode, palette.id || palette.swatch);
        });

        const primary = document.createElement('div');
        primary.className = 'meeting-primary';
        primary.append(codeGroup, colorBtn);

        const title = document.createElement('span');
        title.className = 'meeting-title';
        title.textContent = meeting.title;
        const room = document.createElement('span');
        room.className = 'meeting-room';
        room.textContent = formatRoomLabel(meeting);
        const time = document.createElement('span');
        time.className = 'meeting-time';
        time.textContent = `Time: ${meeting.startLabel} - ${meeting.endLabel}`;

        block.append(primary, title, room, time);
        body.appendChild(block);
      }
    }
    column.appendChild(body);
    canvas.appendChild(column);
  }

  canvas.classList.toggle('course-titles-hidden', !showCourseTitles);
  els.scheduleCanvas.replaceChildren(canvas);
  fitScheduleBody(canvas, meetingBlocks, span);
  fitTimetablePreview(canvas);

  els.sessionLabel.textContent = schedule.session;
  const courseCount = new Set(schedule.meetings.map((m) => m.courseCode)).size;
  els.summaryLabel.textContent = `${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${schedule.meetings.length} ${schedule.meetings.length === 1 ? 'meeting' : 'meetings'}`;
}

export function replaceSchedule(schedule) {
  currentSchedule = schedule;
  els.emptyState.hidden = true;
  els.schedulePanel.hidden = false;
  const scheduleCard = els.schedulePanel.querySelector('.reveal');
  if (scheduleCard) scheduleCard.classList.add('visible');
  renderSchedule(schedule);
  setStatus('');
}

export function clearSchedule() {
  importGeneration += 1;
  currentSchedule = null;
  showCourseTitles = true;
  els.showCourseTitles.checked = true;
  els.fileInput.value = '';
  els.dropZone.classList.remove('drop-active');
  renderEmptyState();
}

export async function handleFile(file) {
  if (!file || importInProgress) return;
  if (file.size > MAX_EAF_FILE_SIZE) {
    els.fileInput.value = '';
    setStatus('This PDF is larger than 1 MiB. Choose an Archershub EAF PDF under 1 MiB.', 'error');
    return;
  }
  const generation = ++importGeneration;
  activeImportGeneration = generation;
  setImporting(true);
  setStatus('Reading EAF locally…');
  try {
    const schedule = await import('./eaf-parser.js').then((m) => m.parseEafFile(file));
    if (generation !== importGeneration) return;
    replaceSchedule(schedule);
    const courseCount = new Set(schedule.meetings.map((m) => m.courseCode)).size;
    setStatus(`Loaded ${schedule.session} · ${courseCount} ${courseCount === 1 ? 'course' : 'courses'} loaded locally.`);
  } catch (err) {
    if (generation !== importGeneration) return;
    if (err instanceof EafParseError) {
      setStatus(err.message, 'error');
    } else {
      setStatus('Something went wrong while reading the file. Please try again with the original Archershub EAF PDF.', 'error');
    }
  } finally {
    if (activeImportGeneration === generation) {
      activeImportGeneration = null;
      els.fileInput.value = '';
      setImporting(false);
    }
  }
}

export function initApp() {
  initTheme();
  initNavigation();
  initSmoothScroll();
  initReveal();
  requireElements();
  initCourseLegendToggle();

  els.form.addEventListener('submit', (event) => event.preventDefault());
  els.fileInput.addEventListener('change', () => {
    if (els.fileInput.files && els.fileInput.files[0]) {
      handleFile(els.fileInput.files[0]);
    }
  });
  els.browseBtn.addEventListener('click', () => {
    if (!importInProgress) els.fileInput.click();
  });

  const prevent = (event) => event.preventDefault();
  els.dropZone.addEventListener('dragover', (event) => {
    if (importInProgress) return;
    prevent(event);
    els.dropZone.classList.add('drop-active');
  });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drop-active'));
  els.dropZone.addEventListener('drop', (event) => {
    prevent(event);
    els.dropZone.classList.remove('drop-active');
    if (importInProgress) return;
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  els.dropZone.addEventListener('click', () => {
    if (!importInProgress) els.fileInput.click();
  });
  els.dropZone.addEventListener('keydown', (event) => {
    if (importInProgress) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      els.fileInput.click();
    }
  });

  els.replaceBtn.addEventListener('click', () => {
    if (!importInProgress) els.fileInput.click();
  });
  els.clearBtn.addEventListener('click', clearSchedule);

  if (els.randomizeColorsBtn) {
    els.randomizeColorsBtn.addEventListener('click', () => {
      if (!currentSchedule || !Array.isArray(currentSchedule.meetings)) return;
      const distinctCourses = [...new Set(currentSchedule.meetings.map((m) => m.courseCode))];
      const pastelIds = COURSE_PALETTES.slice(1).map((p) => p.id);
      const shuffled = [...pastelIds].sort(() => Math.random() - 0.5);
      distinctCourses.forEach((code, index) => {
        customCourseColors[code] = shuffled[index % shuffled.length];
      });
      try {
        localStorage.setItem('animosort_course_colors', JSON.stringify(customCourseColors));
      } catch (e) {}
      renderSchedule(currentSchedule);
    });
  }

  if (els.clearColorsBtn) {
    els.clearColorsBtn.addEventListener('click', () => {
      if (!currentSchedule || !Array.isArray(currentSchedule.meetings)) return;
      const distinctCourses = [...new Set(currentSchedule.meetings.map((m) => m.courseCode))];
      distinctCourses.forEach((code) => {
        customCourseColors[code] = 'plain';
      });
      try {
        localStorage.setItem('animosort_course_colors', JSON.stringify(customCourseColors));
      } catch (e) {}
      renderSchedule(currentSchedule);
    });
  }

  els.showCourseTitles.addEventListener('change', () => {
    showCourseTitles = els.showCourseTitles.checked;
    if (currentSchedule) renderSchedule(currentSchedule);
  });
  els.downloadPngBtn.addEventListener('click', () => {
    if (currentSchedule) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const courseColorMap = buildCourseColorMap(currentSchedule, customCourseColors);
      downloadSchedulePng(currentSchedule, {
        showCourseTitles,
        courseColors: courseColorMap,
        theme: isDark ? 'dark' : 'light',
      }).catch(() => {
        setStatus('The PNG could not be generated. Please try again.', 'error');
      });
    }
  });

  renderEmptyState();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
  } else {
    initApp();
  }
}
