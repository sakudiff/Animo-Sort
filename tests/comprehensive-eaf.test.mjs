import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  expandLocation,
  getBuildingCode,
  getBuildingName,
  parseEafFile,
  validateNoOverlaps,
} from '../assets/js/eaf-parser.js';

const fixturePath = new URL('./fixtures/comprehensive-eaf/comprehensive-eaf.pdf', import.meta.url);
const expectedPath = new URL('./fixtures/comprehensive-eaf/expected.json', import.meta.url);
const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));

function createFixtureFile() {
  const bytes = readFileSync(fixturePath);
  return new File([bytes], 'comprehensive-eaf.pdf', { type: 'application/pdf' });
}

function comparableMeeting(meeting) {
  return {
    day: meeting.day,
    startLabel: meeting.startLabel,
    endLabel: meeting.endLabel,
    location: meeting.location,
    scheduled: meeting.scheduled,
    modality: meeting.modality,
  };
}

test('imports the comprehensive PDF through the production EAF parser path', async () => {
  const schedule = await parseEafFile(createFixtureFile());

  assert.equal(schedule.session, expected.session);
  assert.equal(schedule.meetings.length, expected.meetingCount);
  assert.equal(schedule.meetings.filter((meeting) => meeting.scheduled).length, expected.scheduledMeetingCount);
  assert.equal(schedule.meetings.filter((meeting) => !meeting.scheduled).length, expected.asyncMeetingCount);

  for (const expectedRow of expected.rows) {
    const actualMeetings = schedule.meetings.filter(
      (meeting) => meeting.courseCode === expectedRow.courseCode && meeting.section === expectedRow.section,
    );
    assert.equal(actualMeetings.length, expectedRow.meetings.length, expectedRow.courseCode);
    assert.equal(actualMeetings[0].title, expectedRow.title);
    assert.equal(actualMeetings[0].credits, expectedRow.credits);
    assert.deepEqual(actualMeetings.map(comparableMeeting), expectedRow.meetings, expectedRow.courseCode);

    for (const meeting of actualMeetings) {
      if (meeting.scheduled && meeting.location !== 'Online') {
        assert.equal(meeting.expandedLocation, expandLocation(meeting.location));
        assert.equal(meeting.buildingCode, getBuildingCode(meeting.location));
        assert.equal(meeting.buildingName, getBuildingName(meeting.location));
      }
    }
  }

  assert.doesNotThrow(() => validateNoOverlaps(schedule.meetings));
});

test('represents every requested schedule state and preserves NSTP source codes', async () => {
  const schedule = await parseEafFile(createFixtureFile());
  const codes = new Set(schedule.meetings.map((meeting) => meeting.courseCode));

  for (const [category, categoryCodes] of Object.entries(expected.coverage)) {
    if (category === 'validNonOverlap') continue;
    for (const code of categoryCodes) {
      assert.equal(codes.has(code), true, `${category}: ${code}`);
    }
  }

  const nstpCodes = expected.coverage.nstpForms;
  assert.equal(new Set(nstpCodes).size, nstpCodes.length);
  assert.deepEqual(
    nstpCodes.filter((code) => codes.has(code)).sort(),
    [...nstpCodes].sort(),
  );

  const asyncMeeting = schedule.meetings.find((meeting) => meeting.courseCode === 'NSTP101');
  assert.deepEqual(comparableMeeting(asyncMeeting), {
    day: null,
    startLabel: null,
    endLabel: null,
    location: null,
    scheduled: false,
    modality: 'async',
  });
});
