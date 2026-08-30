import assert from 'node:assert/strict';
import test from 'node:test';

import { createScheduleSvg } from '../assets/js/export.js';

function meeting(courseCode, title, startMinutes, endMinutes, location) {
  return {
    courseCode,
    title,
    section: courseCode === 'THSST2' ? 'S05' : 'S30A',
    credits: 3,
    day: 'MON',
    startMinutes,
    endMinutes,
    startLabel: startMinutes === 555 ? '09:15 AM' : '07:00 PM',
    endLabel: endMinutes === 645 ? '10:45 AM' : '08:00 PM',
    location,
    expandedLocation: location,
  };
}

test('expands exported timeline for a short evening card', () => {
  const schedule = {
    session: 'AY 2026-2027 Term 1',
    meetings: [
      meeting('STSP002', 'SPECIAL TOPICS', 555, 645, 'G404B'),
      meeting('THSST2', 'THESIS IN SOFTWARE TECHNOLOGY 2', 1140, 1200, 'Room not specified'),
    ],
  };
  const svg = createScheduleSvg(schedule);
  const svgHeight = Number(/<svg[^>]*height="([0-9.]+)"/.exec(svg)[1]);
  const cardRectangles = [...svg.matchAll(/<rect x="165\.0" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)]
    .map((match) => ({ y: Number(match[1]), height: Number(match[3]) }));
  const nightCard = cardRectangles.reduce((latest, card) => card.y > latest.y ? card : latest);
  const timeBaseline = Number(/<text x="174" y="([0-9.]+)"[^>]*>Time: 07:00 PM - 08:00 PM<\/text>/.exec(svg)[1]);

  assert.ok(svgHeight > 1000);
  assert.match(svg, />THSST2 <tspan/);
  assert.ok(timeBaseline + 7 < nightCard.y + nightCard.height);
});
