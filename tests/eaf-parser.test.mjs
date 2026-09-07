import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expandLocation,
  getBuildingCode,
  getBuildingName,
  parseScheduleRows,
  parseTimeRange,
  validateNoOverlaps,
} from '../assets/js/eaf-parser.js';

const SESSION = 'AY 2026-2027 Term 1';

function createPage(courseItems, scheduleText = 'MON | 07:00 PM-08:00 PM | Room not specified') {
  const headerY = 500;
  const rowY = 480;
  const courseWords = (Array.isArray(courseItems) ? courseItems : [courseItems]).map((str, index) => ({
    str,
    x: 110 + index * 10,
    y: rowY,
  }));
  return [
    { str: 'Course Type', x: 245, y: headerY },
    { str: 'Section', x: 337, y: headerY },
    { str: 'Credits', x: 398, y: headerY },
    { str: 'Day/Time/Room', x: 441, y: headerY },
    { str: '1', x: 20, y: rowY },
    ...courseWords,
    { str: 'Lecture', x: 230, y: rowY },
    { str: 'S05', x: 310, y: rowY },
    { str: '3.00', x: 380, y: rowY },
    { str: scheduleText, x: 450, y: rowY },
  ];
}

function parseCourse(courseItems) {
  const [row] = parseScheduleRows([createPage(courseItems)], SESSION);
  return { code: row.code, title: row.title };
}

function parseMeetings(courseItems, scheduleText) {
  const [row] = parseScheduleRows([createPage(courseItems, scheduleText)], SESSION);
  return row.meetings;
}

test('normalizes a hyphenated course code from compact PDF text', () => {
  assert.deepEqual(
    parseCourse('THS-ST2-THESIS IN SOFTWARE TECHNOLOGY 2'),
    { code: 'THSST2', title: 'THESIS IN SOFTWARE TECHNOLOGY 2' },
  );
  assert.deepEqual(
    parseCourse('THSST2-THESIS IN SOFTWARE TECHNOLOGY 2'),
    { code: 'THSST2', title: 'THESIS IN SOFTWARE TECHNOLOGY 2' },
  );
});

test('normalizes a hyphenated course code when PDF.js separates text items', () => {
  assert.deepEqual(
    parseCourse(['THS', '-', 'ST2', '-', 'THESIS', 'IN', 'SOFTWARE', 'TECHNOLOGY', '2']),
    { code: 'THSST2', title: 'THESIS IN SOFTWARE TECHNOLOGY 2' },
  );
});

test('keeps separate NSTP code digits distinct when PDF text inserts a space', () => {
  assert.deepEqual(
    parseCourse('NSTP 1-NATIONAL SERVICE TRAINING 1'),
    { code: 'NSTP1', title: 'NATIONAL SERVICE TRAINING 1' },
  );
  assert.deepEqual(
    parseCourse('NSTP 2-NATIONAL SERVICE TRAINING 2'),
    { code: 'NSTP2', title: 'NATIONAL SERVICE TRAINING 2' },
  );
});

test('keeps CWTS, LTS, and ROTC NSTP part codes distinct', () => {
  for (const code of ['NSTPCW1', 'NSTPCW2', 'NSTPLT1', 'NSTPLT2', 'NSTPRO1', 'NSTPRO2']) {
    assert.deepEqual(parseCourse(`${code}-NATIONAL SERVICE TRAINING`), {
      code,
      title: 'NATIONAL SERVICE TRAINING',
    });
  }
});

test('accepts late and non-standard meeting intervals', () => {
  assert.deepEqual(parseTimeRange('09:00 PM - 11:00 PM'), {
    startMinutes: 1260,
    endMinutes: 1380,
    startLabel: '09:00 PM',
    endLabel: '11:00 PM',
  });
  assert.deepEqual(parseTimeRange('07:45 PM - 09:15 PM'), {
    startMinutes: 1185,
    endMinutes: 1275,
    startLabel: '07:45 PM',
    endLabel: '09:15 PM',
  });
});

test('preserves standard DLSU course codes and title hyphens', () => {
  const codes = [
    'FINSBRE',
    'THSADV1',
    'THSADV2',
    'COBIBFM',
    'GELITPH',
    'LCFAITH',
    'FINARTS',
    'INFOECO',
  ];

  for (const code of codes) {
    assert.deepEqual(parseCourse(`${code}-Sample Course`), { code, title: 'Sample Course' });
  }
  assert.deepEqual(parseCourse('ABC123-THESIS-BASED PROJECT'), {
    code: 'ABC123',
    title: 'THESIS-BASED PROJECT',
  });
});

test('expands DLSU Laguna campus room codes', () => {
  const cases = [
    ['MM101', 'MM', 'St. Mutien Marie Hall'],
    ['MM-BLACKBOX', 'MM', 'St. Mutien Marie Hall'],
    ['MRR101', 'MRR', 'Milagros R. del Rosario Building'],
    ['UH208', 'UH', 'University Hall'],
    ['EKR101', 'EKR', 'Enrique K. Razon Jr. Hall'],
    ['RL101', 'RL', 'Richard L. Lee Engineering Technology Block'],
    ['LC1', 'LC', 'Integrated School Learning Centers'],
    ['LC2', 'LC', 'Integrated School Learning Centers'],
  ];

  for (const [room, code, name] of cases) {
    assert.equal(getBuildingCode(room), code, room);
    assert.equal(getBuildingName(room), name, room);
    assert.equal(expandLocation(room), `${room} · ${name}`, room);
  }
});

test('maps Saint Joseph room prefixes to St. Joseph Hall', () => {
  const cases = [
    ['SJ', 'SJ'],
    ['SJ101', 'SJ'],
    ['S', 'S'],
    ['S101', 'S'],
    ['J', 'J'],
    ['J101', 'J'],
  ];

  for (const [room, code] of cases) {
    assert.equal(getBuildingCode(room), code, room);
    assert.equal(getBuildingName(room), 'St. Joseph Hall', room);
    assert.equal(expandLocation(room), `${room} · St. Joseph Hall`, room);
  }

});

test('maps J schedule rooms to St. Joseph Hall', () => {
  const meetings = parseMeetings(
    'COBIBFM-INTERNATIONAL BUSINESS AGREEMENTS',
    'MON | 04:15 PM-05:45 PM | J111, THU | 04:15 PM-05:45 PM | J107',
  );

  assert.deepEqual(
    meetings.map(({ location, buildingCode, buildingName, expandedLocation }) => ({
      location,
      buildingCode,
      buildingName,
      expandedLocation,
    })),
    [
      {
        location: 'J111',
        buildingCode: 'J',
        buildingName: 'St. Joseph Hall',
        expandedLocation: 'J111 · St. Joseph Hall',
      },
      {
        location: 'J107',
        buildingCode: 'J',
        buildingName: 'St. Joseph Hall',
        expandedLocation: 'J107 · St. Joseph Hall',
      },
    ],
  );
});

test('keeps an explicit async course as one unplaced meeting', () => {
  const [meeting] = parseMeetings('NSTP1-NATIONAL SERVICE TRAINING', 'ASYNC');

  assert.equal(meeting.id, 'NSTP1::S05::0');
  assert.equal(meeting.meetingOrdinal, 0);
  assert.equal(meeting.scheduled, false);
  assert.equal(meeting.modality, 'async');
  assert.equal(meeting.day, null);
  assert.equal(meeting.startMinutes, null);
  assert.equal(meeting.location, null);
});

test('accepts an empty async schedule cell but still rejects arbitrary missing schedule text', () => {
  const [meeting] = parseMeetings('NSTP2-NATIONAL SERVICE TRAINING', '');
  assert.equal(meeting.scheduled, false);

  assert.throws(
    () => parseMeetings('NSTP3-NATIONAL SERVICE TRAINING', 'TBA'),
    (error) => error.code === 'ROW_UNREADABLE',
  );
});

test('ignores unplaced meetings during overlap validation', () => {
  const [meeting] = parseMeetings('NSTP4-NATIONAL SERVICE TRAINING', 'NO TIME, NO VENUE, JUST ASYNC');
  assert.doesNotThrow(() => validateNoOverlaps([meeting]));
});
