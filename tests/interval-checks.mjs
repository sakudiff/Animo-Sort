// Interval and no-network boundary checks for the parser. Exit 0 on success.
import { parseTimeRange, STANDARD_PERIODS, validateNoOverlaps } from '../assets/js/eaf-parser.js';

let fails = 0;
const check = (cond, label) => {
  if (!cond) {
    fails += 1;
    console.error(`FAIL: ${label}`);
  }
};

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
for (const [label, s, e] of std) {
  const r = parseTimeRange(label);
  check(r && r.startMinutes === s && r.endMinutes === e, `standard ${label}`);
}
check(STANDARD_PERIODS.length === 8, '8 standard periods');

const custom = parseTimeRange('10:50 AM-12:20 PM');
check(custom && custom.startMinutes === 650 && custom.endMinutes === 740, 'custom interval preserved');

try {
  validateNoOverlaps([
    { day: 'MON', startMinutes: 555, endMinutes: 645 },
    { day: 'MON', startMinutes: 645, endMinutes: 735 },
  ]);
  check(true, 'touching intervals pass');
} catch {
  check(false, 'touching intervals pass');
}

try {
  validateNoOverlaps([
    { day: 'MON', startMinutes: 555, endMinutes: 645 },
    { day: 'MON', startMinutes: 600, endMinutes: 700 },
  ]);
  check(false, 'overlap rejects');
} catch (err) {
  check(err.code === 'MEETING_OVERLAP', 'overlap rejects with MEETING_OVERLAP');
}

if (fails === 0) {
  console.log('INTERVAL_CHECKS_OK');
  process.exit(0);
}
console.error(`${fails} failures`);
process.exit(1);
