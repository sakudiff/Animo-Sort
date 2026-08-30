import assert from 'node:assert/strict';
import test from 'node:test';

import { parseScheduleRows, parseTimeRange } from '../assets/js/eaf-parser.js';

const SESSION = 'AY 2026-2027 Term 1';

function createPage(courseItems) {
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
    { str: 'MON | 07:00 PM-08:00 PM | Room not specified', x: 450, y: rowY },
  ];
}

function parseCourse(courseItems) {
  const [row] = parseScheduleRows([createPage(courseItems)], SESSION);
  return { code: row.code, title: row.title };
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
