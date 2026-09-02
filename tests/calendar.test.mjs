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
  setMeetingCustomization,
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
  assert.match(ics, /SUMMARY:STSP002 S30A - SPECIAL TOPICS/);
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
  assert.equal(result.unresolvedCount, 0);
  assert.equal(result.outsideRangeCount, 1);
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

test('exports a manual async slot and skips an unresolved async meeting', () => {
  const manual = meeting({
    id: 'NSTP1::S01::0',
    courseCode: 'NSTP1',
    title: 'NATIONAL SERVICE TRAINING',
    section: 'S01',
    day: null,
    startMinutes: null,
    endMinutes: null,
    startLabel: null,
    endLabel: null,
    location: null,
    expandedLocation: null,
    modality: 'async',
    scheduled: false,
  });
  const unresolved = { ...manual, id: 'NSTP2::S01::0', courseCode: 'NSTP2' };
  let profile = createProfile('Async calendar');
  profile = setSectionCustomization(profile, 'NSTP1', 'S01', {
    courseCode: 'NSTP',
    title: 'Community Engagement',
    time: { day: 'SAT', startMinutes: 480, endMinutes: 600 },
    room: 'Online',
  });
  const result = formatIcsCalendar(
    schedule([manual, unresolved]),
    profile,
    { startDate: '2026-08-22', endDate: '2026-08-22' },
    { now: '2026-08-01T00:00:00Z' },
  );
  const ics = result.icsText.replace(/\r\n /g, '');

  assert.equal(result.exportedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.unresolvedCount, 1);
  assert.equal(result.outsideRangeCount, 0);
  assert.match(ics, /SUMMARY:NSTP S01 - Community Engagement/);
  assert.match(ics, /DTSTART;TZID=Asia\/Manila:20260822T080000/);
  assert.match(ics, /LOCATION:Online/);
});

test('exports an independent class on its edited weekday and keeps the online platform in the event details', () => {
  const source = meeting({ id: 'STSP002::S30A::0', meetingOrdinal: 0 });
  let profile = createProfile('Independent calendar');
  profile = setMeetingCustomization(profile, 'STSP002', 'S30A', source.id, {
    title: 'Edited independent class',
    mode: 'online',
    time: { day: 'FRI', startMinutes: 780, endMinutes: 870 },
    room: 'Zoom',
  });
  const result = formatIcsCalendar(
    schedule([source]),
    profile,
    { startDate: '2026-08-28', endDate: '2026-09-04' },
    { now: '2026-08-01T00:00:00Z' },
  );
  const ics = result.icsText.replace(/\r\n /g, '');

  assert.equal(result.exportedCount, 1);
  assert.match(ics, /DTSTART;TZID=Asia\/Manila:20260828T130000/);
  assert.match(ics, /DTEND;TZID=Asia\/Manila:20260828T143000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;UNTIL=20260904T063000Z/);
  assert.match(ics, /SUMMARY:STSP002 S30A - Edited independent class/);
  assert.match(ics, /LOCATION:Online/);
  assert.match(ics, /DESCRIPTION:Mode: Online · Zoom\\nDay: Friday\\nTime: 1:00 PM - 2:30 PM/);
});

test('serializes a complete online meeting link as a calendar URL with a description fallback', () => {
  const source = meeting({ id: 'STSP002::S30A::0', meetingOrdinal: 0 });
  let profile = createProfile('Online link calendar');
  profile = setMeetingCustomization(profile, 'STSP002', 'S30A', source.id, {
    mode: 'online',
    time: { day: 'FRI', startMinutes: 780, endMinutes: 870 },
    room: 'https://zoom.us/j/123456789?pwd=demo',
  });
  const result = formatIcsCalendar(
    schedule([source]),
    profile,
    { startDate: '2026-08-28', endDate: '2026-09-04' },
    { now: '2026-08-01T00:00:00Z' },
  );
  const ics = result.icsText.replace(/\r\n /g, '');

  assert.match(ics, /LOCATION:Online/);
  assert.ok(ics.includes('URL:https://zoom.us/j/123456789?pwd=demo'));
  assert.ok(ics.includes('DESCRIPTION:Mode: Online\\nJoin link: https://zoom.us/j/123456789?pwd=demo\\nDay: Friday\\nTime: 1:00 PM - 2:30 PM'));
});

test('keeps platform text in the description and does not emit unsafe URL schemes', () => {
  const source = meeting({ id: 'STSP002::S30A::0', meetingOrdinal: 0 });
  let profile = createProfile('Platform text calendar');
  profile = setMeetingCustomization(profile, 'STSP002', 'S30A', source.id, {
    mode: 'online',
    room: 'javascript:alert(1)',
  });
  const result = formatIcsCalendar(
    schedule([source]),
    profile,
    { startDate: '2026-08-24', endDate: '2026-08-24' },
    { now: '2026-08-01T00:00:00Z' },
  );
  const ics = result.icsText.replace(/\r\n /g, '');

  assert.doesNotMatch(ics, /^URL:/m);
  assert.ok(ics.includes('DESCRIPTION:Mode: Online · javascript:alert(1)\\nDay: Monday'));
});

test('does not export Online as a physical room after an online class is changed to F2F', () => {
  const source = meeting({
    id: 'WEB01::S01::0',
    courseCode: 'WEB01',
    title: 'FULLY ONLINE',
    section: 'S01',
    location: 'Online',
    expandedLocation: 'Online',
    modality: 'online',
  });
  const profile = setMeetingCustomization(createProfile('F2F conversion'), 'WEB01', 'S01', source.id, { mode: 'f2f' });
  const result = formatIcsCalendar(
    schedule([source]),
    profile,
    { startDate: '2026-08-24', endDate: '2026-08-24' },
    { now: '2026-08-01T00:00:00Z' },
  );
  const ics = result.icsText.replace(/\r\n /g, '');

  assert.match(ics, /LOCATION:Room not specified/);
  assert.match(ics, /DESCRIPTION:Mode: F2F\\nDay: Monday\\nTime: 09:15 AM - 10:45 AM/);
  assert.doesNotMatch(ics, /LOCATION:Online/);
});

test('escapes iCalendar text and folds at UTF-8 octet boundaries', () => {
  assert.equal(escapeIcsText('a,b;c\\d\nnext'), 'a\\,b\\;c\\\\d\\nnext');
  const folded = foldIcsLine(`SUMMARY:${'課'.repeat(50)}`);
  assert.ok(folded.length > 1);
  assert.ok(folded.every((line) => new TextEncoder().encode(line).length <= 75));
  assert.ok(folded.slice(1).every((line) => line.startsWith(' ')));
});
