import assert from 'node:assert/strict';
import test from 'node:test';

import { getPairChoiceDraftPatch } from '../assets/js/app.js';
import {
  applySyncConflictChoice,
  createDefaultProfile,
  getPairCustomizationState,
  resolveScheduleEntries,
  setMeetingAutomaticOverride,
  setSectionCustomization,
} from '../assets/js/customization.js';

function meeting(overrides = {}) {
  return {
    id: 'STSP002::S30A::0',
    meetingOrdinal: 0,
    courseCode: 'STSP002',
    title: 'SPECIAL TOPICS',
    section: 'S30A',
    day: 'MON',
    startMinutes: 480,
    endMinutes: 570,
    location: 'G404B',
    modality: 'room',
    ...overrides,
  };
}

test('saved Automatic state still allows an explicit time edit to join the pair', () => {
  const first = meeting();
  const second = meeting({
    id: 'STSP002::S30A::1',
    meetingOrdinal: 1,
    day: 'THU',
    startMinutes: 600,
    endMinutes: 690,
  });
  const schedule = { meetings: [first, second] };
  let profile = setSectionCustomization(createDefaultProfile(), 'STSP002', 'S30A', {
    mode: 'online',
    room: 'Zoom',
  });
  profile = setMeetingAutomaticOverride(profile, 'STSP002', 'S30A', first.id);
  const pairState = getPairCustomizationState(schedule, profile, first, 'meeting');
  const fullDraft = {
    courseCode: first.courseCode,
    section: first.section,
    title: first.title,
    time: { day: 'FRI', startMinutes: 780, endMinutes: 870 },
    room: first.location,
    professor: '',
    mode: 'inherit',
  };
  const editorState = {
    automaticReset: false,
    storedOverride: { automatic: true },
    changedFields: new Set(['time']),
  };

  const draftPatch = getPairChoiceDraftPatch(fullDraft, editorState);
  assert.deepEqual(draftPatch, { time: fullDraft.time });

  const next = applySyncConflictChoice(profile, {
    schedule,
    selectedMeeting: first,
    pairState,
    draftPatch,
    changedFields: editorState.changedFields,
  }, 'use-current-for-pair');
  const entries = resolveScheduleEntries(schedule, next);

  assert.deepEqual(entries.map(({ resolved }) => [resolved.day, resolved.startMinutes, resolved.endMinutes]), [
    ['FRI', 780, 870],
    ['FRI', 780, 870],
  ]);
});

test('an active Automatic reset still suppresses the untouched draft', () => {
  const draft = {
    courseCode: 'STSP002',
    time: { day: 'MON', startMinutes: 480, endMinutes: 570 },
  };

  assert.deepEqual(getPairChoiceDraftPatch(draft, {
    automaticReset: true,
    changedFields: new Set(['time']),
  }), {});
});
