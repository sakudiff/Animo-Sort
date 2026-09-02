// AnimoSort application shell. Schedule data comes from the EAF parser;
// customization data comes from the profile store and never enters the parser.

import {
  EafParseError,
  DAY_ORDER,
  STANDARD_PERIODS,
  validateNoOverlaps,
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
  resolveScheduleEntries,
  applySyncConflictChoice,
  formatPairFieldDifference,
  getPairCustomizationState,
  getPairScopeLabel,
  resetMeetingCustomization,
  resetSectionDefaults,
  resetSectionCustomization,
  saveProfileStore,
  serializeProfile,
  setActiveProfile,
  setCourseColor,
  setSectionCustomization,
  setMeetingCustomization,
  setMeetingAutomaticOverride,
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
  manualDetailsPanel: null,
  manualDetailsList: null,
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
  customizeProfileToggle: null,
  hideCustomizationBtn: null,
  quickImportCustomizationBtn: null,
  quickProfileStatus: null,
  configurationPanel: null,
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
  customizationScopeGroup: null,
  customizationScopeOptions: null,
  customizationScopeMeeting: null,
  customizationScopePair: null,
  customizationScopeHelp: null,
  customizationPairStatus: null,
  customizationConflictDialog: null,
  customizationConflictForm: null,
  customizationConflictCopy: null,
  customizationSyncDiff: null,
  customizationModeHelp: null,
  customizationCourseCode: null,
  customizationSection: null,
  customizationTitle: null,
  customizationDay: null,
  customizationStartTime: null,
  customizationEndTime: null,
  customizationRoom: null,
  customizationRoomLabel: null,
  customizationRoomHelp: null,
  customizationMoreDetails: null,
  customizationValidation: null,
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
    manualDetailsPanel: 'manual-details-panel',
    manualDetailsList: 'manual-details-list',
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
    customizeProfileToggle: 'customize-profile-toggle',
    hideCustomizationBtn: 'hide-customization-btn',
    quickImportCustomizationBtn: 'quick-import-customization-btn',
    quickProfileStatus: 'quick-profile-status',
    configurationPanel: 'configuration-panel',
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
    customizationScopeGroup: 'customization-scope-group',
    customizationScopeOptions: 'customization-scope-options',
    customizationScopeMeeting: 'customization-scope-meeting',
    customizationScopePair: 'customization-scope-pair',
    customizationScopeHelp: 'customization-scope-help',
    customizationPairStatus: 'customization-pair-status',
    customizationConflictDialog: 'customization-sync-conflict',
    customizationConflictForm: 'customization-sync-conflict-form',
    customizationConflictCopy: 'customization-sync-conflict-copy',
    customizationSyncDiff: 'customization-sync-diff',
    customizationModeHelp: 'customization-mode-help',
    customizationCourseCode: 'customization-course-code',
    customizationSection: 'customization-section',
    customizationTitle: 'customization-title',
    customizationDay: 'customization-day',
    customizationStartTime: 'customization-start-time',
    customizationEndTime: 'customization-end-time',
    customizationRoom: 'customization-room',
    customizationRoomLabel: 'customization-room-label',
    customizationRoomHelp: 'customization-room-help',
    customizationMoreDetails: 'customization-more-details',
    customizationValidation: 'customization-validation',
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
  for (const region of [els.profileStatus, els.quickProfileStatus]) {
    region.textContent = message;
    region.className = `status-region${region === els.quickProfileStatus ? ' profile-shortcut-status' : ''}${kind ? ` ${kind}` : ''}`;
    region.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  }
}

function setCustomizationOpen(isOpen, shouldFocus = false) {
  els.configurationPanel.hidden = !isOpen;
  els.customizeProfileToggle.setAttribute('aria-expanded', String(isOpen));
  if (!isOpen || !shouldFocus) return;
  window.requestAnimationFrame(() => els.configurationPanel.scrollIntoView({ behavior: 'auto', block: 'nearest' }));
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
  els.calendarExportToggle.textContent = isOpen ? 'Hide calendar' : 'Add to Calendar';
}

function formatCalendarDownloadStatus(result) {
  const eventLabel = result.exportedCount === 1 ? 'event' : 'events';
  let message = `Downloaded ${result.exportedCount} recurring ${eventLabel}.`;
  if (result.outsideRangeCount > 0) {
    const meetingLabel = result.outsideRangeCount === 1 ? 'meeting' : 'meetings';
    message += ` Skipped ${result.outsideRangeCount} ${meetingLabel} outside the selected term dates.`;
  }
  if (result.unresolvedCount > 0) {
    const meetingLabel = result.unresolvedCount === 1 ? 'meeting' : 'meetings';
    message += ` Skipped ${result.unresolvedCount} ${meetingLabel} without a complete manual time.`;
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
  const optionsContainer = document.getElementById('profile-select-options');
  const labelEl = document.getElementById('profile-select-label');
  if (optionsContainer) optionsContainer.replaceChildren();

  for (const entry of profileStore.profiles) {
    const isSelected = entry.id === profileStore.activeProfileId;
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.profile.name;
    option.selected = isSelected;
    els.profileSelect.appendChild(option);

    if (optionsContainer) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `custom-select-option${isSelected ? ' is-active' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(isSelected));
      btn.textContent = entry.profile.name;
      btn.addEventListener('click', () => {
        const menu = document.getElementById('profile-select-menu');
        if (menu) menu.open = false;
        handleProfileSelection(entry.id);
      });
      optionsContainer.appendChild(btn);
    }

    if (isSelected && labelEl) {
      labelEl.textContent = entry.profile.name;
    }
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

function getEafResolvedMeeting(meeting, profile = activeProfile()) {
  const eafProfile = resetSectionCustomization(profile, meeting.courseCode, meeting.section);
  return getResolvedMeeting(meeting, currentSchedule, eafProfile);
}

export function formatMeetingDetails(meeting, resolved = getResolvedMeeting(meeting)) {
  const lines = formatMeetingMetadataLines(meeting, resolved);
  const dayLine = resolved.scheduled && resolved.day
    ? `Day: ${DAY_LABELS[resolved.day] || resolved.day}`
    : resolved.mode === 'online' ? 'Online · no fixed time' : 'Async · no fixed time';
  return [
    resolved.courseCode || meeting.courseCode,
    `Section ${resolved.section || meeting.section}`,
    resolved.title || meeting.title,
    dayLine,
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
  document.body.classList.remove('has-schedule');
  setCustomizationOpen(false);
  els.scheduleScroll.removeAttribute('data-preview-theme');
  els.sessionLabel.textContent = '';
  els.summaryLabel.textContent = '';
  els.scheduleCanvas.style.removeProperty('height');
  els.scheduleCanvas.replaceChildren();
  els.manualDetailsList.replaceChildren();
  els.manualDetailsPanel.hidden = true;
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
    els.scheduleCanvas.style.removeProperty('overflow');
    els.scheduleScroll.classList.remove('is-scaled');
    return;
  }
  timetable.style.removeProperty('width');
  timetable.style.removeProperty('transform');
  els.scheduleCanvas.style.removeProperty('height');
  els.scheduleCanvas.style.removeProperty('overflow');
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
  els.scheduleCanvas.style.overflow = 'hidden';
  els.scheduleScroll.classList.add('is-scaled');
}

function createDayGridline(minutes, canvasStart, pixelsPerMinute, kind) {
  const line = document.createElement('div');
  line.className = `day-gridline ${kind}`;
  line.style.top = `${meetingTop({ startMinutes: minutes }, canvasStart, pixelsPerMinute)}%`;
  return line;
}

function renderManualDetails(entries) {
  const unplaced = entries.filter((entry) => !entry.resolved.scheduled);
  els.manualDetailsPanel.hidden = !unplaced.length;
  els.manualDetailsList.replaceChildren();
  for (const { meeting, resolved } of unplaced) {
    const item = document.createElement('article');
    item.className = 'manual-details-item';
    const copy = document.createElement('div');
    copy.className = 'manual-details-copy';
    const identity = document.createElement('strong');
    identity.textContent = `${resolved.courseCode} ${resolved.section}`;
    const title = document.createElement('span');
    title.textContent = resolved.title;
    const state = document.createElement('span');
    state.className = 'manual-details-state';
    state.textContent = resolved.mode === 'online' ? 'Online · no fixed time' : 'Async · no fixed time';
    copy.append(identity, title, state);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button btn-ghost manual-details-edit';
    edit.textContent = 'Edit details';
    edit.addEventListener('click', () => openCustomizationDialog(meeting, edit));
    item.append(copy, edit);
    els.manualDetailsList.appendChild(item);
  }
}

function renderCourseLegend(schedule, courseColorMap, entries = resolveScheduleEntries(schedule, activeProfile())) {
  els.legendBadges.replaceChildren();
  const distinctCourses = [...new Set(schedule.meetings.map((meeting) => normalizeCourseCode(meeting.courseCode)))];
  els.courseLegend.hidden = !distinctCourses.length;
  for (const code of distinctCourses) {
    const entry = entries.find(({ meeting }) => normalizeCourseCode(meeting.courseCode) === code);
    if (!entry) continue;
    const { meeting, resolved } = entry;
    const palette = courseColorMap[code] || COURSE_PALETTES[0];
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'course-badge';
    applyPaletteStyles(badge, palette);
    badge.setAttribute('aria-label', `Customize ${resolved.courseCode} section ${resolved.section}`);
    badge.title = `Customize ${resolved.courseCode} section ${resolved.section}`;
    const swatch = document.createElement('span');
    swatch.className = 'course-badge-swatch';
    swatch.style.background = palette.swatch;
    const codeSpan = document.createElement('span');
    codeSpan.className = 'course-badge-code';
    codeSpan.textContent = resolved.courseCode;
    const sectionSpan = document.createElement('span');
    sectionSpan.className = 'course-badge-section';
    sectionSpan.textContent = resolved.section;
    badge.append(swatch, codeSpan, sectionSpan);
    badge.addEventListener('click', () => openCustomizationDialog(meeting, badge));
    els.legendBadges.appendChild(badge);
  }
}

function renderMeetingCard(entry, canvasStart, pixelsPerMinute, previewTheme) {
  const { meeting, resolved, effective } = entry;
  const code = resolved.courseKey;
  const lines = formatMeetingMetadataLines(meeting, resolved);
  const block = document.createElement('div');
  block.className = 'meeting-block';
  applyPaletteStyles(block, resolved.palette, previewTheme);
  block.style.top = `${meetingTop(effective, canvasStart, pixelsPerMinute)}%`;
  block.style.height = `${meetingHeight(effective, pixelsPerMinute)}%`;
  block.setAttribute('role', 'cell');
  block.setAttribute('tabindex', '0');
  block.setAttribute('aria-label', formatMeetingDetails(meeting, resolved));
  block.dataset.course = code;
  block.dataset.section = resolved.sectionKey;
  block.dataset.meetingId = resolved.meetingId;

  const codeNode = document.createElement('strong');
  codeNode.className = 'meeting-code';
  codeNode.textContent = resolved.courseCode;
  const sectionNode = document.createElement('span');
  sectionNode.className = 'meeting-section';
  sectionNode.textContent = resolved.section;
  const codeGroup = document.createElement('span');
  codeGroup.className = 'meeting-code-group';
  codeGroup.append(codeNode, sectionNode);

  const colorButton = document.createElement('button');
  colorButton.type = 'button';
  colorButton.className = 'meeting-color-btn';
  colorButton.style.background = resolved.palette.swatch;
  colorButton.title = `Customize ${resolved.courseCode} section ${resolved.section}`;
  colorButton.setAttribute('aria-label', `Customize ${resolved.courseCode} section ${resolved.section}`);
  colorButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openCustomizationDialog(meeting, colorButton);
  });

  const primary = document.createElement('div');
  primary.className = 'meeting-primary';
  primary.append(codeGroup, colorButton);

  const title = document.createElement('span');
  title.className = 'meeting-title';
  title.textContent = resolved.title;
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
  return { block, duration: effective.endMinutes - effective.startMinutes };
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
  const entries = resolveScheduleEntries(schedule, profile);
  const timedEntries = entries.filter((entry) => entry.resolved.scheduled);
  renderCourseLegend(schedule, courseColorMap, entries);
  renderManualDetails(entries);
  const allMinutes = timedEntries.flatMap(({ effective }) => [effective.startMinutes, effective.endMinutes]);
  const canvasStart = Math.max(0, (allMinutes.length ? Math.min(...allMinutes) : STANDARD_PERIODS[0][0]) - 15);
  const canvasEnd = Math.min(1440, (allMinutes.length ? Math.max(...allMinutes) : STANDARD_PERIODS[STANDARD_PERIODS.length - 1][1]) + 15);
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
    ...timedEntries.flatMap(({ effective }) => [[effective.startMinutes, effective.endMinutes]]),
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
    const dayMeetings = timedEntries.filter(({ effective }) => effective.day === day);
    if (!dayMeetings.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-day';
      empty.textContent = 'No classes';
      body.appendChild(empty);
    } else {
      for (const entry of dayMeetings) {
        const rendered = renderMeetingCard(entry, canvasStart, pixelsPerMinute, previewTheme);
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
  const courseCount = new Set(entries.map(({ meeting }) => normalizeCourseCode(meeting.courseCode))).size;
  els.summaryLabel.textContent = `${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${schedule.meetings.length} ${schedule.meetings.length === 1 ? 'meeting' : 'meetings'}`;
}

export function replaceSchedule(schedule) {
  closeCalendarExportDialog();
  setCalendarExportOpen(false);
  resetCalendarDateState();
  currentSchedule = schedule;
  els.schedulePanel.hidden = false;
  document.body.classList.add('has-schedule');
  setCustomizationOpen(false);
  const scheduleCard = els.schedulePanel.querySelector('.reveal');
  if (scheduleCard) scheduleCard.classList.add('visible');
  renderSchedule(schedule);
  setStatus('');
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  window.requestAnimationFrame(() => els.schedulePanel.scrollIntoView({ behavior, block: 'start' }));
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

function getSelectedEditorScope() {
  if (!editorContext?.hasPair) return 'meeting';
  return els.customizationScopePair.checked ? 'pair' : 'meeting';
}

function setSelectedEditorScope(scope) {
  const nextScope = scope === 'pair' && editorContext?.hasPair ? 'pair' : 'meeting';
  els.customizationScopeMeeting.checked = nextScope === 'meeting';
  els.customizationScopePair.checked = nextScope === 'pair';
  if (editorContext) editorContext.scope = nextScope;
  return nextScope;
}

function getEditorProfile() {
  return editorContext?.stagedProfile || activeProfile();
}

function getEditorMeetingOverride(profile = getEditorProfile()) {
  if (!editorContext) return null;
  const section = profile.sections?.[editorContext.sectionKey];
  const meetings = section?.meetings;
  const override = meetings?.[editorContext.resolved.meetingId];
  return override && typeof override === 'object' ? override : null;
}

function updateEditorScopeChanged() {
  if (!editorContext) return;
  editorContext.scopeChanged = editorContext.scope !== editorContext.initialScope
    || Boolean(editorContext.stagedProfile)
    || Boolean(editorContext.conflictChoice);
}

function closeSyncConflictSheet(restoreFocus = false) {
  if (!els.customizationConflictDialog) return;
  if (typeof els.customizationConflictDialog.close === 'function') {
    if (els.customizationConflictDialog.open) els.customizationConflictDialog.close();
  } else {
    els.customizationConflictDialog.hidden = true;
  }
  if (restoreFocus && editorContext) {
    const target = editorContext.scope === 'pair' ? els.customizationScopePair : els.customizationScopeMeeting;
    if (target && typeof target.focus === 'function') target.focus();
  }
}

export function closeCustomizationDialog() {
  if (!els.customizationDialog) return;
  const trigger = editorContext?.trigger;
  closeSyncConflictSheet(false);
  if (typeof els.customizationDialog.close === 'function' && els.customizationDialog.open) els.customizationDialog.close();
  else els.customizationDialog.hidden = true;
  editorContext = null;
  if (trigger && typeof trigger.focus === 'function') trigger.focus();
}

function getSelectedEditorMode() {
  return els.customizationForm.querySelector('input[name="customization-mode"]:checked')?.value || 'inherit';
}

function inferSourceMeetingMode(meeting) {
  const sourceLocation = String(meeting?.location || '').trim();
  if (meeting?.modality === 'online' || /^online$/i.test(sourceLocation)) return 'online';
  const hasScheduledTime = meeting?.scheduled !== false
    && DAY_LABELS[meeting?.day]
    && Number.isInteger(meeting?.startMinutes)
    && Number.isInteger(meeting?.endMinutes)
    && meeting.endMinutes > meeting.startMinutes;
  return hasScheduledTime ? 'f2f' : 'async';
}

function getEditorEffectiveMode() {
  const selectedMode = getSelectedEditorMode();
  return selectedMode === 'inherit' ? editorContext?.sourceMode || 'async' : selectedMode;
}

function isPhysicalRoomValue(value) {
  const normalized = String(value || '').trim();
  return /^(?:room\s+)?[A-Z]{1,6}\s*\d[A-Z0-9-]*$/i.test(normalized);
}

function formatCustomizationError(error) {
  if (error?.code !== 'MEETING_OVERLAP' || !Array.isArray(error.details?.meetings) || error.details.meetings.length < 2) {
    return error?.message || 'The class customization could not be saved.';
  }
  const [first, second] = error.details.meetings;
  const label = (meeting) => {
    const ordinal = typeof meeting.id === 'string' ? Number(meeting.id.split('::').pop()) : NaN;
    const suffix = Number.isInteger(ordinal) ? ` meeting ${ordinal + 1}` : '';
    return `${meeting.courseCode || 'Class'} ${meeting.section || ''}${suffix}`.trim();
  };
  const time = (meeting) => `${formatInputTime(meeting.startMinutes)} - ${formatInputTime(meeting.endMinutes)}`;
  const day = DAY_LABELS[error.details.day] || error.details.day || 'the same day';
  return `These changes make ${label(first)} (${time(first)}) and ${label(second)} (${time(second)}) overlap on ${day}. Adjust the Time fields or choose This meeting.`;
}

function updateEditorModePresentation() {
  if (!editorContext) return;
  const selectedMode = getSelectedEditorMode();
  const mode = getEditorEffectiveMode();
  const previousMode = editorContext.presentedMode;
  const isOnline = mode === 'online';
  const isAsync = mode === 'async';
  const crossedDeliveryBoundary = previousMode && previousMode !== mode
    && ((previousMode === 'online' && mode === 'f2f') || (previousMode === 'f2f' && mode === 'online'));
  if (crossedDeliveryBoundary) {
    els.customizationRoom.value = '';
    editorContext.changedFields.add('room');
  }
  if (selectedMode === 'inherit' && editorContext.sourceMode === 'async' && previousMode && previousMode !== 'async') {
    els.customizationDay.value = '';
    els.customizationStartTime.value = '';
    els.customizationEndTime.value = '';
    els.customizationRoom.value = '';
    editorContext.changedFields.add('time');
    editorContext.changedFields.add('room');
  }
  els.customizationForm.classList.toggle('is-online', isOnline);
  els.customizationForm.classList.toggle('is-async', isAsync);
  els.customizationRoomLabel.textContent = isOnline ? 'Platform or link' : 'Room';
  if (isOnline && isPhysicalRoomValue(els.customizationRoom.value)) {
    els.customizationRoom.value = '';
    editorContext.changedFields.add('room');
  }
  els.customizationRoom.placeholder = isOnline ? 'Optional; e.g. Zoom or a URL' : isAsync ? 'Not used for async classes' : 'e.g. G404B';
  els.customizationRoomHelp.textContent = isOnline
    ? 'Leave blank for Online. A full http:// or https:// URL is included in .ics; calendar apps decide how it appears.'
    : isAsync
      ? 'Async classes have no fixed time or room.'
      : 'Optional if the EAF does not include a room.';
  els.customizationRoom.disabled = isAsync;
  els.customizationModeHelp.textContent = selectedMode === 'inherit'
    ? `Using the EAF value: ${isOnline ? 'Online' : isAsync ? 'Async' : 'F2F'}. Saving Automatic restores all class details from the EAF.`
    : isOnline
      ? 'This meeting is online.'
      : 'This meeting is in person.';
  editorContext.presentedMode = mode;
}

function getPairStateForEditor(scope = editorContext?.scope, profile = getEditorProfile()) {
  if (!editorContext?.hasPair || !currentSchedule) return null;
  return getPairCustomizationState(currentSchedule, profile, editorContext.meeting, scope);
}

function updatePairScopePresentation() {
  if (!editorContext) return;
  const scope = getSelectedEditorScope();
  editorContext.scope = scope;
  updateEditorScopeChanged();
  const pairState = getPairStateForEditor(scope);
  if (pairState) editorContext.pairState = pairState;

  els.customizationScopeGroup.hidden = !editorContext.hasPair;
  els.customizationScopePair.disabled = !editorContext.hasPair;
  els.customizationScopeMeeting.checked = scope === 'meeting';
  els.customizationScopePair.checked = scope === 'pair';
  if (editorContext.hasPair && pairState) {
    const labels = getPairScopeLabel(pairState);
    els.customizationScopeHelp.textContent = labels.help;
    els.customizationPairStatus.textContent = labels.status;
    els.customizationPairStatus.hidden = !labels.status;
  } else {
    els.customizationScopeHelp.textContent = 'Only this meeting changes.';
    els.customizationPairStatus.textContent = '';
    els.customizationPairStatus.hidden = true;
  }
  els.customizationContext.textContent = `${editorContext.meeting.courseCode} ${editorContext.meeting.section} · ${scope === 'pair' && editorContext.hasPair ? 'Changes apply to both meetings.' : 'Only this meeting changes.'}`;
  els.customizationForm.classList.toggle('is-unsynced', scope !== 'pair');
  const stateLabel = els.customizationForm.querySelector('[data-sync-state]');
  if (stateLabel) stateLabel.textContent = editorContext.hasPair && scope === 'pair' ? 'Paired meetings' : 'This meeting';
  els.resetSectionBtn.textContent = scope === 'pair' && editorContext.hasPair ? 'Reset this pair' : 'Reset this class';
  updateEditorModePresentation();
}

function renderConflictDiff(pairState) {
  els.customizationSyncDiff.replaceChildren();
  for (const difference of pairState?.conflicts || []) {
    const formatted = formatPairFieldDifference(difference);
    const row = document.createElement('div');
    row.className = 'customization-sync-diff-row';
    const label = document.createElement('strong');
    label.className = 'customization-sync-diff-label';
    label.textContent = formatted.label;
    const current = document.createElement('span');
    current.className = 'customization-sync-diff-value';
    current.dataset.diffSide = 'current';
    current.textContent = formatted.current;
    current.setAttribute('aria-label', formatted.ariaLabel);
    const pair = document.createElement('span');
    pair.className = 'customization-sync-diff-value';
    pair.dataset.diffSide = 'pair';
    pair.textContent = formatted.pair;
    row.append(label, current, pair);
    els.customizationSyncDiff.appendChild(row);
  }
}

function openSyncConflictSheet(pairState) {
  if (!editorContext || !pairState?.hasActionableConflict) return;
  editorContext.pendingConflict = true;
  editorContext.pendingScope = 'pair';
  editorContext.requestedScope = 'pair';
  editorContext.pairState = pairState;
  setSelectedEditorScope('meeting');
  renderConflictDiff(pairState);
  const hasPeerChanges = pairState.peerOverrideFields.length > 0;
  els.customizationConflictCopy.textContent = hasPeerChanges
    ? "This meeting has its own changes. Choose which details to keep. The other meeting's separate changes will stay separate unless they are part of the fields you choose to share."
    : 'This meeting has its own changes. Choose which details to keep.';
  els.customizationConflictDialog.hidden = false;
  if (typeof els.customizationConflictDialog.showModal === 'function') els.customizationConflictDialog.showModal();
  const firstAction = els.customizationConflictDialog.querySelector('[data-sync-choice="use-pair"]');
  if (firstAction) firstAction.focus();
}

export function getPairChoiceDraftPatch(draftPatch, editorState = {}) {
  if (editorState.automaticReset || !draftPatch || typeof draftPatch !== 'object' || Array.isArray(draftPatch)) return {};
  const changedFields = editorState.changedFields instanceof Set
    ? editorState.changedFields
    : Array.isArray(editorState.changedFields) ? new Set(editorState.changedFields) : new Set();
  if (!changedFields.size) return {};
  return Object.fromEntries(Object.entries(draftPatch).filter(([field]) => changedFields.has(field)));
}

function getMeetingDraftPatchForPairChoice() {
  if (!editorContext) return {};
  const draftPatch = editorContext.automaticReset ? {} : readCustomizationPatch(editorContext.changedFields);
  return getPairChoiceDraftPatch(draftPatch, editorContext);
}

function getMergedMeetingPatch(profile, patch) {
  const override = getEditorMeetingOverride(profile);
  if (!override || override.automatic === true) return { ...patch };
  const merged = {};
  for (const [key, value] of Object.entries(override)) {
    if (key !== 'synced' && key !== 'automatic') merged[key] = value;
  }
  return { ...merged, ...patch };
}

function getIndependentDraftProfile() {
  const profile = getEditorProfile();
  if (editorContext.automaticReset) {
    return {
      profile: setMeetingAutomaticOverride(
        profile,
        editorContext.meeting.courseCode,
        editorContext.meeting.section,
        editorContext.resolved.meetingId,
      ),
      patch: {},
    };
  }
  if (!editorContext.changedFields.size) return { profile, patch: {} };
  const patch = getMeetingDraftPatchForPairChoice();
  const merged = getMergedMeetingPatch(profile, patch);
  return {
    profile: setMeetingCustomization(
      profile,
      editorContext.meeting.courseCode,
      editorContext.meeting.section,
      editorContext.resolved.meetingId,
      merged,
    ),
    patch,
  };
}

export function openCustomizationDialog(meeting, trigger = null) {
  if (!currentSchedule || !meeting) return;
  const profile = activeProfile();
  const sectionKey = getSectionKey(meeting.courseCode, meeting.section);
  const resolved = getResolvedMeeting(meeting, currentSchedule, profile);
  const storedColor = profile.courses?.[getCourseKey(meeting.courseCode)]?.color;
  const storedSection = profile.sections?.[sectionKey] || {};
  const pairCount = currentSchedule.meetings.filter((entry) => getSectionKey(entry.courseCode, entry.section) === sectionKey).length;
  const hasPair = pairCount > 1;
  const storedMeeting = storedSection.meetings?.[resolved.meetingId];
  const initialScope = hasPair && !storedMeeting ? 'pair' : 'meeting';
  editorContext = {
    meeting,
    trigger,
    sectionKey,
    resolved,
    hasPair,
    sourceMode: inferSourceMeetingMode(meeting),
    presentedMode: null,
    scope: initialScope,
    initialScope,
    requestedScope: initialScope,
    pairState: null,
    pendingConflict: false,
    pendingScope: null,
    scopeChanged: false,
    conflictChoice: null,
    stagedProfile: null,
    automaticReset: false,
    usingAutomaticEntry: Boolean(storedMeeting?.automatic),
    changedFields: new Set(),
    draftColor: storedColor || resolved.palette.id || resolved.palette.swatch,
    colorChanged: false,
  };
  setSelectedEditorScope(initialScope);
  els.customizationCourseCode.value = resolved.courseCode || '';
  els.customizationSection.value = resolved.section || '';
  els.customizationTitle.value = resolved.title || '';
  els.customizationDay.value = resolved.day || '';
  els.customizationStartTime.value = formatInputTime(resolved.startMinutes);
  els.customizationEndTime.value = formatInputTime(resolved.endMinutes);
  els.customizationRoom.value = resolved.location || '';
  els.customizationProfessor.value = resolved.professor || '';
  const mode = storedMeeting?.automatic ? 'inherit' : storedMeeting?.mode || storedSection.mode || 'inherit';
  els.customizationForm.querySelectorAll('input[name="customization-mode"]').forEach((radio) => {
    radio.checked = radio.value === mode;
  });
  updatePairScopePresentation();
  setCustomizationValidation('');
  els.customizationMoreDetails.open = Boolean(resolved.professor);
  renderEditorPaletteOptions();
  setEditorDraftColor(editorContext.draftColor, false);
  if (typeof els.customizationDialog.showModal === 'function') els.customizationDialog.showModal();
  else els.customizationDialog.hidden = false;
  const initialFocus = els.customizationCourseCode || els.cancelCustomizationBtn;
  initialFocus.focus();
}

function formatInputTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return '';
  const hours24 = Math.floor(minutes / 60);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes % 60).padStart(2, '0')} ${period}`;
}

function parseInputTime(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  const twelveHour = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/.exec(normalized);
  if (twelveHour) {
    const hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    if (hours < 1 || hours > 12) return null;
    const hours24 = hours % 12 + (twelveHour[3] === 'PM' ? 12 : 0);
    return hours24 * 60 + minutes;
  }
  const twentyFourHour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalized);
  if (!twentyFourHour) return null;
  return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);
}

function setCustomizationValidation(message, focusElement = null) {
  els.customizationValidation.textContent = message;
  els.customizationValidation.hidden = !message;
  if (message && focusElement) focusElement.focus();
}

function setEditorDetailsFromResolved(resolved, mode = 'inherit') {
  els.customizationCourseCode.value = resolved.courseCode || '';
  els.customizationSection.value = resolved.section || '';
  els.customizationTitle.value = resolved.title || '';
  els.customizationDay.value = resolved.day || '';
  els.customizationStartTime.value = formatInputTime(resolved.startMinutes);
  els.customizationEndTime.value = formatInputTime(resolved.endMinutes);
  els.customizationRoom.value = resolved.location || '';
  els.customizationProfessor.value = resolved.professor || '';
  els.customizationForm.querySelectorAll('input[name="customization-mode"]').forEach((radio) => {
    radio.checked = radio.value === mode;
  });
  updateEditorModePresentation();
}

function restoreEditorFromEaf() {
  if (!editorContext) return;
  const resolved = getEafResolvedMeeting(editorContext.meeting, getEditorProfile());
  editorContext.resolved = resolved;
  editorContext.presentedMode = null;
  editorContext.automaticReset = true;
  editorContext.usingAutomaticEntry = true;
  editorContext.changedFields = new Set();
  setEditorDetailsFromResolved(resolved, 'inherit');
}

function cancelSyncConflict() {
  if (!editorContext) return;
  editorContext.pendingConflict = false;
  editorContext.pendingScope = null;
  editorContext.requestedScope = 'meeting';
  setSelectedEditorScope('meeting');
  editorContext.pairState = getPairStateForEditor('meeting', activeProfile());
  closeSyncConflictSheet(false);
  updatePairScopePresentation();
  els.customizationScopeMeeting.focus();
}

function handleSyncConflictChoice(choice) {
  if (!editorContext?.pendingConflict) return;
  if (choice === 'cancel') {
    cancelSyncConflict();
    return;
  }
  try {
    const draftPatch = choice === 'use-current-for-pair' ? getMeetingDraftPatchForPairChoice() : {};
    const next = applySyncConflictChoice(activeProfile(), {
      schedule: currentSchedule,
      selectedMeeting: editorContext.meeting,
      pairState: editorContext.pairState,
      draftPatch,
      changedFields: editorContext.changedFields,
    }, choice);
    validateEffectiveProfile(next);
    editorContext.stagedProfile = next;
    editorContext.conflictChoice = choice;
    editorContext.scope = 'pair';
    editorContext.requestedScope = 'pair';
    editorContext.pendingConflict = false;
    editorContext.pendingScope = null;
    editorContext.automaticReset = false;
    editorContext.usingAutomaticEntry = false;
    editorContext.changedFields.clear();
    if (choice === 'use-pair') {
      editorContext.resolved = getResolvedMeeting(editorContext.meeting, currentSchedule, next);
      editorContext.presentedMode = null;
      const section = next.sections?.[editorContext.sectionKey] || {};
      const override = section.meetings?.[editorContext.resolved.meetingId];
      const mode = override?.automatic ? 'inherit' : override?.mode || section.mode || 'inherit';
      setEditorDetailsFromResolved(editorContext.resolved, mode);
    } else {
      editorContext.resolved = getResolvedMeeting(editorContext.meeting, currentSchedule, next);
    }
    setSelectedEditorScope('pair');
    closeSyncConflictSheet(false);
    updatePairScopePresentation();
    els.customizationScopePair.focus();
  } catch (error) {
    const message = formatCustomizationError(error);
    editorContext.pendingConflict = false;
    editorContext.pendingScope = null;
    editorContext.requestedScope = 'meeting';
    setSelectedEditorScope('meeting');
    closeSyncConflictSheet(false);
    updatePairScopePresentation();
    setCustomizationValidation(message, error.focusElement || null);
    setProfileStatus(message, 'error');
  }
}

function handleEditorScopeChange(scope) {
  if (!editorContext || !editorContext.hasPair) return;
  const previousScope = editorContext.scope;
  if (scope === previousScope) {
    updatePairScopePresentation();
    return;
  }
  editorContext.requestedScope = scope;
  if (scope === 'meeting') {
    if (editorContext.stagedProfile) {
      editorContext.stagedProfile = null;
      editorContext.conflictChoice = null;
      editorContext.pairState = null;
    }
    editorContext.pendingConflict = false;
    editorContext.pendingScope = null;
    setSelectedEditorScope('meeting');
    updatePairScopePresentation();
    els.customizationScopeMeeting.focus();
    return;
  }

  try {
    const draft = getIndependentDraftProfile();
    const pairState = getPairCustomizationState(currentSchedule, draft.profile, editorContext.meeting, 'meeting');
    if (pairState.hasActionableConflict) {
      setSelectedEditorScope('meeting');
      openSyncConflictSheet(pairState);
      return;
    }
    editorContext.scope = 'pair';
    editorContext.pairState = { ...pairState, scope: 'pair' };
    setSelectedEditorScope('pair');
    updatePairScopePresentation();
    els.customizationScopePair.focus();
  } catch (error) {
    const message = formatCustomizationError(error);
    editorContext.requestedScope = previousScope;
    setSelectedEditorScope(previousScope);
    updatePairScopePresentation();
    setCustomizationValidation(message, error.focusElement || null);
    setProfileStatus(message, 'error');
  }
}

function readManualTime() {
  const day = els.customizationDay.value;
  const startMinutes = parseInputTime(els.customizationStartTime.value);
  const endMinutes = parseInputTime(els.customizationEndTime.value);
  const hasAnyValue = Boolean(day || els.customizationStartTime.value || els.customizationEndTime.value);
  if (!hasAnyValue) return null;
  if (!day) {
    const error = new Error('Choose a day for the manual time slot.');
    error.focusElement = els.customizationDay;
    throw error;
  }
  if (startMinutes === null) {
    const error = new Error('Enter a valid start time for the manual time slot.');
    error.focusElement = els.customizationStartTime;
    throw error;
  }
  if (endMinutes === null) {
    const error = new Error('Enter a valid end time for the manual time slot.');
    error.focusElement = els.customizationEndTime;
    throw error;
  }
  if (endMinutes <= startMinutes) {
    const error = new Error('The end time must be after the start time.');
    error.focusElement = els.customizationEndTime;
    throw error;
  }
  return { day, startMinutes, endMinutes };
}

function readCustomizationPatch(changedFields = null) {
  const include = (field) => !changedFields || changedFields.has(field);
  const selectedMode = getSelectedEditorMode();
  const effectiveMode = selectedMode === 'inherit' ? editorContext?.sourceMode || 'async' : selectedMode;
  const mode = include('mode') ? selectedMode : null;
  const time = include('time') ? readManualTime() : null;
  if (time && editorContext?.sourceMode === 'async' && selectedMode === 'inherit') {
    const error = new Error('Choose F2F or Online when adding a time to an async class.');
    error.focusElement = els.customizationForm.querySelector('input[name="customization-mode"][value="f2f"]');
    throw error;
  }
  if (editorContext?.sourceMode === 'async' && selectedMode !== 'inherit' && !time) {
    const existingManualTime = !include('time') && editorContext.resolved?.scheduled;
    if (!existingManualTime) {
      const error = new Error('Add a day, start time, and end time for F2F or Online, or choose Automatic to keep this class async.');
      error.focusElement = els.customizationDay;
      throw error;
    }
  }
  const roomValue = els.customizationRoom.value.trim();
  if (effectiveMode === 'f2f' && /^online$/i.test(roomValue)) {
    const error = new Error('F2F classes cannot use Online as a room. Leave Room blank or enter a physical room, or choose Online delivery.');
    error.focusElement = els.customizationRoom;
    throw error;
  }
  if (effectiveMode === 'online' && isPhysicalRoomValue(roomValue)) {
    const error = new Error('Online classes use a platform or link, not a physical room. Leave it blank to show Online or enter the platform.');
    error.focusElement = els.customizationRoom;
    throw error;
  }
  const patch = {};
  if (include('courseCode')) patch.courseCode = els.customizationCourseCode.value;
  if (include('section')) patch.section = els.customizationSection.value;
  if (include('title')) patch.title = els.customizationTitle.value;
  if (include('time')) patch.time = time;
  if (include('room')) patch.room = els.customizationRoom.value;
  if (include('professor')) patch.professor = els.customizationProfessor.value;
  if (include('mode')) patch.mode = mode === 'inherit' ? null : mode;
  return patch;
}

function validateEffectiveProfile(profile) {
  if (!currentSchedule) return;
  const effectiveMeetings = resolveScheduleEntries(currentSchedule, profile)
    .filter((entry) => entry.resolved.scheduled)
    .map((entry) => entry.effective);
  validateNoOverlaps(effectiveMeetings);
}

function saveCustomizationDraft(event) {
  event.preventDefault();
  if (!editorContext) return;
  const hex = normalizeHexColor(els.customizationHex.value);
  if (!hex) {
    els.customizationHex.classList.add('invalid');
    const message = 'Enter a valid 3- or 6-digit hex color, such as #3B82F6.';
    setCustomizationValidation(message, els.customizationHex);
    setProfileStatus(message, 'error');
    return;
  }
  if (hex && editorContext.draftColor?.startsWith('#')) editorContext.draftColor = hex;
  try {
    const scope = getSelectedEditorScope();
    const syncPair = Boolean(editorContext.hasPair && scope === 'pair');
    const shouldRejoinPair = syncPair
      && editorContext.initialScope === 'meeting'
      && !editorContext.stagedProfile
      && !editorContext.conflictChoice
      && !editorContext.automaticReset;
    const hasPersistableChange = editorContext.changedFields.size > 0
      || editorContext.colorChanged
      || editorContext.automaticReset
      || Boolean(editorContext.stagedProfile)
      || Boolean(editorContext.conflictChoice)
      || shouldRejoinPair;
    if (!hasPersistableChange) {
      closeCustomizationDialog();
      return;
    }
    let next = editorContext.stagedProfile || activeProfile();
    if (editorContext.colorChanged) next = setCourseColor(next, editorContext.meeting.courseCode, editorContext.draftColor);
    let statusMessage = syncPair ? 'Paired meeting changes saved.' : "This meeting's changes saved.";
    if (editorContext.automaticReset) {
      if (syncPair || !editorContext.hasPair) {
        if (syncPair) {
          next = resetMeetingCustomization(
            next,
            editorContext.meeting.courseCode,
            editorContext.meeting.section,
            editorContext.resolved.meetingId,
          );
          next = resetSectionDefaults(next, editorContext.meeting.courseCode, editorContext.meeting.section);
        } else {
          next = resetSectionCustomization(next, editorContext.meeting.courseCode, editorContext.meeting.section);
        }
      } else {
        next = setMeetingAutomaticOverride(
          next,
          editorContext.meeting.courseCode,
          editorContext.meeting.section,
          editorContext.resolved.meetingId,
        );
      }
      statusMessage = syncPair ? 'Paired class details restored from the EAF.' : 'Class details restored from the EAF.';
    } else {
      if (syncPair) {
        const patch = readCustomizationPatch(editorContext.changedFields);
        if (Object.keys(patch).length) {
          next = setSectionCustomization(next, editorContext.meeting.courseCode, editorContext.meeting.section, patch);
          next = resetMeetingCustomization(next, editorContext.meeting.courseCode, editorContext.meeting.section, editorContext.resolved.meetingId);
        } else if (shouldRejoinPair) {
          next = resetMeetingCustomization(next, editorContext.meeting.courseCode, editorContext.meeting.section, editorContext.resolved.meetingId);
        }
      } else if (editorContext.changedFields.size) {
        const patch = readCustomizationPatch(editorContext.changedFields);
        const mergedPatch = getMergedMeetingPatch(next, patch);
        next = setMeetingCustomization(
          next,
          editorContext.meeting.courseCode,
          editorContext.meeting.section,
          editorContext.resolved.meetingId,
          mergedPatch,
        );
      }
    }
    if (editorContext.conflictChoice === 'use-pair' && !editorContext.changedFields.size && !editorContext.colorChanged) {
      statusMessage = 'This meeting now follows the pair settings.';
    }
    validateEffectiveProfile(next);
    persistStore({
      ...profileStore,
      profiles: profileStore.profiles.map((entry) => entry.id === profileStore.activeProfileId ? { ...entry, profile: next } : entry),
    }, statusMessage);
    closeCustomizationDialog();
  } catch (error) {
    const message = formatCustomizationError(error);
    setCustomizationValidation(message, error.focusElement || null);
    setProfileStatus(message, 'error');
  }
}

function resetEditorSection() {
  if (!editorContext) return;
  try {
    const syncPair = Boolean(editorContext.hasPair && getSelectedEditorScope() === 'pair');
    let baseProfile = editorContext.stagedProfile || activeProfile();
    let profile;
    if (syncPair) {
      profile = resetMeetingCustomization(baseProfile, editorContext.meeting.courseCode, editorContext.meeting.section, editorContext.resolved.meetingId);
      profile = resetSectionDefaults(profile, editorContext.meeting.courseCode, editorContext.meeting.section);
    } else if (!editorContext.hasPair) {
      profile = resetSectionCustomization(baseProfile, editorContext.meeting.courseCode, editorContext.meeting.section);
    } else {
      profile = resetMeetingCustomization(baseProfile, editorContext.meeting.courseCode, editorContext.meeting.section, editorContext.resolved.meetingId);
    }
    validateEffectiveProfile(profile);
    persistStore({
      ...profileStore,
      profiles: profileStore.profiles.map((entry) => entry.id === profileStore.activeProfileId ? { ...entry, profile } : entry),
    }, syncPair ? 'Shared pair details reset.' : editorContext.hasPair ? 'This class is synced with its pair again.' : 'Class details reset.');
    closeCustomizationDialog();
  } catch (error) {
    const message = formatCustomizationError(error);
    setCustomizationValidation(message);
    setProfileStatus(message, 'error');
  }
}

function initCustomizationDialog() {
  els.customizationForm.addEventListener('submit', saveCustomizationDraft);
  const detailFieldNames = new Map([
    ['customization-course-code', 'courseCode'],
    ['customization-section', 'section'],
    ['customization-title', 'title'],
    ['customization-day', 'time'],
    ['customization-start-time', 'time'],
    ['customization-end-time', 'time'],
    ['customization-room', 'room'],
    ['customization-professor', 'professor'],
  ]);
  const markSyncEditDirty = (event) => {
    if (!editorContext) return;
    if (event.target.name === 'customization-scope') return;
    const isModeEvent = event.target.name === 'customization-mode';
    const selectsAutomatic = isModeEvent && event.target.value === 'inherit';
    if (editorContext.automaticReset && (!isModeEvent || !selectsAutomatic)) {
      editorContext.automaticReset = false;
      editorContext.changedFields.clear();
    }
    const fieldName = isModeEvent
      ? 'mode'
      : detailFieldNames.get(event.target.id);
    if (fieldName) editorContext.changedFields.add(fieldName);
  };
  els.customizationForm.addEventListener('input', markSyncEditDirty);
  els.customizationForm.addEventListener('change', (event) => {
    markSyncEditDirty(event);
    if (event.target.name === 'customization-mode') {
      if (event.target.value === 'inherit') restoreEditorFromEaf();
      updateEditorModePresentation();
    }
  });
  els.cancelCustomizationBtn.addEventListener('click', closeCustomizationDialog);
  els.resetSectionBtn.addEventListener('click', resetEditorSection);
  els.customizationScopeMeeting.addEventListener('change', () => handleEditorScopeChange('meeting'));
  els.customizationScopePair.addEventListener('change', () => handleEditorScopeChange('pair'));
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
  els.customizationConflictForm.addEventListener('submit', (event) => event.preventDefault());
  els.customizationConflictForm.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-sync-choice]');
    if (action) handleSyncConflictChoice(action.dataset.syncChoice);
  });
  els.customizationConflictDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancelSyncConflict();
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
  els.customizeProfileToggle.addEventListener('click', () => {
    setCustomizationOpen(els.configurationPanel.hidden, true);
  });
  els.hideCustomizationBtn.addEventListener('click', () => {
    setCustomizationOpen(false);
    els.customizeProfileToggle.focus();
  });
  els.downloadPngBtn.addEventListener('click', () => {
    if (!currentSchedule) return;
    downloadSchedulePng(currentSchedule, { showCourseTitles, profile: activeProfile(), theme: getPngTheme() })
      .catch(() => setStatus('The PNG could not be generated. Please try again.', 'error'));
  });
  els.profileSelect.addEventListener('change', () => handleProfileSelection(els.profileSelect.value));
  els.newProfileBtn.addEventListener('click', handleNewProfile);
  els.quickImportCustomizationBtn.addEventListener('click', () => els.customizationFile.click());
  els.importCustomizationBtn.addEventListener('click', () => els.customizationFile.click());
  els.customizationFile.addEventListener('change', () => handleCustomizationFile(els.customizationFile.files?.[0]));
  els.downloadCustomizationBtn.addEventListener('click', downloadCustomization);
  els.renameProfileBtn.addEventListener('click', handleProfileRename);
  els.deleteProfileBtn.addEventListener('click', handleProfileDelete);
  els.resetColorsBtn.addEventListener('click', () => handleProfileReset('colors'));
  els.resetDetailsBtn.addEventListener('click', () => handleProfileReset('details'));
  els.resetEverythingBtn.addEventListener('click', () => handleProfileReset('all'));
  const pngThemeMenu = document.getElementById('png-theme-menu');
  const pngThemeLabel = document.getElementById('png-theme-label');
  const pngThemeButtons = document.querySelectorAll('#png-theme-options button');
  pngThemeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.themeValue;
      if (els.pngThemeSelect) {
        els.pngThemeSelect.value = val;
        els.pngThemeSelect.dispatchEvent(new Event('change'));
      }
      pngThemeButtons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      if (pngThemeLabel) pngThemeLabel.textContent = btn.textContent;
      if (pngThemeMenu) pngThemeMenu.open = false;
    });
  });

  document.addEventListener('click', (event) => {
    document.querySelectorAll('.custom-select-menu[open], .reset-menu[open]').forEach((menu) => {
      if (!menu.contains(event.target)) {
        menu.open = false;
      }
    });
  });

  window.addEventListener('resize', () => fitTimetablePreview(), { passive: true });
  window.addEventListener('animosort:theme-change', () => { if (currentSchedule) renderSchedule(currentSchedule); });
  resetScheduleView();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp, { once: true });
  else initApp();
}
