// AnimoSort application shell. Owns in-memory schedule state and UI wiring.
// Imports only the sanitized Schedule produced by eaf-parser.js.

import {
  EafParseError,
  DAY_ORDER,
  STANDARD_PERIODS,
  expandLocation,
} from './eaf-parser.js';
import { downloadSchedulePng } from './export.js';

const MAX_EAF_FILE_SIZE = 1024 * 1024;

let currentSchedule = null;
let importInProgress = false;
let importGeneration = 0;
let activeImportGeneration = null;
let showCourseTitles = true;

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
  scheduleCanvas: null,
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
    scheduleCanvas: 'schedule-canvas',
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
  els.schedulePanel.hidden = true;
  els.emptyState.hidden = true;
  els.sessionLabel.textContent = '';
  els.summaryLabel.textContent = '';
  els.scheduleCanvas.replaceChildren();
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
  const baseHeight = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--day-body-height'));
  let bodyHeight = Number.isFinite(baseHeight) ? baseHeight : 900;

  for (const { block, duration } of meetingBlocks) {
    const contentHeight = block.scrollHeight + (block.offsetHeight - block.clientHeight) + 2;
    bodyHeight = Math.max(bodyHeight, (contentHeight * span) / duration);
  }
  canvas.style.setProperty('--day-body-height', `${Math.ceil(bodyHeight)}px`);
}

function createDayGridline(minutes, canvasStart, pixelsPerMinute, kind) {
  const line = document.createElement('div');
  line.className = `day-gridline ${kind}`;
  line.style.top = `${meetingTop({ startMinutes: minutes }, canvasStart, pixelsPerMinute)}%`;
  return line;
}

export function renderSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule.meetings)) {
    throw new Error('Invalid schedule passed to renderSchedule');
  }
  els.scheduleCanvas.replaceChildren();

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
        const block = document.createElement('div');
        block.className = 'meeting-block';
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
        const primary = document.createElement('div');
        primary.className = 'meeting-primary';
        primary.append(codeGroup);
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
    setStatus('This PDF is larger than 1 MiB. Choose an ArcherHub EAF PDF under 1 MiB.', 'error');
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
      setStatus('Something went wrong while reading the file. Please try again with the original ArcherHub EAF PDF.', 'error');
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
  initNavigation();
  initSmoothScroll();
  initReveal();
  requireElements();

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
  els.showCourseTitles.addEventListener('change', () => {
    showCourseTitles = els.showCourseTitles.checked;
    if (currentSchedule) renderSchedule(currentSchedule);
  });
  els.downloadPngBtn.addEventListener('click', () => {
    if (currentSchedule) {
      downloadSchedulePng(currentSchedule, { showCourseTitles }).catch(() => {
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
