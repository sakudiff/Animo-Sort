import { DAY_ORDER } from './eaf-parser.js';
import {
  formatMeetingMetadataLines,
  normalizeCourseCode,
  normalizeSection,
  resolveMeetingCustomization,
} from './customization.js';

const CALENDAR_TIMEZONE = 'Asia/Manila';
const MANILA_OFFSET_MINUTES = 8 * 60;
const ICAL_LINE_LIMIT = 75;
const DAY_LABELS = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};

export class CalendarExportError extends Error {
  constructor(code, message, details = null, cause = undefined) {
    super(message);
    this.name = 'CalendarExportError';
    this.code = code;
    this.details = details;
    if (cause !== undefined) this.cause = cause;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyDateValue(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function invalidDate() {
  return new CalendarExportError('INVALID_DATE', 'Enter a valid calendar date.');
}

function createUtcDate(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function parseCalendarDate(value) {
  if (typeof value !== 'string') throw invalidDate();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw invalidDate();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = createUtcDate(year, month, day);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw invalidDate();
  }
  return date;
}

export function validateDateRange(range) {
  if (!isRecord(range)) throw new CalendarExportError('MISSING_DATE', 'Enter both term dates.');
  const startValue = range.startDate;
  const endValue = range.endDate;
  if (isEmptyDateValue(startValue) || isEmptyDateValue(endValue)) {
    throw new CalendarExportError('MISSING_DATE', 'Enter both term dates.');
  }
  const start = parseCalendarDate(startValue);
  const end = parseCalendarDate(endValue);
  if (end < start) {
    throw new CalendarExportError('END_BEFORE_START', 'The term end date must be on or after the term start date.');
  }
  return { startDate: startValue, endDate: endValue, start, end };
}

function ensureDate(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw invalidDate();
  return createUtcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function getDayNumber(dayCode) {
  const normalized = typeof dayCode === 'string' ? dayCode.trim().toUpperCase() : '';
  const dayIndex = DAY_ORDER.indexOf(normalized);
  if (dayIndex === -1) {
    throw new CalendarExportError('UNSUPPORTED_DAY', 'The schedule contains a day outside Monday through Saturday.', { day: dayCode });
  }
  return dayIndex + 1;
}

export function getFirstOccurrenceDate(startDate, dayCode) {
  const date = ensureDate(startDate);
  const targetDay = getDayNumber(dayCode);
  const distance = (targetDay - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + distance);
  return date;
}

export function getLastOccurrenceDate(endDate, dayCode) {
  const date = ensureDate(endDate);
  const targetDay = getDayNumber(dayCode);
  const distance = (date.getUTCDay() - targetDay + 7) % 7;
  date.setUTCDate(date.getUTCDate() - distance);
  return date;
}

function formatDate(date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatIcsDate(date) {
  return formatDate(date).replaceAll('-', '');
}

function formatIcsTime(minutes, seconds = 0) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}${String(remainder).padStart(2, '0')}${String(seconds).padStart(2, '0')}`;
}

function formatTimeLabel(minutes) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
}

function formatLocalTimestamp(date, minutes) {
  return `${formatIcsDate(date)}T${formatIcsTime(minutes)}`;
}

function formatUtcTimestamp(date) {
  return `${formatIcsDate(date)}T${formatIcsTime(date.getUTCHours() * 60 + date.getUTCMinutes(), date.getUTCSeconds())}Z`;
}

function formatUntilTimestamp(date, endMinutes) {
  const end = new Date(date.getTime());
  end.setUTCMinutes(endMinutes);
  end.setTime(end.getTime() - MANILA_OFFSET_MINUTES * 60 * 1000);
  return formatUtcTimestamp(end);
}

function validateMeeting(meeting) {
  if (!isRecord(meeting)) {
    throw new CalendarExportError('INVALID_SCHEDULE', 'A valid schedule with meetings is required.');
  }
  if (
    typeof meeting.courseCode !== 'string'
    || !normalizeCourseCode(meeting.courseCode)
    || typeof meeting.title !== 'string'
    || !meeting.title.trim()
    || typeof meeting.section !== 'string'
    || !normalizeSection(meeting.section)
  ) {
    throw new CalendarExportError('INVALID_SCHEDULE', 'A schedule meeting is missing required course information.');
  }
  getDayNumber(meeting.day);
  if (
    !Number.isInteger(meeting.startMinutes)
    || !Number.isInteger(meeting.endMinutes)
    || meeting.startMinutes < 0
    || meeting.endMinutes > 1439
    || meeting.endMinutes <= meeting.startMinutes
  ) {
    throw new CalendarExportError('INVALID_SCHEDULE', 'A schedule meeting has an invalid time interval.');
  }
  return meeting;
}

function validateSchedule(schedule) {
  if (!isRecord(schedule) || !Array.isArray(schedule.meetings) || schedule.meetings.length === 0) {
    throw new CalendarExportError('INVALID_SCHEDULE', 'A valid schedule with meetings is required.');
  }
  if (schedule.session !== undefined && typeof schedule.session !== 'string') {
    throw new CalendarExportError('INVALID_SCHEDULE', 'A schedule session must be text.');
  }
  schedule.meetings.forEach(validateMeeting);
  return schedule;
}

function validateProfile(profile) {
  if (!isRecord(profile)) {
    throw new CalendarExportError('INVALID_PROFILE', 'A valid customization profile is required.');
  }
  if (profile.defaults !== undefined && !isRecord(profile.defaults)) {
    throw new CalendarExportError('INVALID_PROFILE', 'A customization profile has invalid defaults.');
  }
  if (profile.courses !== undefined && !isRecord(profile.courses)) {
    throw new CalendarExportError('INVALID_PROFILE', 'A customization profile has invalid course values.');
  }
  if (profile.sections !== undefined && !isRecord(profile.sections)) {
    throw new CalendarExportError('INVALID_PROFILE', 'A customization profile has invalid section values.');
  }
  return profile;
}

function validateTimestamp(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new CalendarExportError('INVALID_TIMESTAMP', 'The calendar timestamp is invalid.');
  }
  return date;
}

function normalizedIdentitySegment(value, fallback = 'unknown') {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function createEventUid(schedule, meeting, range, index) {
  const components = [
    normalizedIdentitySegment(schedule.session, 'calendar'),
    normalizedIdentitySegment(normalizeCourseCode(meeting.courseCode)),
    normalizedIdentitySegment(normalizeSection(meeting.section)),
    normalizedIdentitySegment(meeting.day),
    normalizedIdentitySegment(meeting.startMinutes),
    normalizedIdentitySegment(meeting.endMinutes),
    normalizedIdentitySegment(range.startDate),
    normalizedIdentitySegment(range.endDate),
    normalizedIdentitySegment(index, 'meeting'),
  ];
  return `${components.join('-')}@animosort`;
}

function resolveRange(range) {
  if (isRecord(range) && range.start instanceof Date && range.end instanceof Date) {
    return {
      startDate: range.startDate,
      endDate: range.endDate,
      start: ensureDate(range.start),
      end: ensureDate(range.end),
    };
  }
  return validateDateRange(range);
}

export function resolveCalendarEvent(meeting, schedule, profile, range, index = 0) {
  validateMeeting(meeting);
  if (!isRecord(schedule)) {
    throw new CalendarExportError('INVALID_SCHEDULE', 'A valid schedule is required.');
  }
  validateProfile(profile);
  const validatedRange = resolveRange(range);
  const firstDate = getFirstOccurrenceDate(validatedRange.start, meeting.day);
  if (firstDate > validatedRange.end) return null;
  const lastDate = getLastOccurrenceDate(validatedRange.end, meeting.day);
  const resolved = resolveMeetingCustomization(profile, meeting, index);
  const metadata = formatMeetingMetadataLines(meeting, resolved);
  const time = metadata.time || `Time: ${formatTimeLabel(meeting.startMinutes)} - ${formatTimeLabel(meeting.endMinutes)}`;
  const descriptionLines = [
    metadata.professor,
    `Mode: ${resolved.mode === 'online' ? 'Online' : 'F2F'}`,
    `Day: ${DAY_LABELS[meeting.day]}`,
    time,
  ];
  if (typeof schedule.session === 'string' && schedule.session.trim()) {
    descriptionLines.push(`Academic session: ${schedule.session.trim()}`);
  }
  const physicalLocation = String(meeting.expandedLocation || meeting.location || 'Room not specified').trim() || 'Room not specified';
  return {
    uid: createEventUid(schedule, meeting, validatedRange, index),
    dtstamp: null,
    dtstart: formatLocalTimestamp(firstDate, meeting.startMinutes),
    dtend: formatLocalTimestamp(firstDate, meeting.endMinutes),
    until: formatUntilTimestamp(lastDate, meeting.endMinutes),
    summary: `${meeting.courseCode} ${meeting.section} - ${meeting.title}`,
    location: resolved.mode === 'online' ? 'Online' : physicalLocation,
    description: descriptionLines.filter(Boolean).join('\n'),
    firstOccurrenceDate: firstDate,
    lastOccurrenceDate: lastDate,
  };
}

export function escapeIcsText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function utf8Length(value) {
  return new TextEncoder().encode(value).length;
}

export function foldIcsLine(line) {
  const value = line === null || line === undefined ? '' : String(line);
  if (!value) return [''];
  const folded = [];
  let current = '';
  let limit = ICAL_LINE_LIMIT;
  for (const character of value) {
    if (current && utf8Length(`${current}${character}`) > limit) {
      folded.push(current);
      current = character;
      limit = ICAL_LINE_LIMIT - 1;
    } else {
      current += character;
    }
  }
  if (current) folded.push(current);
  return folded.map((part, index) => index === 0 ? part : ` ${part}`);
}

function formatCalendarFilename(session) {
  const normalized = normalizedIdentitySegment(session, '');
  return normalized ? `animosort-${normalized}.ics` : 'animosort-calendar.ics';
}

function serializeEvent(event, dtstamp) {
  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${CALENDAR_TIMEZONE}:${event.dtstart}`,
    `DTEND;TZID=${CALENDAR_TIMEZONE}:${event.dtend}`,
    `RRULE:FREQ=WEEKLY;UNTIL=${event.until}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    'END:VEVENT',
  ];
}

export function formatIcsCalendar(schedule, profile, range, options = {}) {
  const validatedSchedule = validateSchedule(schedule);
  validateProfile(profile);
  const validatedRange = validateDateRange(range);
  const timestampValue = isRecord(options) && options.now !== undefined ? options.now : new Date();
  const dtstamp = formatUtcTimestamp(validateTimestamp(timestampValue));
  const events = [];
  let skippedCount = 0;
  for (const [index, meeting] of validatedSchedule.meetings.entries()) {
    const event = resolveCalendarEvent(meeting, validatedSchedule, profile, validatedRange, index);
    if (!event) {
      skippedCount += 1;
      continue;
    }
    events.push(event);
  }
  if (!events.length) {
    throw new CalendarExportError('NO_EVENTS_IN_RANGE', 'No classes occur between those dates. Choose a wider term range.', { skippedCount });
  }
  const session = typeof validatedSchedule.session === 'string' ? validatedSchedule.session.trim() : '';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AnimoSort//Google Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(session || 'AnimoSort calendar')}`,
  ];
  for (const event of events) lines.push(...serializeEvent(event, dtstamp));
  lines.push('END:VCALENDAR');
  const icsText = lines.flatMap(foldIcsLine).join('\r\n') + '\r\n';
  return {
    filename: formatCalendarFilename(session),
    icsText,
    exportedCount: events.length,
    skippedCount,
  };
}

export function downloadCalendarFile(result) {
  if (!isRecord(result) || typeof result.icsText !== 'string' || typeof result.filename !== 'string') {
    throw new CalendarExportError('DOWNLOAD_FAILED', 'The calendar file could not be downloaded. Please try again.');
  }
  const browserUrl = globalThis.URL;
  if (
    typeof globalThis.Blob !== 'function'
    || !browserUrl
    || typeof browserUrl.createObjectURL !== 'function'
    || typeof browserUrl.revokeObjectURL !== 'function'
    || typeof document === 'undefined'
    || !document.body
    || typeof document.createElement !== 'function'
  ) {
    throw new CalendarExportError('DOWNLOAD_FAILED', 'The calendar file could not be downloaded. Please try again.');
  }
  let objectUrl = null;
  let link = null;
  try {
    const blob = new Blob([result.icsText], { type: 'text/calendar;charset=utf-8' });
    objectUrl = browserUrl.createObjectURL(blob);
    link = document.createElement('a');
    link.href = objectUrl;
    link.download = result.filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
  } catch (cause) {
    throw new CalendarExportError('DOWNLOAD_FAILED', 'The calendar file could not be downloaded. Please try again.', null, cause);
  } finally {
    if (objectUrl) browserUrl.revokeObjectURL(objectUrl);
    if (link) {
      if (typeof link.remove === 'function') link.remove();
      else if (link.parentNode) link.parentNode.removeChild(link);
    }
  }
}
