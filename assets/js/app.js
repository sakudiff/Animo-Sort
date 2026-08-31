// AnimoSort application shell. Schedule data comes from the EAF parser;
// customization data comes from the profile store and never enters the parser.

import {
  EafParseError,
  DAY_ORDER,
  STANDARD_PERIODS,
} from './eaf-parser.js';
import {
  CalendarExportError,
  downloadCalendarFile,
  formatIcsCalendar,
  validateDateRange,
} from './calendar.js';
import { downloadSchedulePng } from './export.js';
import { initSiteChrome } from './site.js';
import {
  COURSE_PALETTES,
  MAX_CUSTOMIZATION_FILE_SIZE,
  addProfile,
  buildCourseColorMap,
  createProfile,
  deleteProfile,
  getActiveProfile,
  getCourseKey,
  getPaletteById,
  getSectionKey,
  loadProfileStore,
  normalizeCourseCode,
  normalizeHexColor,
  parseProfileJson,
  profileFilename,
  randomizeCourseColors,
  renameProfile,
  resetProfile,
  resolveMeetingCustomization,
  resetSectionCustomization,
  saveProfileStore,
  serializeProfile,
  setActiveProfile,
  setCourseColor,
  setSectionCustomization,
  formatMeetingMetadataLines,
} from './customization.js';

const MAX_EAF_FILE_SIZE = 1024 * 1024;
const STORAGE_WARNING = 'This profile is available for this session, but browser storage is unavailable. Download a JSON backup to keep it.';
const DAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday' };

let currentSchedule = null;
let importInProgress = false;
let importGeneration = 0;
let activeImportGeneration = null;
let showCourseTitles = true;
let profileStore = loadProfileStore();
let editorContext = null;
let appInitialized = false;
let calendarDateRange = { startDate: '', endDate: '' };
let calendarDateTouched = { startDate: false, endDate: false };
let calendarExportInProgress = false;
let calendarDialogTrigger = null;

const els = {
  form: null,
  fileInput: null,
  browseBtn: null,
  dropZone: null,
  dropZoneText: null,
  importProgress: null,
  importProgressLabel: null,
  statusRegion: null,
  schedulePanel: null,
  sessionLabel: null,
  summaryLabel: null,
  scheduleScroll: null,
  scheduleCanvas: null,
  courseLegend: null,
  courseLegendToggle: null,
  legendBadges: null,
  randomizeColorsBtn: null,
  replaceBtn: null,
  clearBtn: null,
  pngThemeSelect: null,
  downloadPngBtn: null,
  calendarExportToggle: null,
  calendarExportControls: null,
  calendarStartDate: null,
  calendarEndDate: null,
  calendarDateError: null,
  downloadCalendarBtn: null,
  calendarExportDialog: null,
  calendarExportForm: null,
  calendarExportContext: null,
  cancelCalendarExportBtn: null,
  confirmCalendarExportBtn: null,
  showCourseTitles: null,
  profileSelect: null,
  newProfileBtn: null,
  importCustomizationBtn: null,
  customizationFile: null,
  downloadCustomizationBtn: null,
  renameProfileBtn: null,
  deleteProfileBtn: null,
  resetColorsBtn: null,
  resetDetailsBtn: null,
  resetEverythingBtn: null,
  profileStatus: null,
  profileStorageWarning: null,
  customizationDialog: null,
  customizationForm: null,
  customizationContext: null,
  customizationPaletteOptions: null,
  customizationColor: null,
  customizationHex: null,
  customizationProfessor: null,
  resetSectionBtn: null,
  cancelCustomizationBtn: null,
};

function activeProfile() {
  return getActiveProfile(profileStore);
}

function isDarkTheme() {
  const explicit = document.documentElement.getAttribute('data-theme');
  return explicit === 'dark' || (!explicit && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function getPngTheme() {
  const selected = els.pngThemeSelect.value;
  if (selected === 'light' || selected === 'dark') return selected;
  return isDarkTheme() ? 'dark' : 'light';
}

function requireElements() {
  const ids = {
    form: 'eaf-form',
    fileInput: 'eaf-file',
    browseBtn: 'browse-btn',
    dropZone: 'drop-zone',
    dropZoneText: 'drop-zone-text',
    importProgress: 'import-progress',
    importProgressLabel: 'import-progress-label',
    statusRegion: 'status-region',
    schedulePanel: 'schedule-panel',
    sessionLabel: 'session-label',
    summaryLabel: 'summary-label',
    scheduleScroll: 'schedule-scroll',
    scheduleCanvas: 'schedule-canvas',
    courseLegend: 'course-legend',
    courseLegendToggle: 'course-legend-toggle',
    legendBadges: 'legend-badges',
    randomizeColorsBtn: 'randomize-colors-btn',
    replaceBtn: 'replace-btn',
    clearBtn: 'clear-btn',
    pngThemeSelect: 'png-theme-select',
    downloadPngBtn: 'download-png-btn',
    calendarExportToggle: 'calendar-export-toggle',
    calendarExportControls: 'calendar-export-controls',
    calendarStartDate: 'calendar-start-date',
    calendarEndDate: 'calendar-end-date',
    calendarDateError: 'calendar-date-error',
    downloadCalendarBtn: 'download-calendar-btn',
    calendarExportDialog: 'calendar-export-dialog',
    calendarExportForm: 'calendar-export-form',
    calendarExportContext: 'calendar-export-context',
    cancelCalendarExportBtn: 'cancel-calendar-export-btn',
    confirmCalendarExportBtn: 'confirm-calendar-export-btn',
    showCourseTitles: 'show-course-titles',
    profileSelect: 'profile-select',
    newProfileBtn: 'new-profile-btn',
    importCustomizationBtn: 'import-customization-btn',
    customizationFile: 'customization-file',
    downloadCustomizationBtn: 'download-customization-btn',
    renameProfileBtn: 'rename-profile-btn',
    deleteProfileBtn: 'delete-profile-btn',
    resetColorsBtn: 'reset-colors-btn',
    resetDetailsBtn: 'reset-details-btn',
    resetEverythingBtn: 'reset-everything-btn',
    profileStatus: 'profile-status',
    profileStorageWarning: 'profile-storage-warning',
    customizationDialog: 'customization-dialog',
    customizationForm: 'customization-form',
    customizationContext: 'customization-context',
    customizationPaletteOptions: 'customization-palette-options',
    customizationColor: 'customization-color',
    customizationHex: 'customization-hex',
    customizationProfessor: 'customization-professor',
    resetSectionBtn: 'reset-section-btn',
    cancelCustomizationBtn: 'cancel-customization-btn',
  };
  for (const [key, id] of Object.entries(ids)) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`AnimoSort failed to start: missing #${id}`);
    els[key] = node;
  }
}

function setStatus(message, kind = '') {
  els.statusRegion.textContent = message;
  els.statusRegion.className = `status-region${kind ? ` ${kind}` : ''}`;
  els.statusRegion.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}

function setImportProgress(progress = null) {
  if (!els.importProgress) return;
  if (!progress) {
    els.importProgress.hidden = true;
    els.importProgress.style.removeProperty('--import-progress');
    els.importProgress.setAttribute('aria-valuenow', '0');
    els.importProgress.setAttribute('aria-valuetext', 'Ready to choose a file');
    els.importProgress.removeAttribute('data-phase');
    els.importProgressLabel.textContent = 'Preparing local import';
    els.dropZoneText.hidden = false;
    return;
  }
  const percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
  const message = progress.message || 'Processing the EAF locally…';
  els.importProgress.hidden = false;
  els.importProgress.style.setProperty('--import-progress', `${percent}%`);
  els.importProgress.setAttribute('aria-valuenow', String(percent));
  els.importProgress.setAttribute('aria-valuetext', message);
  els.importProgress.dataset.phase = progress.phase || 'processing';
  els.importProgressLabel.textContent = message;
  els.dropZoneText.hidden = true;
}

function setProfileStatus(message, kind = '') {
  els.profileStatus.textContent = message;
  els.profileStatus.className = `status-region${kind ? ` ${kind}` : ''}`;
  els.profileStatus.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}

function setStorageWarning(isUnavailable) {
  els.profileStorageWarning.hidden = !isUnavailable;
  if (isUnavailable) els.profileStorageWarning.textContent = STORAGE_WARNING;
}

function setCalendarDateError(message = '') {
  els.calendarDateError.textContent = message;
  els.calendarDateError.hidden = !message;
}

function getCalendarDateInputs() {
  return {
    startDate: els.calendarStartDate.value,
    endDate: els.calendarEndDate.value,
  };
}

function updateCalendarDateState(showErrors = true) {
  const range = getCalendarDateInputs();
  calendarDateRange = range;
  els.downloadCalendarBtn.disabled = true;
  els.calendarEndDate.removeAttribute('min');

  const missingFieldWasTouched = (!range.startDate && calendarDateTouched.startDate)
    || (!range.endDate && calendarDateTouched.endDate);
  if (!range.startDate || !range.endDate) {
    setCalendarDateError(showErrors && missingFieldWasTouched ? 'Enter both term dates.' : '');
    return null;
  }

  try {
    const validated = validateDateRange(range);
    els.calendarEndDate.min = validated.startDate;
    els.downloadCalendarBtn.disabled = !currentSchedule;
    setCalendarDateError('');
    return validated;
  } catch (error) {
    const message = error instanceof CalendarExportError ? error.message : 'Enter a valid calendar date.';
    setCalendarDateError(showErrors ? message : '');
    return null;
  }
}

function resetCalendarDateState() {
  calendarDateRange = { startDate: '', endDate: '' };
  calendarDateTouched = { startDate: false, endDate: false };
  els.calendarStartDate.value = '';
  els.calendarEndDate.value = '';
  els.calendarEndDate.removeAttribute('min');
  els.downloadCalendarBtn.disabled = true;
  setCalendarDateError('');
}

function setCalendarExportOpen(isOpen) {
  els.calendarExportControls.hidden = !isOpen;
  els.calendarExportToggle.setAttribute('aria-expanded', String(isOpen));
  els.calendarExportToggle.textContent = isOpen ? 'Hide calendar export' : 'Export to Google Calendar';
}

function formatCalendarDownloadStatus(result) {
  const eventLabel = result.exportedCount === 1 ? 'event' : 'events';
  let message = `Downloaded ${result.exportedCount} recurring ${eventLabel}.`;
  if (result.skippedCount > 0) {
    const meetingLabel = result.skippedCount === 1 ? 'meeting' : 'meetings';
    message += ` Skipped ${result.skippedCount} ${meetingLabel} outside the selected term dates.`;
  }
  return message;
}

function closeCalendarExportDialog() {
  if (!els.calendarExportDialog) return;
  if (typeof els.calendarExportDialog.close === 'function') {
    if (els.calendarExportDialog.open) els.calendarExportDialog.close();
  } else {
    els.calendarExportDialog.hidden = true;
  }
  const trigger = calendarDialogTrigger;
  calendarDialogTrigger = null;
  if (trigger && typeof trigger.focus === 'function') trigger.focus();
}

function openCalendarExportDialog() {
  const validatedRange = updateCalendarDateState(true);
  if (!currentSchedule || !validatedRange || calendarExportInProgress) return;
  calendarDialogTrigger = els.downloadCalendarBtn;
  els.calendarExportDialog.hidden = false;
  if (typeof els.calendarExportDialog.showModal === 'function') els.calendarExportDialog.showModal();
  els.cancelCalendarExportBtn.focus();
}

function setCalendarExportBusy(isBusy) {
  calendarExportInProgress = isBusy;
  els.confirmCalendarExportBtn.disabled = isBusy;
  els.confirmCalendarExportBtn.textContent = isBusy ? 'Preparing .ics…' : 'Download .ics';
}

function confirmCalendarExport(event) {
  event.preventDefault();
  if (calendarExportInProgress || !currentSchedule) return;
  const validatedRange = updateCalendarDateState(true);
  if (!validatedRange) {
    closeCalendarExportDialog();
    return;
  }
  setCalendarExportBusy(true);
  try {
    const result = formatIcsCalendar(currentSchedule, activeProfile(), calendarDateRange);
    downloadCalendarFile(result);
    closeCalendarExportDialog();
    setStatus(formatCalendarDownloadStatus(result));
  } catch (error) {
    closeCalendarExportDialog();
    if (error instanceof CalendarExportError && error.code === 'NO_EVENTS_IN_RANGE') {
      setStatus(error.message, 'error');
    } else {
      setStatus('The calendar file could not be downloaded. Please try again.', 'error');
    }
  } finally {
    setCalendarExportBusy(false);
  }
}

function initCalendarExport() {
  els.calendarExportToggle.addEventListener('click', () => {
    setCalendarExportOpen(els.calendarExportControls.hidden);
  });
  els.calendarStartDate.addEventListener('input', () => {
    calendarDateTouched.startDate = true;
    updateCalendarDateState(true);
  });
  els.calendarEndDate.addEventListener('input', () => {
    calendarDateTouched.endDate = true;
    updateCalendarDateState(true);
  });
  els.downloadCalendarBtn.addEventListener('click', openCalendarExportDialog);
  els.cancelCalendarExportBtn.addEventListener('click', closeCalendarExportDialog);
  els.calendarExportForm.addEventListener('submit', confirmCalendarExport);
  els.calendarExportDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeCalendarExportDialog();
  });
}

function renderProfileControls() {
  if (!els.profileSelect || !profileStore) return;
  els.profileSelect.replaceChildren();
  for (const entry of profileStore.profiles) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.profile.name;
    option.selected = entry.id === profileStore.activeProfileId;
    els.profileSelect.appendChild(option);
  }
  els.deleteProfileBtn.title = profileStore.activeProfileId === 'default'
    ? 'The Default profile cannot be deleted'
    : 'Delete the active profile';
}

function persistStore(nextStore, statusMessage = '', statusKind = '') {
  profileStore = nextStore;
  const result = saveProfileStore(profileStore);
  setStorageWarning(!result.ok);
  renderProfileControls();
  if (currentSchedule) renderSchedule(currentSchedule);
  if (statusMessage) setProfileStatus(statusMessage, statusKind);
  return result;
}

function updateActiveProfile(mutator, statusMessage = '', statusKind = '') {
  const nextProfile = mutator(activeProfile());
  return persistStore({
    ...profileStore,
    profiles: profileStore.profiles.map((entry) => entry.id === profileStore.activeProfileId
      ? { ...entry, profile: nextProfile }
      : entry),
  }, statusMessage, statusKind);
}

function closeActivePopover() {
  document.querySelectorAll('.palette-popover').forEach((node) => node.remove());
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
    setCourseLegendOpen(!els.courseLegend.classList.contains('is-open'));
  });
  sync();
  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', sync);
  else if (typeof mobileQuery.addListener === 'function') mobileQuery.addListener(sync);
}

function applyPaletteStyles(element, palette, theme = isDarkTheme() ? 'dark' : 'light') {
  for (const preset of COURSE_PALETTES) element.classList.remove(`palette-${preset.id}`);
  if (!palette.isCustom) element.classList.add(`palette-${palette.id}`);
  const colors = theme === 'dark' ? palette.dark : palette.light;
  element.style.setProperty('--card-bg', colors.bg);
  element.style.setProperty('--card-border', colors.border);
  element.style.setProperty('--card-code', colors.code);
  element.style.setProperty('--card-title', colors.title);
  element.style.setProperty('--card-meta', colors.meta);
  element.style.setProperty('--card-swatch', palette.swatch);
}

function createCourseIndexMap(schedule) {
  const indexes = new Map();
  for (const meeting of schedule.meetings) {
    const code = normalizeCourseCode(meeting.courseCode);
    if (code && !indexes.has(code)) indexes.set(code, indexes.size);
  }
  return indexes;
}

function getResolvedMeeting(meeting, schedule = currentSchedule, profile = activeProfile()) {
  const source = schedule || { meetings: [meeting] };
  const map = buildCourseColorMap(source, profile);
  const indexes = createCourseIndexMap(source);
  const code = getCourseKey(meeting.courseCode);
  return resolveMeetingCustomization(profile, meeting, indexes.get(code) || 0, map);
}

export function formatMeetingDetails(meeting, resolved = getResolvedMeeting(meeting)) {
  const lines = formatMeetingMetadataLines(meeting, resolved);
  return [
    meeting.courseCode,
    `Section ${meeting.section}`,
    meeting.title,
    `Day: ${DAY_LABELS[meeting.day] || meeting.day}`,
    lines.locationMode,
    lines.professor,
    lines.time,
  ].filter(Boolean).join(', ');
}

function formatTimeLabel(minutes) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
}

function setImporting(isImporting) {
  importInProgress = isImporting;
  els.fileInput.disabled = isImporting;
  els.browseBtn.disabled = isImporting;
  els.replaceBtn.disabled = isImporting;
  els.dropZone.setAttribute('aria-disabled', String(isImporting));
  els.dropZone.setAttribute('aria-busy', String(isImporting));
  els.dropZone.setAttribute('tabindex', isImporting ? '-1' : '0');
  els.dropZone.classList.toggle('is-importing', isImporting);
  if (isImporting) els.dropZone.classList.remove('drop-active');
}

function resetScheduleView() {
  closeActivePopover();
  closeCalendarExportDialog();
  setCalendarExportOpen(false);
  resetCalendarDateState();
  els.schedulePanel.hidden = true;
  els.scheduleScroll.removeAttribute('data-preview-theme');
  els.sessionLabel.textContent = '';
  els.summaryLabel.textContent = '';
  els.scheduleCanvas.style.removeProperty('height');
  els.scheduleCanvas.replaceChildren();
  els.legendBadges.replaceChildren();
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
  let bodyHeight = 1050;
  for (const { block, duration } of meetingBlocks) {
    const contentHeight = block.scrollHeight + (block.offsetHeight - block.clientHeight) + 14;
    bodyHeight = Math.max(bodyHeight, (contentHeight * span) / Math.max(1, duration));
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
  els.legendBadges.replaceChildren();
  const distinctCourses = [...new Set(schedule.meetings.map((meeting) => normalizeCourseCode(meeting.courseCode)))];
  els.courseLegend.hidden = !distinctCourses.length;
  for (const code of distinctCourses) {
    const meeting = schedule.meetings.find((entry) => normalizeCourseCode(entry.courseCode) === code);
    const palette = courseColorMap[code] || COURSE_PALETTES[0];
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'course-badge';
    applyPaletteStyles(badge, palette);
    badge.setAttribute('aria-label', `Customize ${meeting.courseCode} section ${meeting.section}`);
    badge.title = `Customize ${meeting.courseCode} section ${meeting.section}`;
    const swatch = document.createElement('span');
    swatch.className = 'course-badge-swatch';
    swatch.style.background = palette.swatch;
    const codeSpan = document.createElement('span');
    codeSpan.className = 'course-badge-code';
    codeSpan.textContent = meeting.courseCode;
    const sectionSpan = document.createElement('span');
    sectionSpan.className = 'course-badge-section';
    sectionSpan.textContent = meeting.section;
    badge.append(swatch, codeSpan, sectionSpan);
    badge.addEventListener('click', () => openCustomizationDialog(meeting, badge));
    els.legendBadges.appendChild(badge);
  }
}

function renderMeetingCard(meeting, courseColorMap, courseIndexes, canvasStart, pixelsPerMinute, previewTheme) {
  const code = getCourseKey(meeting.courseCode);
  const resolved = resolveMeetingCustomization(activeProfile(), meeting, courseIndexes.get(code) || 0, courseColorMap);
  const lines = formatMeetingMetadataLines(meeting, resolved);
  const block = document.createElement('div');
  block.className = 'meeting-block';
  applyPaletteStyles(block, resolved.palette, previewTheme);
  block.style.top = `${meetingTop(meeting, canvasStart, pixelsPerMinute)}%`;
  block.style.height = `${meetingHeight(meeting, pixelsPerMinute)}%`;
  block.setAttribute('role', 'cell');
  block.setAttribute('tabindex', '0');
  block.setAttribute('aria-label', formatMeetingDetails(meeting, resolved));
  block.dataset.course = code;
  block.dataset.section = resolved.sectionKey;

  const codeNode = document.createElement('strong');
  codeNode.className = 'meeting-code';
  codeNode.textContent = meeting.courseCode;
  const sectionNode = document.createElement('span');
  sectionNode.className = 'meeting-section';
  sectionNode.textContent = meeting.section;
  const codeGroup = document.createElement('span');
  codeGroup.className = 'meeting-code-group';
  codeGroup.append(codeNode, sectionNode);

  const colorButton = document.createElement('button');
  colorButton.type = 'button';
  colorButton.className = 'meeting-color-btn';
  colorButton.style.background = resolved.palette.swatch;
  colorButton.title = `Customize ${meeting.courseCode} section ${meeting.section}`;
  colorButton.setAttribute('aria-label', `Customize ${meeting.courseCode} section ${meeting.section}`);
  colorButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openCustomizationDialog(meeting, colorButton);
  });

  const primary = document.createElement('div');
  primary.className = 'meeting-primary';
  primary.append(codeGroup, colorButton);

  const title = document.createElement('span');
  title.className = 'meeting-title';
  title.textContent = meeting.title;
  const location = document.createElement('span');
  location.className = 'meeting-location';
  location.textContent = lines.locationMode;
  const professor = document.createElement('span');
  professor.className = 'meeting-professor';
  if (lines.professor) professor.textContent = lines.professor;
  const time = document.createElement('span');
  time.className = 'meeting-time';
  time.textContent = lines.time;
  block.append(primary, title, location);
  if (lines.professor) block.appendChild(professor);
  block.appendChild(time);
  block.addEventListener('click', () => openCustomizationDialog(meeting, block));
  block.addEventListener('keydown', (event) => {
    if (event.target !== block) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCustomizationDialog(meeting, block);
    }
  });
  return { block, duration: meeting.endMinutes - meeting.startMinutes };
}

export function renderSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule.meetings) || !schedule.meetings.length) {
    throw new Error('Invalid schedule passed to renderSchedule');
  }
  closeActivePopover();
  els.scheduleCanvas.replaceChildren();
  const previewTheme = getPngTheme();
  els.scheduleScroll.dataset.previewTheme = previewTheme;
  const profile = activeProfile();
  const courseColorMap = buildCourseColorMap(schedule, profile);
  const courseIndexes = createCourseIndexMap(schedule);
  renderCourseLegend(schedule, courseColorMap);
  const allMinutes = schedule.meetings.flatMap((meeting) => [meeting.startMinutes, meeting.endMinutes]);
  const canvasStart = Math.max(0, Math.min(...allMinutes) - 15);
  const canvasEnd = Math.min(1440, Math.max(...allMinutes) + 15);
  const span = Math.max(1, canvasEnd - canvasStart);
  const pixelsPerMinute = span;
  const canvas = document.createElement('div');
  canvas.className = 'timetable';
  canvas.setAttribute('role', 'table');
  canvas.setAttribute('aria-label', `Weekly timetable for ${schedule.session}`);
  const timeGutter = document.createElement('div');
  timeGutter.className = 'time-gutter';
  timeGutter.setAttribute('role', 'rowheader');
  canvas.appendChild(timeGutter);
  const guides = [
    ...STANDARD_PERIODS.filter(([start, end]) => start >= canvasStart && end <= canvasEnd),
    ...schedule.meetings.map((meeting) => [meeting.startMinutes, meeting.endMinutes]),
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
    for (const entry of guideEntries) body.appendChild(createDayGridline(entry.minutes, canvasStart, pixelsPerMinute, entry.kind));
    const dayMeetings = schedule.meetings.filter((meeting) => meeting.day === day);
    if (!dayMeetings.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-day';
      empty.textContent = 'No classes';
      body.appendChild(empty);
    } else {
      for (const meeting of dayMeetings) {
        const rendered = renderMeetingCard(meeting, courseColorMap, courseIndexes, canvasStart, pixelsPerMinute, previewTheme);
        meetingBlocks.push(rendered);
        body.appendChild(rendered.block);
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
  const courseCount = new Set(schedule.meetings.map((meeting) => normalizeCourseCode(meeting.courseCode))).size;
  els.summaryLabel.textContent = `${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${schedule.meetings.length} ${schedule.meetings.length === 1 ? 'meeting' : 'meetings'}`;
}

export function replaceSchedule(schedule) {
  closeCalendarExportDialog();
  setCalendarExportOpen(false);
  resetCalendarDateState();
  currentSchedule = schedule;
  els.schedulePanel.hidden = false;
  const scheduleCard = els.schedulePanel.querySelector('.reveal');
  if (scheduleCard) scheduleCard.classList.add('visible');
  renderSchedule(schedule);
  setStatus('');
}

export function clearSchedule() {
  importGeneration += 1;
  currentSchedule = null;
  if (editorContext) closeCustomizationDialog();
  closeCalendarExportDialog();
  showCourseTitles = true;
  els.showCourseTitles.checked = true;
  els.fileInput.value = '';
  els.dropZone.classList.remove('drop-active');
  resetScheduleView();
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
  setImportProgress({ phase: 'reading', percent: 5, message: 'Preparing the EAF locally…' });
  try {
    const schedule = await import('./eaf-parser.js').then((module) => module.parseEafFile(file, setImportProgress));
    if (generation !== importGeneration) return;
    replaceSchedule(schedule);
    const courseCount = new Set(schedule.meetings.map((meeting) => normalizeCourseCode(meeting.courseCode))).size;
    setImportProgress({ phase: 'complete', percent: 100, message: 'Timetable ready.' });
    setStatus(`Loaded ${schedule.session} · ${courseCount} ${courseCount === 1 ? 'course' : 'courses'} loaded locally.`);
  } catch (error) {
    if (generation !== importGeneration) return;
    if (error instanceof EafParseError) setStatus(error.message, 'error');
    else setStatus('Something went wrong while reading the file. Please try again with the original Archershub EAF PDF.', 'error');
  } finally {
    if (activeImportGeneration === generation) {
      activeImportGeneration = null;
      els.fileInput.value = '';
      setImporting(false);
      setImportProgress();
    }
  }
}

function handleProfileSelection(profileId) {
  try {
    const nextStore = setActiveProfile(profileStore, profileId);
    persistStore(nextStore, `Using “${getActiveProfile(nextStore).name}”.`);
  } catch (error) {
    setProfileStatus(error.message || 'That profile is not available.', 'error');
    renderProfileControls();
  }
}

function handleNewProfile() {
  const requested = window.prompt('Name this customization profile:', 'New profile');
  if (requested === null) return;
  try {
    const nextStore = addProfile(profileStore, createProfile(requested));
    persistStore(nextStore, `Created “${getActiveProfile(nextStore).name}”.`);
  } catch (error) {
    setProfileStatus(error.message || 'Enter a profile name between 1 and 64 characters.', 'error');
  }
}

function handleProfileRename() {
  const requested = window.prompt('Rename this customization profile:', activeProfile().name);
  if (requested === null) return;
  try {
    const nextStore = renameProfile(profileStore, profileStore.activeProfileId, requested);
    persistStore(nextStore, `Renamed profile to “${getActiveProfile(nextStore).name}”.`);
  } catch (error) {
    setProfileStatus(error.message || 'Enter a profile name between 1 and 64 characters.', 'error');
  }
}

function handleProfileDelete() {
  if (profileStore.activeProfileId === 'default') {
    setProfileStatus('The Default profile cannot be deleted.', 'error');
    return;
  }
  const name = activeProfile().name;
  if (!window.confirm(`Delete the “${name}” customization profile?`)) return;
  try {
    persistStore(deleteProfile(profileStore, profileStore.activeProfileId), `Deleted “${name}”.`);
  } catch (error) {
    setProfileStatus(error.message || 'That profile could not be deleted.', 'error');
  }
}

function handleProfileReset(scope) {
  if (scope === 'all' && !window.confirm('Reset all colors and section details in this profile?')) return;
  const messages = {
    colors: 'Colors reset to Plain/Neutral.',
    details: 'Section details reset to EAF values.',
    all: 'Everything reset to Plain/Neutral and EAF values.',
  };
  try {
    updateActiveProfile((profile) => resetProfile(profile, scope), messages[scope]);
  } catch (error) {
    setProfileStatus(error.message || 'The profile could not be reset.', 'error');
  }
}

function handleRandomizeColors() {
  if (!currentSchedule) return;
  const codes = [...new Set(currentSchedule.meetings.map((meeting) => meeting.courseCode))];
  updateActiveProfile((profile) => randomizeCourseColors(profile, codes), 'Pastel colors randomized for this profile.');
}

async function handleCustomizationFile(file) {
  els.customizationFile.value = '';
  if (!file) return;
  if (file.size > MAX_CUSTOMIZATION_FILE_SIZE) {
    setProfileStatus('This configuration is larger than 256 KiB.', 'error');
    return;
  }
  if (file.type && file.type !== 'application/json' && !/\.json$/i.test(file.name || '')) {
    setProfileStatus('Choose an AnimoSort customization JSON file.', 'error');
    return;
  }
  try {
    const profile = parseProfileJson(await file.text(), file.name);
    const nextStore = addProfile(profileStore, profile);
    const importedName = getActiveProfile(nextStore).name;
    persistStore(nextStore, `Imported “${importedName}” successfully.`);
  } catch (error) {
    setProfileStatus(error.message || 'The customization file could not be imported.', 'error');
  }
}

function downloadCustomization() {
  const profile = activeProfile();
  const blob = new Blob([serializeProfile(profile)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = profileFilename(profile);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
  setProfileStatus(`Downloaded “${profile.name}”.`);
}

function getDraftColorHex(value) {
  return normalizeHexColor(getPaletteById(value).swatch) || '#94a3b8';
}

function setEditorDraftColor(value, changed = true) {
  const normalized = typeof value === 'string' && value.startsWith('#') ? normalizeHexColor(value) : value;
  const palette = getPaletteById(normalized || 'plain');
  editorContext.draftColor = normalized || 'plain';
  if (changed) editorContext.colorChanged = true;
  const hex = getDraftColorHex(normalized || 'plain');
  els.customizationColor.value = hex;
  els.customizationHex.value = hex.toUpperCase();
  els.customizationHex.classList.remove('invalid');
  els.customizationPaletteOptions.querySelectorAll('[data-palette]').forEach((button) => {
    button.classList.toggle('active', button.dataset.palette === editorContext.draftColor);
  });
  els.customizationColor.style.setProperty('--draft-swatch', palette.swatch);
}

function renderEditorPaletteOptions() {
  els.customizationPaletteOptions.replaceChildren();
  const options = [{ id: 'plain', name: 'Plain / Neutral', swatch: COURSE_PALETTES[0].swatch }, ...COURSE_PALETTES.slice(1)];
  for (const palette of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'customization-palette-option';
    button.dataset.palette = palette.id;
    button.style.background = palette.swatch;
    button.title = palette.name;
    button.setAttribute('aria-label', palette.name);
    button.addEventListener('click', () => setEditorDraftColor(palette.id));
    els.customizationPaletteOptions.appendChild(button);
  }
}

export function closeCustomizationDialog() {
  if (!els.customizationDialog) return;
  const trigger = editorContext?.trigger;
  if (typeof els.customizationDialog.close === 'function' && els.customizationDialog.open) els.customizationDialog.close();
  else els.customizationDialog.hidden = true;
  editorContext = null;
  if (trigger && typeof trigger.focus === 'function') trigger.focus();
}

export function openCustomizationDialog(meeting, trigger = null) {
  if (!currentSchedule || !meeting) return;
  const profile = activeProfile();
  const sectionKey = getSectionKey(meeting.courseCode, meeting.section);
  const resolved = getResolvedMeeting(meeting);
  const storedColor = profile.courses?.[getCourseKey(meeting.courseCode)]?.color;
  const storedSection = profile.sections?.[sectionKey] || {};
  editorContext = {
    meeting,
    trigger,
    draftColor: storedColor || resolved.palette.id || resolved.palette.swatch,
    colorChanged: false,
  };
  els.customizationContext.textContent = `${meeting.courseCode} ${meeting.section} · color applies to the course; mode and professor apply to this section.`;
  els.customizationProfessor.value = storedSection.professor || '';
  const mode = storedSection.mode || 'inherit';
  els.customizationForm.querySelectorAll('input[name="customization-mode"]').forEach((radio) => {
    radio.checked = radio.value === mode;
  });
  renderEditorPaletteOptions();
  setEditorDraftColor(editorContext.draftColor, false);
  if (typeof els.customizationDialog.showModal === 'function') els.customizationDialog.showModal();
  else els.customizationDialog.hidden = false;
  const initialFocus = els.customizationPaletteOptions.querySelector('.active')
    || els.customizationPaletteOptions.querySelector('button')
    || els.cancelCustomizationBtn;
  initialFocus.focus();
}

function saveCustomizationDraft(event) {
  event.preventDefault();
  if (!editorContext) return;
  const hex = normalizeHexColor(els.customizationHex.value);
  if (!hex) {
    els.customizationHex.classList.add('invalid');
    els.customizationHex.focus();
    return;
  }
  if (hex && editorContext.draftColor?.startsWith('#')) editorContext.draftColor = hex;
  const mode = els.customizationForm.querySelector('input[name="customization-mode"]:checked')?.value || 'inherit';
  try {
    let next = activeProfile();
    if (editorContext.colorChanged) next = setCourseColor(next, editorContext.meeting.courseCode, editorContext.draftColor);
    next = setSectionCustomization(next, editorContext.meeting.courseCode, editorContext.meeting.section, {
      mode: mode === 'inherit' ? null : mode,
      professor: els.customizationProfessor.value,
    });
    persistStore({
      ...profileStore,
      profiles: profileStore.profiles.map((entry) => entry.id === profileStore.activeProfileId ? { ...entry, profile: next } : entry),
    }, 'Section customization saved.');
    closeCustomizationDialog();
  } catch (error) {
    setProfileStatus(error.message || 'The section customization could not be saved.', 'error');
  }
}

function resetEditorSection() {
  if (!editorContext) return;
  els.customizationForm.querySelectorAll('input[name="customization-mode"]').forEach((radio) => {
    radio.checked = radio.value === 'inherit';
  });
  els.customizationProfessor.value = '';
  const profile = resetSectionCustomization(activeProfile(), editorContext.meeting.courseCode, editorContext.meeting.section);
  const existingColor = profile.courses?.[getCourseKey(editorContext.meeting.courseCode)]?.color;
  editorContext.draftColor = existingColor || editorContext.draftColor;
  editorContext.colorChanged = false;
  setEditorDraftColor(editorContext.draftColor, false);
}

function initCustomizationDialog() {
  els.customizationForm.addEventListener('submit', saveCustomizationDraft);
  els.cancelCustomizationBtn.addEventListener('click', closeCustomizationDialog);
  els.resetSectionBtn.addEventListener('click', resetEditorSection);
  els.customizationColor.addEventListener('input', () => setEditorDraftColor(els.customizationColor.value.toLowerCase()));
  els.customizationHex.addEventListener('input', () => {
    const value = normalizeHexColor(els.customizationHex.value);
    if (value) setEditorDraftColor(value);
    else els.customizationHex.classList.add('invalid');
  });
  els.customizationDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeCustomizationDialog();
  });
}

export function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  initSiteChrome();
  requireElements();
  profileStore = loadProfileStore();
  const startupSave = saveProfileStore(profileStore);
  setStorageWarning(!startupSave.ok);
  renderProfileControls();
  initCourseLegendToggle();
  initCustomizationDialog();
  initCalendarExport();

  els.form.addEventListener('submit', (event) => event.preventDefault());
  els.fileInput.addEventListener('change', () => { if (els.fileInput.files?.[0]) handleFile(els.fileInput.files[0]); });
  els.browseBtn.addEventListener('click', () => { if (!importInProgress) els.fileInput.click(); });
  els.dropZone.addEventListener('dragover', (event) => {
    if (importInProgress) return;
    event.preventDefault();
    els.dropZone.classList.add('drop-active');
  });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drop-active'));
  els.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    els.dropZone.classList.remove('drop-active');
    if (!importInProgress && event.dataTransfer?.files?.[0]) handleFile(event.dataTransfer.files[0]);
  });
  els.dropZone.addEventListener('click', () => { if (!importInProgress) els.fileInput.click(); });
  els.dropZone.addEventListener('keydown', (event) => {
    if (!importInProgress && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      els.fileInput.click();
    }
  });
  els.replaceBtn.addEventListener('click', () => { if (!importInProgress) els.fileInput.click(); });
  els.clearBtn.addEventListener('click', clearSchedule);
  els.showCourseTitles.addEventListener('change', () => {
    showCourseTitles = els.showCourseTitles.checked;
    if (currentSchedule) renderSchedule(currentSchedule);
  });
  els.pngThemeSelect.addEventListener('change', () => {
    if (currentSchedule) renderSchedule(currentSchedule);
  });
  els.downloadPngBtn.addEventListener('click', () => {
    if (!currentSchedule) return;
    downloadSchedulePng(currentSchedule, { showCourseTitles, profile: activeProfile(), theme: getPngTheme() })
      .catch(() => setStatus('The PNG could not be generated. Please try again.', 'error'));
  });
  els.profileSelect.addEventListener('change', () => handleProfileSelection(els.profileSelect.value));
  els.newProfileBtn.addEventListener('click', handleNewProfile);
  els.importCustomizationBtn.addEventListener('click', () => els.customizationFile.click());
  els.customizationFile.addEventListener('change', () => handleCustomizationFile(els.customizationFile.files?.[0]));
  els.downloadCustomizationBtn.addEventListener('click', downloadCustomization);
  els.renameProfileBtn.addEventListener('click', handleProfileRename);
  els.deleteProfileBtn.addEventListener('click', handleProfileDelete);
  els.resetColorsBtn.addEventListener('click', () => handleProfileReset('colors'));
  els.resetDetailsBtn.addEventListener('click', () => handleProfileReset('details'));
  els.resetEverythingBtn.addEventListener('click', () => handleProfileReset('all'));
  els.randomizeColorsBtn.addEventListener('click', handleRandomizeColors);
  window.addEventListener('resize', () => fitTimetablePreview(), { passive: true });
  window.addEventListener('animosort:theme-change', () => { if (currentSchedule) renderSchedule(currentSchedule); });
  resetScheduleView();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp, { once: true });
  else initApp();
}
