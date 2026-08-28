// Pure-function unit tests for the EAF parser. Run with: node tests/parser.test.mjs
import {
  EafParseError,
  DAY_ORDER,
  STANDARD_PERIODS,
  parseTimeLabel,
  parseTimeRange,
  splitMeetingSegments,
  normalizeLocation,
  normalizeMeeting,
  validateNoOverlaps,
  sanitizeSchedule,
} from '../assets/js/eaf-parser.js';

let failures = 0;
let checks = 0;

function assert(cond, label) {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

function assertThrows(fn, code, label) {
  checks += 1;
  try {
    fn();
    failures += 1;
    console.error(`FAIL (no throw): ${label}`);
  } catch (err) {
    if (!(err instanceof EafParseError) || err.code !== code) {
      failures += 1;
      console.error(`FAIL (wrong error): ${label} got ${err.name}:${err.code}`);
    }
  }
}

const baseCourse = { code: 'FINA101', title: 'ADVANCED FINANCIAL ECONOMETRICS', section: 'V01', credits: 3, row: 1 };

// DAY_ORDER and standard periods
assert(DAY_ORDER.join(',') === 'MON,TUE,WED,THU,FRI,SAT', 'DAY_ORDER is MON..SAT');
assert(
  STANDARD_PERIODS.every((p, i) => {
    const expected = [
      [450, 540], [555, 645], [660, 750], [765, 855],
      [870, 960], [975, 1065], [1080, 1170], [1185, 1275],
    ][i];
    return p[0] === expected[0] && p[1] === expected[1];
  }),
  'all 8 standard periods map to exact minutes'
);

// parseTimeLabel
assert(parseTimeLabel('7:30 AM').minutes === 450, '7:30 AM -> 450');
assert(parseTimeLabel('12:30 PM').minutes === 750, '12:30 PM -> 750');
assert(parseTimeLabel('12:15 AM').minutes === 15, '12:15 AM -> 15');
assert(parseTimeLabel('9:15 PM').minutes === 1275, '9:15 PM -> 1275');
assert(parseTimeLabel('13:00 PM') === null, '13:00 PM invalid');
assert(parseTimeLabel('12:60 AM') === null, '12:60 AM invalid');
assert(parseTimeLabel('9:15') === null, 'missing meridian invalid');

// parseTimeRange
const r1 = parseTimeRange('02:30 PM-04:00 PM');
assert(r1 && r1.startMinutes === 870 && r1.endMinutes === 960 && r1.startLabel === '02:30 PM', '02:30 PM-04:00 PM');
const r2 = parseTimeRange('07:45 PM-09:15 PM');
assert(r2 && r2.startMinutes === 1185 && r2.endMinutes === 1275, '07:45 PM-09:15 PM');
const rc = parseTimeRange('10:50 AM-12:20 PM');
assert(rc && rc.startMinutes === 650 && rc.endMinutes === 740, 'custom 10:50 AM-12:20 PM preserved (650-740)');
assert(parseTimeRange('04:00 PM-02:30 PM') === null, 'end before start invalid');
assert(parseTimeRange('09:15 AM-09:15 AM') === null, 'equal interval invalid');
assert(parseTimeRange('9:15 10:45') === null, 'no meridian invalid');

// splitMeetingSegments
const segs = splitMeetingSegments('MON | 02:30 PM-04:00 PM | M306, THU | 02:30 PM-04:00 PM | Online');
assert(segs && segs.length === 2, 'two meeting segments parsed');
assert(segs[0].day === 'MON' && normalizeLocation(segs[0].locationText) === 'M306', 'first segment MON with M306');
assert(segs[1].day === 'THU' && normalizeLocation(segs[1].locationText) === 'Online', 'second segment THU with Online');
assert(segs[0].timeText === '02:30 PM-04:00 PM', 'first time text preserved');
const segs2 = splitMeetingSegments('WED | 11:00 AM-12:30 PM | R101');
assert(segs2 && segs2.length === 1 && segs2[0].locationText === 'R101', 'single segment');
assert(splitMeetingSegments('no day markers here') === null, 'no segments -> null');

// normalizeLocation
assert(normalizeLocation('Online') === 'Online', 'Online canonical');
assert(normalizeLocation('ONLINE') === 'Online', 'ONLINE canonical');
assert(normalizeLocation('  online , ') === 'Online', 'case/whitespace variants canonical');
assert(normalizeLocation('M306') === 'M306', 'room kept');
assert(normalizeLocation('M306,') === 'M306', 'trailing comma stripped');
assert(normalizeLocation('') === null, 'empty -> null');

// normalizeMeeting
const m = normalizeMeeting({ day: 'MON', timeText: '02:30 PM-04:00 PM', locationText: 'M306' }, baseCourse);
assert(m.courseCode === 'FINA101' && m.day === 'MON' && m.startMinutes === 870 && m.endMinutes === 960, 'normalizeMeeting core');
assert(m.modality === 'room' && m.location === 'M306', 'room modality');
const mo = normalizeMeeting({ day: 'THU', timeText: '02:30 PM-04:00 PM', locationText: 'Online' }, baseCourse);
assert(mo.modality === 'online' && mo.location === 'Online', 'online modality');
const mc = normalizeMeeting({ day: 'WED', timeText: '10:50 AM-12:20 PM', locationText: 'R305' }, baseCourse);
assert(mc.startMinutes === 650 && mc.endMinutes === 740, 'custom interval normalized exactly');
assert(mc.startLabel === '10:50 AM' && mc.endLabel === '12:20 PM', 'custom labels preserved');
const m7 = normalizeMeeting({ day: 'MON', timeText: '07:30 AM-09:00 AM', locationText: 'Online' }, baseCourse);
assert(m7.startMinutes === 450 && m7.endMinutes === 540, '7:30-9:00 exact');
assertThrows(() => normalizeMeeting({ day: 'SUN', timeText: '09:15 AM-10:45 AM', locationText: 'Online' }, baseCourse), 'UNSUPPORTED_DAY', 'Sunday rejected');
assertThrows(() => normalizeMeeting({ day: 'MON', timeText: '', locationText: 'M101' }, baseCourse), 'MEETING_UNREADABLE', 'missing time rejected');
assertThrows(() => normalizeMeeting({ day: 'MON', timeText: '04:00 PM-02:30 PM', locationText: 'M101' }, baseCourse), 'INVALID_TIME', 'invalid interval rejected');
assertThrows(() => normalizeMeeting({ day: 'MON', timeText: '09:15 AM-10:45 AM', locationText: '' }, baseCourse), 'MEETING_UNREADABLE', 'missing location rejected');

// validateNoOverlaps
const mk = (day, start, end, code = 'X') => ({ courseCode: code, title: 'T', section: 'A', credits: 3, day, startMinutes: start, endMinutes: end, location: 'M101' });
validateNoOverlaps([mk('MON', 555, 645), mk('MON', 645, 735)]); // touching ok
assert(true, 'touching intervals pass');
validateNoOverlaps([mk('MON', 555, 645), mk('TUE', 600, 700)]); // different days ok
assert(true, 'different days pass');
assertThrows(() => validateNoOverlaps([mk('MON', 555, 645), mk('MON', 600, 700)]), 'MEETING_OVERLAP', 'overlap rejected');
assertThrows(() => validateNoOverlaps([mk('MON', 555, 645), mk('MON', 600, 700), mk('MON', 800, 900)]), 'MEETING_OVERLAP', 'multi-meeting overlap rejected');

// sanitizeSchedule
const good = sanitizeSchedule('AY 2026-2027 Term 1', [{ code: 'FINA101', title: 'T', section: 'V01', credits: 3, meetings: [m, mo] }]);
assert(good.session === 'AY 2026-2027 Term 1' && good.meetings.length === 2, 'sanitize keeps session and meetings');
assert(!('raw' in good) && !('name' in good), 'no raw or identity fields');
assertThrows(() => sanitizeSchedule('AY 2026-2027 Term 1', [{ code: 'X', title: 'T', section: 'V01', credits: 3, meetings: [{ courseCode: 'X', title: 'T', section: 'V01', credits: 3, day: 'MON', startMinutes: 555, endMinutes: 0, location: 'M' }] }]), 'SCHEDULE_SANITIZATION_FAILED', 'invalid meeting fails sanitize');

// error details do not contain raw text or identity
try {
  validateNoOverlaps([mk('MON', 555, 645), mk('MON', 600, 700, 'FINA101')]);
} catch (err) {
  assert(err.code === 'MEETING_OVERLAP', 'overlap code');
  assert(JSON.stringify(err.details).includes('FINA101'), 'details include course codes');
  assert(!JSON.stringify(err.details).includes('12320609'), 'details exclude identity');
}

console.log(`parser.test.mjs: ${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);

// Export the interval boundary checks used by the frozen roadmap command.
export function runIntervalChecks() {
  const std = [
    ['07:30 AM-09:00 AM', 450, 540],
    ['09:15 AM-10:45 AM', 555, 645],
    ['11:00 AM-12:30 PM', 660, 750],
    ['12:45 PM-02:15 PM', 765, 855],
    ['02:30 PM-04:00 PM', 870, 960],
    ['04:15 PM-05:45 PM', 975, 1065],
    ['06:00 PM-07:30 PM', 1080, 1170],
    ['07:45 PM-09:15 PM', 1185, 1275],
  ];
  let ok = true;
  for (const [label, s, e] of std) {
    const r = parseTimeRange(label);
    if (!r || r.startMinutes !== s || r.endMinutes !== e) ok = false;
  }
  const custom = parseTimeRange('10:50 AM-12:20 PM');
  if (!custom || custom.startMinutes !== 650 || custom.endMinutes !== 740) ok = false;
  try {
    validateNoOverlaps([
      { day: 'MON', startMinutes: 555, endMinutes: 645 },
      { day: 'MON', startMinutes: 645, endMinutes: 735 },
    ]);
  } catch {
    ok = false;
  }
  try {
    validateNoOverlaps([
      { day: 'MON', startMinutes: 555, endMinutes: 645 },
      { day: 'MON', startMinutes: 600, endMinutes: 700 },
    ]);
    ok = false;
  } catch (err) {
    if (err.code !== 'MEETING_OVERLAP') ok = false;
  }
  console.log(ok ? 'INTERVAL_CHECKS_OK' : 'INTERVAL_CHECKS_FAIL');
  return ok;
}
