import assert from 'node:assert/strict';
import test from 'node:test';

import { createScheduleSvg, getTimelineLayout } from '../assets/js/export.js';
import { createProfile, setCourseColor, setSectionCustomization } from '../assets/js/customization.js';

function meeting(courseCode, title, startMinutes, endMinutes, location, startLabel = '07:00 PM', endLabel = '08:00 PM') {
  return {
    courseCode,
    title,
    section: courseCode === 'THSST2' ? 'S05' : 'S30A',
    credits: 3,
    day: 'MON',
    startMinutes,
    endMinutes,
    startLabel,
    endLabel,
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

test('keeps a short late and non-standard class inside the exported timeline', () => {
  const schedule = {
    session: 'AY 2026-2027 Term 1',
    meetings: [
      meeting('LCASEAN', 'THE FILIPINO AND ASEAN', 450, 540, 'Online', '07:30 AM', '09:00 AM'),
      meeting('THSST2', 'THESIS IN SOFTWARE TECHNOLOGY 2', 1260, 1290, 'Room not specified', '09:00 PM', '09:30 PM'),
    ],
  };
  const svg = createScheduleSvg(schedule);
  const svgHeight = Number(/<svg[^>]*height="([0-9.]+)"/.exec(svg)[1]);
  const lateCard = [...svg.matchAll(/<rect x="165\.0" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)]
    .map((match) => ({ y: Number(match[1]), height: Number(match[3]) }))
    .reduce((latest, card) => card.y > latest.y ? card : latest);
  const timeBaseline = Number(/<text x="174" y="([0-9.]+)"[^>]*>Time: 09:00 PM - 09:30 PM<\/text>/.exec(svg)[1]);

  assert.ok(svgHeight > 1000);
  assert.match(svg, />THSST2 <tspan/);
  assert.match(svg, />9:00 PM</);
  assert.match(svg, />9:30 PM</);
  assert.ok(timeBaseline + 7 < lateCard.y + lateCard.height);
});

test('exports the same custom color and section metadata line order as the live card', () => {
  let profile = createProfile('Export test');
  profile = setCourseColor(profile, 'STSP002', '#d946ef');
  profile = setSectionCustomization(profile, 'STSP002', 'S30A', { mode: 'f2f', professor: 'Prof. Santos & Co.' });
  const schedule = {
    session: 'AY 2026-2027 Term 1',
    meetings: [meeting('STSP002', 'SPECIAL TOPICS', 555, 645, 'G404B')],
  };
  const svg = createScheduleSvg(schedule, { profile });

  assert.match(svg, /fill="#d946ef"/);
  assert.match(svg, />Room: G404B · F2F</);
  assert.match(svg, />Professor: Prof. Santos &amp;</);
  assert.match(svg, />Co\.</);
  assert.match(svg, />Time: 07:00 PM - 08:00 PM</);
  assert.ok(svg.indexOf('Room: G404B') < svg.indexOf('Professor: Prof. Santos'));
  assert.ok(svg.indexOf('Professor: Prof. Santos') < svg.indexOf('Time: 07:00 PM'));
});

test('omits the professor line when the section has no professor', () => {
  const profile = createProfile('No professor');
  const schedule = {
    session: 'AY 2026-2027 Term 1',
    meetings: [meeting('STSP002', 'SPECIAL TOPICS', 555, 645, 'Online', '09:15 AM', '10:45 AM')],
  };
  const svg = createScheduleSvg(schedule, { profile });

  assert.match(svg, />Mode: Online</);
  assert.doesNotMatch(svg, /Professor:/);
});

test('supports explicit light and dark export themes', () => {
  const schedule = {
    session: 'AY 2026-2027 Term 1',
    meetings: [meeting('STSP002', 'SPECIAL TOPICS', 555, 645, 'G404B')],
  };

  const lightSvg = createScheduleSvg(schedule, { theme: 'light' });
  const darkSvg = createScheduleSvg(schedule, { theme: 'dark' });

  assert.match(lightSvg, /<rect width="1400" height="[0-9.]+" fill="#ffffff"\/>/);
  assert.match(darkSvg, /<rect width="1400" height="[0-9.]+" fill="#000000"\/>/);
});

test('uses the unified AnimoSort wordmark in exported footer branding', () => {
  const schedule = {
    session: 'AY 2026-2027 Term 1',
    meetings: [meeting('STSP002', 'SPECIAL TOPICS', 555, 645, 'G404B')],
  };

  const lightSvg = createScheduleSvg(schedule, { theme: 'light' });

  assert.match(lightSvg, /<tspan font-weight="bold" fill="#111111">Animo<\/tspan><tspan font-weight="bold" font-style="italic" fill="#087830">Sort<\/tspan>/);
});

test('expands exported layout for long metadata lines', () => {
  const schedule = {
    session: 'AY 2026-2027 Term 1',
    meetings: [meeting('STSP002', 'ADVANCED DISTRIBUTED SYSTEMS AND SOFTWARE ARCHITECTURE', 555, 560, 'Gokongwei Hall Advanced Collaboration Room')],
  };
  let profile = createProfile('Long metadata');
  profile = setSectionCustomization(profile, 'STSP002', 'S30A', {
    professor: 'Professor Alexandra Maria dela Cruz-Santos, PhD',
  });

  const shortSchedule = {
    ...schedule,
    meetings: [meeting('STSP002', 'SPECIAL TOPICS', 555, 560, 'G404B')],
  };
  const shortLayout = getTimelineLayout(shortSchedule, true, createProfile('Short metadata'));
  const longLayout = getTimelineLayout(schedule, true, profile);
  const svg = createScheduleSvg(schedule, { profile });

  assert.ok(longLayout.gridHeight > shortLayout.gridHeight);
  assert.match(svg, />Professor: Professor</);
  assert.match(svg, />Alexandra Maria dela</);
  assert.match(svg, />Cruz-Santos, PhD</);
});

test('exports resolved manual identity and time while omitting an unplaced async entry', () => {
  const asyncMeeting = {
    id: 'NSTP1::S01::0',
    courseCode: 'NSTP1',
    title: 'NATIONAL SERVICE TRAINING',
    section: 'S01',
    credits: 3,
    day: null,
    startMinutes: null,
    endMinutes: null,
    startLabel: null,
    endLabel: null,
    location: null,
    expandedLocation: null,
    modality: 'async',
    scheduled: false,
  };
  let profile = createProfile('Manual export');
  profile = setSectionCustomization(profile, 'NSTP1', 'S01', {
    courseCode: 'NSTP',
    title: 'Community Engagement',
    time: { day: 'SAT', startMinutes: 480, endMinutes: 600 },
    room: 'Online',
  });
  const unresolved = { ...asyncMeeting, id: 'NSTP2::S01::0', courseCode: 'NSTP2' };
  const svg = createScheduleSvg({ session: 'AY 2026-2027 Term 1', meetings: [asyncMeeting, unresolved] }, { profile });

  assert.match(svg, />NSTP <tspan[^>]*>S01<\/tspan>/);
  assert.match(svg, />Community Engagement</);
  assert.match(svg, />Mode: Online</);
  assert.doesNotMatch(svg, />NSTP2 <tspan/);
});

test('blocks an export when every effective meeting remains unplaced', () => {
  const asyncMeeting = {
    id: 'NSTP1::S01::0',
    courseCode: 'NSTP1',
    title: 'NATIONAL SERVICE TRAINING',
    section: 'S01',
    credits: 3,
    day: null,
    startMinutes: null,
    endMinutes: null,
    startLabel: null,
    endLabel: null,
    location: null,
    expandedLocation: null,
    modality: 'async',
    scheduled: false,
  };
  assert.throws(
    () => createScheduleSvg({ session: 'AY 2026-2027 Term 1', meetings: [asyncMeeting] }),
    /No scheduled meetings are available for export/,
  );
});
