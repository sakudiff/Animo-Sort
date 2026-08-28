// Animo Sort application shell. Owns in-memory schedule state and UI wiring.
// Imports only the sanitized Schedule produced by eaf-parser.js.

import { EafParseError, DAY_ORDER, STANDARD_PERIODS } from './eaf-parser.js';
import { printSchedule, downloadSchedulePng } from './export.js';

let currentSchedule = null;

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
  printBtn: null,
  downloadPngBtn: null,
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
    printBtn: 'print-btn',
    downloadPngBtn: 'download-png-btn',
  };
  for (const [key, id] of Object.entries(ids)) {
    const node = document.getElementById(id);
    if (!node) {
      throw new Error(`Animo Sort failed to start: missing #${id}`);
    }
    els[key] = node;
  }
}

export function formatMeetingDetails(meeting) {
  const parts = [
    meeting.courseCode,
    meeting.title,
    `Section ${meeting.section}`,
    `${meeting.credits} credits`,
    `${DAY_LABELS[meeting.day] || meeting.day} ${meeting.startLabel}-${meeting.endLabel}`,
    meeting.location,
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
  els.fileInput.disabled = isImporting;
  els.browseBtn.disabled = isImporting;
  els.dropZone.setAttribute('aria-disabled', String(isImporting));
}

export function renderEmptyState() {
  els.schedulePanel.hidden = true;
  els.emptyState.hidden = false;
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

  const guides = STANDARD_PERIODS.filter(([s, e]) => s >= canvasStart && e <= canvasEnd);
  for (const [startMinutes] of guides) {
    const guide = document.createElement('div');
    guide.className = 'guide-line';
    guide.style.top = `${meetingTop({ startMinutes, endMinutes: startMinutes }, canvasStart, pixelsPerMinute)}%`;
    const label = document.createElement('span');
    label.className = 'guide-label';
    label.textContent = formatTimeLabel(startMinutes);
    guide.appendChild(label);
    timeGutter.appendChild(guide);
  }

  const dayColumns = [];
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

        const code = document.createElement('strong');
        code.className = 'meeting-code';
        code.textContent = meeting.courseCode;
        const title = document.createElement('span');
        title.className = 'meeting-title';
        title.textContent = meeting.title;
        const meta = document.createElement('span');
        meta.className = 'meeting-meta';
        meta.textContent = `${meeting.section} · ${meeting.credits} cr · ${meeting.location}`;
        const time = document.createElement('span');
        time.className = 'meeting-time';
        time.textContent = `${meeting.startLabel}-${meeting.endLabel}`;

        block.append(code, title, meta, time);
        body.appendChild(block);
      }
    }
    column.appendChild(body);
    dayColumns.push(column);
    canvas.appendChild(column);
  }

  els.scheduleCanvas.replaceChildren(canvas);

  els.sessionLabel.textContent = schedule.session;
  const courseCount = new Set(schedule.meetings.map((m) => m.courseCode)).size;
  els.summaryLabel.textContent = `${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${schedule.meetings.length} ${schedule.meetings.length === 1 ? 'meeting' : 'meetings'}`;
}

export function replaceSchedule(schedule) {
  currentSchedule = schedule;
  els.emptyState.hidden = true;
  els.schedulePanel.hidden = false;
  renderSchedule(schedule);
  setStatus('');
}

export function clearSchedule() {
  currentSchedule = null;
  renderEmptyState();
}

export async function handleFile(file) {
  if (!file) return;
  setImporting(true);
  setStatus('Reading EAF locally…');
  try {
    const schedule = await import('./eaf-parser.js').then((m) => m.parseEafFile(file));
    replaceSchedule(schedule);
    const courseCount = new Set(schedule.meetings.map((m) => m.courseCode)).size;
    setStatus(`Loaded ${schedule.session} · ${courseCount} ${courseCount === 1 ? 'course' : 'courses'} loaded locally.`);
  } catch (err) {
    if (err instanceof EafParseError) {
      setStatus(err.message, 'error');
    } else {
      setStatus('Something went wrong while reading the file. Please try again with the original ArcherHub EAF PDF.', 'error');
    }
  } finally {
    els.fileInput.value = '';
    setImporting(false);
  }
}

export function initApp() {
  requireElements();

  els.form.addEventListener('submit', (event) => event.preventDefault());
  els.fileInput.addEventListener('change', () => {
    if (els.fileInput.files && els.fileInput.files[0]) {
      handleFile(els.fileInput.files[0]);
    }
  });
  els.browseBtn.addEventListener('click', () => els.fileInput.click());

  const prevent = (event) => event.preventDefault();
  els.dropZone.addEventListener('dragover', (event) => {
    prevent(event);
    els.dropZone.classList.add('drop-active');
  });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drop-active'));
  els.dropZone.addEventListener('drop', (event) => {
    prevent(event);
    els.dropZone.classList.remove('drop-active');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  els.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      els.fileInput.click();
    }
  });

  els.replaceBtn.addEventListener('click', () => els.fileInput.click());
  els.clearBtn.addEventListener('click', clearSchedule);
  els.printBtn.addEventListener('click', () => {
    if (currentSchedule) printSchedule(currentSchedule);
  });
  els.downloadPngBtn.addEventListener('click', () => {
    if (currentSchedule) {
      downloadSchedulePng(currentSchedule).catch(() => {
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
