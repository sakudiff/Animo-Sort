import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CalendarExportError,
  escapeIcsText,
  foldIcsLine,
  formatIcsCalendar,
  getFirstOccurrenceDate,
  getLastOccurrenceDate,
  parseCalendarDate,
  validateDateRange,
} from '../assets/js/calendar.js';
import {
  createProfile,
  setSectionCustomization,
} from '../assets/js/customization.js';

function meeting(overrides = {}) {
  return {
    courseCode: 'STSP002',
    title: 'SPECIAL TOPICS',
    section: 'S30A',
    day: 'MON',
    startMinutes: 555,
    endMinutes: 645,
    startLabel: '09:15 AM',
    endLabel: '10:45 AM',
    location: 'G404B',
    expandedLocation: 'G404B · Gokongwei Hall',
    modality: 'room',
    ...overrides,
  };
}

function schedule(meetings = [meeting()], session = 'AY 2026-2027 · Term 1') {
  return { session, meetings };
}

function dateValue(date) {
  return date.toISOString().slice(0, 10);
}

test('validates ISO dates and rejects impossible or reversed ranges', () => {
  assert.equal(dateValue(parseCalendarDate('2026-08-19')), '2026-08-19');
  assert.deepEqual(validateDateRange({ startDate: '2026-08-19', endDate: '2026-12-15' }).startDate, '2026-08-19');
  assert.throws(() => parseCalendarDate('2026-02-30'), (error) => error.code === 'INVALID_DATE');
  assert.throws(() => validateDateRange({ startDate: '2026-12-15', endDate: '2026-08-19' }), (error) => error.code === 'END_BEFORE_START');
  assert.throws(() => validateDateRange({ startDate: '', endDate: '2026-08-19' }), (error) => error.code === 'MISSING_DATE');
});

test('finds inclusive matching weekdays across partial term weeks', () => {
  const start = parseCalendarDate('2026-08-19'); // Wednesday
  const end = parseCalendarDate('2026-12-15'); // Tuesday

  assert.equal(dateValue(getFirstOccurrenceDate(start, 'MON')), '2026-08-24');
  assert.equal(dateValue(getFirstOccurrenceDate(start, 'WED')), '2026-08-19');
  assert.equal(dateValue(getLastOccurrenceDate(end, 'MON')), '2026-12-14');
  assert.equal(dateValue(getLastOccurrenceDate(end, 'WED')), '2026-12-09');
});

test('serializes weekly Manila events with range-trimmed UTC UNTIL values', () => {
  let profile = createProfile('Calendar profile');
  profile = setSectionCustomization(profile, 'STSP002', 'S30A', {
    mode: 'online',
    professor: 'Professor Santos',
  });
  const result = formatIcsCalendar(
    schedule(),
    profile,
    { startDate: '2026-08-19', endDate: '2026-12-15' },
    { now: '2026-08-01T04:05:06Z' },
  );
  const ics = result.icsText.replace(/\r\n /g, '');

  assert.equal(result.filename, 'animosort-ay-2026-2027-term-1.ics');
  assert.equal(result.exportedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.match(ics, /PRODID:-\/\/AnimoSort\/\/Google Calendar Export\/\/EN/);
  assert.match(ics, /X-WR-CALNAME:AY 2026-2027 · Term 1/);
  assert.match(ics, /DTSTAMP:20260801T040506Z/);
  assert.match(ics, /DTSTART;TZID=Asia\/Manila:20260824T091500/);
  assert.match(ics, /DTEND;TZID=Asia\/Manila:20260824T104500/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;UNTIL=20261214T024500Z/);
  assert.match(ics, /SUMMARY:STSP002 S30A — SPECIAL TOPICS/);
  assert.match(ics, /LOCATION:Online/);
  assert.match(ics, /DESCRIPTION:Professor: Professor Santos\\nMode: Online\\nDay: Monday\\nTime: 09:15 AM - 10:45 AM\\nAcademic session: AY 2026-2027 · Term 1/);
  assert.doesNotMatch(ics, /VALARM/);
});

test('uses the F2F room and hides an empty professor line', () => {
  const result = formatIcsCalendar(
    schedule([meeting({ section: 'S30B' })], 'AY 2026-2027 · Term 2'),
    createProfile('Plain'),
    { startDate: '2026-08-24', endDate: '2026-08-24' },
    { now: '2026-08-01T00:00:00Z' },
  );
  const ics = result.icsText.replace(/\r\n /g, '');

  assert.match(ics, /LOCATION:G404B · Gokongwei Hall/);
  assert.match(ics, /DESCRIPTION:Mode: F2F\\nDay: Monday\\nTime: 09:15 AM - 10:45 AM\\nAcademic session: AY 2026-2027 · Term 2/);
  assert.doesNotMatch(ics, /Professor:/);
});

test('counts meetings outside the range and blocks a zero-event export', () => {
  const meetings = [
    meeting({ day: 'MON', section: 'S30A' }),
    meeting({ day: 'TUE', section: 'S30B' }),
  ];
  const result = formatIcsCalendar(
    schedule(meetings),
    createProfile('Counts'),
    { startDate: '2026-08-24', endDate: '2026-08-24' },
    { now: '2026-08-01T00:00:00Z' },
  );
  assert.equal(result.exportedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal((result.icsText.match(/BEGIN:VEVENT/g) || []).length, 1);

  assert.throws(
    () => formatIcsCalendar(
      schedule([meeting({ day: 'TUE' })]),
      createProfile('Empty'),
      { startDate: '2026-08-24', endDate: '2026-08-24' },
      { now: '2026-08-01T00:00:00Z' },
    ),
    (error) => error instanceof CalendarExportError
      && error.code === 'NO_EVENTS_IN_RANGE'
      && error.details.skippedCount === 1,
  );
});

test('escapes iCalendar text and folds at UTF-8 octet boundaries', () => {
  assert.equal(escapeIcsText('a,b;c\\d\nnext'), 'a\\,b\\;c\\\\d\\nnext');
  const folded = foldIcsLine(`SUMMARY:${'課'.repeat(50)}`);
  assert.ok(folded.length > 1);
  assert.ok(folded.every((line) => new TextEncoder().encode(line).length <= 75));
  assert.ok(folded.slice(1).every((line) => line.startsWith(' ')));
});
