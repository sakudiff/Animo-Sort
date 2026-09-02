import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PROFILE_ID,
  LEGACY_COLOR_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  addProfile,
  buildCourseColorMap,
  createDefaultProfile,
  createProfile,
  deleteProfile,
  applySyncConflictChoice,
  getActiveProfile,
  getPairCustomizationState,
  getPairScopeLabel,
  loadProfileStore,
  PROFILE_STORE_FORMAT,
  PROFILE_STORE_VERSION,
  formatPairFieldDifference,
  normalizeHexColor,
  parseProfileJson,
  randomizeCourseColors,
  renameProfile,
  resetProfile,
  resetMeetingCustomization,
  resetSectionDefaults,
  resetSectionCustomization,
  resolveMeetingCustomization,
  resolveScheduleEntries,
  formatMeetingMetadataLines,
  serializeProfile,
  setCourseColor,
  setMeetingAutomaticOverride,
  setMeetingCustomization,
  setSectionCustomization,
} from '../assets/js/customization.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values,
  };
}

function meeting(overrides = {}) {
  return {
    id: 'STSP002::S30A::0',
    meetingOrdinal: 0,
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

test('normalizes picker hex values without losing the selected color', () => {
  assert.equal(normalizeHexColor('#ABC'), '#aabbcc');
  assert.equal(normalizeHexColor('D946EF'), '#d946ef');
  assert.equal(normalizeHexColor('#d946ef80'), null);
});

test('profile JSON round-trips course colors and section details without schedule data', () => {
  let profile = createProfile('Classroom setup');
  profile = setCourseColor(profile, 'stsp-002', '#D946EF');
  profile = setSectionCustomization(profile, 'stsp002', 's30a', { mode: 'f2f', professor: 'Prof. Santos' });
  const imported = parseProfileJson(serializeProfile(profile), 'backup.json');

  assert.deepEqual(imported.courses, { STSP002: { color: '#d946ef' } });
  assert.deepEqual(imported.sections, { 'STSP002::S30A': { mode: 'f2f', professor: 'Prof. Santos' } });
  assert.equal(Object.hasOwn(imported, 'meetings'), false);
  assert.equal(Object.hasOwn(imported, 'session'), false);
});

test('legacy colors migrate into Default while the old key remains untouched', () => {
  const storage = memoryStorage({ [LEGACY_COLOR_STORAGE_KEY]: JSON.stringify({ 'stsp-002': '#ABC', BAD: 'not-a-color' }) });
  const store = loadProfileStore(storage);
  const profile = getActiveProfile(store);

  assert.equal(store.activeProfileId, DEFAULT_PROFILE_ID);
  assert.deepEqual(profile.courses, { STSP002: { color: '#aabbcc' } });
  assert.equal(storage.getItem(LEGACY_COLOR_STORAGE_KEY), '{"stsp-002":"#ABC","BAD":"not-a-color"}');
  assert.ok(storage.getItem(PROFILE_STORAGE_KEY));
});

test('an existing v1 store is authoritative over the legacy color key', () => {
  const storage = memoryStorage({
    [PROFILE_STORAGE_KEY]: JSON.stringify({
      format: PROFILE_STORE_FORMAT,
      version: PROFILE_STORE_VERSION,
      activeProfileId: DEFAULT_PROFILE_ID,
      profiles: [{
        id: DEFAULT_PROFILE_ID,
        builtIn: true,
        profile: createDefaultProfile(),
      }],
    }),
    [LEGACY_COLOR_STORAGE_KEY]: JSON.stringify({ STSP002: '#d946ef' }),
  });

  assert.deepEqual(loadProfileStore(storage).profiles[0].profile.courses, {});
});

test('imported profile names are unique and a selected non-default profile can be deleted', () => {
  const store = loadProfileStore(memoryStorage());
  const first = addProfile(store, createProfile('Term 1'));
  const second = addProfile(first, createProfile('Term 1'));

  assert.deepEqual(second.profiles.map((entry) => entry.profile.name), ['Default', 'Term 1', 'Term 1 (2)']);
  assert.equal(getActiveProfile(second).name, 'Term 1 (2)');
  const afterDelete = deleteProfile(second, second.activeProfileId);
  assert.equal(afterDelete.activeProfileId, DEFAULT_PROFILE_ID);
  assert.throws(() => deleteProfile(afterDelete, DEFAULT_PROFILE_ID), /cannot be deleted/i);
});

test('reset scopes keep the profile name and return neutral/inferred defaults', () => {
  let profile = setCourseColor(createDefaultProfile(), 'STSP002', '#d946ef');
  profile = setSectionCustomization(profile, 'STSP002', 'S30A', { mode: 'online', professor: 'Prof. Santos' });
  const reset = resetProfile(profile, 'all');

  assert.equal(reset.name, 'Default');
  assert.equal(reset.defaults.color, 'plain');
  assert.equal(reset.defaults.mode, 'infer');
  assert.deepEqual(reset.courses, {});
  assert.deepEqual(reset.sections, {});
});

test('resetting one section does not change another section or the course color', () => {
  let profile = setCourseColor(createProfile('Section reset'), 'STSP002', '#d946ef');
  profile = setSectionCustomization(profile, 'STSP002', 'S30A', { mode: 'online', professor: 'Prof. Santos' });
  profile = setSectionCustomization(profile, 'STSP002', 'S30B', { mode: 'f2f', professor: 'Prof. Reyes' });
  const reset = resetSectionCustomization(profile, 'STSP002', 'S30A');

  assert.deepEqual(reset.courses, { STSP002: { color: '#d946ef' } });
  assert.deepEqual(reset.sections, { 'STSP002::S30B': { mode: 'f2f', professor: 'Prof. Reyes' } });
});

test('resetting shared section defaults preserves an independent meeting', () => {
  const first = meeting({ id: 'STSP002::S30A::0', meetingOrdinal: 0 });
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU' });
  let profile = setSectionCustomization(createProfile('Shared reset'), 'STSP002', 'S30A', {
    title: 'Shared title',
    room: 'B201',
  });
  profile = setMeetingCustomization(profile, 'STSP002', 'S30A', second.id, {
    title: 'Independent title',
    time: { day: 'FRI', startMinutes: 720, endMinutes: 780 },
  });

  const reset = resetSectionDefaults(profile, 'STSP002', 'S30A');
  assert.deepEqual(Object.keys(reset.sections['STSP002::S30A']), ['meetings']);
  assert.equal(resolveMeetingCustomization(reset, first).title, 'SPECIAL TOPICS');
  assert.equal(resolveMeetingCustomization(reset, first).location, 'G404B');
  assert.equal(resolveMeetingCustomization(reset, second).title, 'Independent title');
  assert.equal(resolveMeetingCustomization(reset, second).day, 'FRI');
});

test('resolver applies course color and section metadata consistently', () => {
  let profile = createProfile('Resolver test');
  profile = setCourseColor(profile, 'STSP002', '#d946ef');
  profile = setSectionCustomization(profile, 'STSP002', 'S30A', { mode: 'f2f', professor: 'Prof. Santos' });
  const schedule = { meetings: [meeting(), meeting({ courseCode: 'LCASEAN', section: 'S01A', location: 'Online', expandedLocation: 'Online', modality: undefined })] };
  const colors = buildCourseColorMap(schedule, profile);
  const physical = resolveMeetingCustomization(profile, schedule.meetings[0], 0, colors);
  const online = resolveMeetingCustomization(profile, schedule.meetings[1], 1, colors);

  assert.equal(physical.palette.swatch, '#d946ef');
  assert.equal(physical.mode, 'f2f');
  assert.equal(physical.professor, 'Prof. Santos');
  assert.equal(online.mode, 'online');
  assert.equal(online.professor, null);
});

test('formats delivery and location combinations without leaking a physical room into Online', () => {
  const physical = meeting();
  let profile = setSectionCustomization(createProfile('Modes'), 'STSP002', 'S30A', { mode: 'online' });
  let resolved = resolveMeetingCustomization(profile, physical);
  assert.equal(formatMeetingMetadataLines(physical, resolved).locationMode, 'Mode: Online');

  profile = setSectionCustomization(profile, 'STSP002', 'S30A', { room: 'Zoom' });
  resolved = resolveMeetingCustomization(profile, physical);
  assert.equal(formatMeetingMetadataLines(physical, resolved).locationMode, 'Mode: Online · Zoom');

  const onlineSource = meeting({ location: 'Online', expandedLocation: 'Online', modality: 'online' });
  profile = setSectionCustomization(createProfile('F2F'), 'STSP002', 'S30A', { mode: 'f2f' });
  resolved = resolveMeetingCustomization(profile, onlineSource);
  assert.equal(formatMeetingMetadataLines(onlineSource, resolved).locationMode, 'Room: Room not specified · F2F');

  const onlinePlatformSource = meeting({ location: 'Canvas', expandedLocation: 'Canvas', modality: 'online' });
  resolved = resolveMeetingCustomization(profile, onlinePlatformSource);
  assert.equal(resolved.location, null);
  assert.equal(formatMeetingMetadataLines(onlinePlatformSource, resolved).locationMode, 'Room: Room not specified · F2F');

  const asyncSource = meeting({
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
  resolved = resolveMeetingCustomization(createProfile('Async'), asyncSource);
  assert.equal(formatMeetingMetadataLines(asyncSource, resolved).locationMode, 'Mode: Async · no fixed time');
});

test('section delivery overrides preserve distinct source slots until time is explicitly overridden', () => {
  const first = meeting({ id: 'STSP002::S30A::0', meetingOrdinal: 0, day: 'MON', startMinutes: 480, endMinutes: 570 });
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU', startMinutes: 600, endMinutes: 690 });
  const schedule = { meetings: [first, second] };
  const profile = setSectionCustomization(createProfile('Sparse mode'), 'STSP002', 'S30A', { mode: 'online' });
  const entries = resolveScheduleEntries(schedule, profile);

  assert.deepEqual(entries.map(({ resolved }) => [resolved.day, resolved.startMinutes, resolved.endMinutes, resolved.mode]), [
    ['MON', 480, 570, 'online'],
    ['THU', 600, 690, 'online'],
  ]);
});

test('randomize creates explicit pastel overrides for the active courses', () => {
  const profile = randomizeCourseColors(createDefaultProfile(), ['STSP002', 'LCASEAN'], () => 0.25);
  assert.equal(typeof profile.courses.STSP002.color, 'string');
  assert.equal(typeof profile.courses.LCASEAN.color, 'string');
  assert.notEqual(profile.courses.STSP002.color, undefined);
});

test('rename keeps internal identity and makes duplicate names unique', () => {
  const store = addProfile(loadProfileStore(memoryStorage()), createProfile('Term 1'));
  const renamed = renameProfile(store, store.activeProfileId, 'Default');
  assert.equal(renamed.activeProfileId, store.activeProfileId);
  assert.equal(getActiveProfile(renamed).name, 'Default (2)');
});

test('round-trips synchronized fields and one unsynced meeting patch', () => {
  let profile = createProfile('Manual schedule');
  profile = setSectionCustomization(profile, 'NSTP1', 'S01', {
    courseCode: 'NSTP',
    section: 'S01A',
    title: 'Community Engagement',
    time: { day: 'SAT', startMinutes: 480, endMinutes: 600 },
    room: 'Online',
  });
  assert.throws(
    () => setMeetingCustomization(profile, 'NSTP1', 'S01', 'NSTP1::S01::0', {
      title: 'Specific meeting',
      time: { day: 'SUN', startMinutes: 480, endMinutes: 600 },
    }),
    (error) => error.code === 'INVALID_TIME',
  );

  profile = resetMeetingCustomization(profile, 'NSTP1', 'S01', 'NSTP1::S01::0');
  profile = setMeetingCustomization(profile, 'NSTP1', 'S01', 'NSTP1::S01::0', {
    title: 'Specific meeting',
    time: { day: 'SAT', startMinutes: 660, endMinutes: 720 },
  });
  const imported = parseProfileJson(serializeProfile(profile));

  assert.equal(imported.sections['NSTP1::S01'].title, 'Community Engagement');
  assert.deepEqual(imported.sections['NSTP1::S01'].meetings['NSTP1::S01::0'], {
    synced: false,
    title: 'Specific meeting',
    time: { day: 'SAT', startMinutes: 660, endMinutes: 720 },
  });
});

test('keeps paired meetings synchronized until one class is explicitly unsynced', () => {
  const first = meeting();
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'TUE' });
  let profile = setSectionCustomization(createProfile('Pairing'), 'STSP002', 'S30A', {
    title: 'Shared title',
    time: { day: 'WED', startMinutes: 600, endMinutes: 660 },
  });

  let firstResolved = resolveMeetingCustomization(profile, first);
  let secondResolved = resolveMeetingCustomization(profile, second);
  assert.equal(firstResolved.synced, true);
  assert.equal(secondResolved.synced, true);
  assert.equal(firstResolved.day, 'WED');
  assert.equal(secondResolved.day, 'WED');

  profile = setMeetingCustomization(profile, 'STSP002', 'S30A', second.id, {
    title: 'Independent title',
    time: { day: 'THU', startMinutes: 720, endMinutes: 780 },
  });
  firstResolved = resolveMeetingCustomization(profile, first);
  secondResolved = resolveMeetingCustomization(profile, second);
  assert.equal(firstResolved.title, 'Shared title');
  assert.equal(firstResolved.day, 'WED');
  assert.equal(secondResolved.title, 'Independent title');
  assert.equal(secondResolved.day, 'THU');
  assert.equal(secondResolved.synced, false);

  profile = resetMeetingCustomization(profile, 'STSP002', 'S30A', second.id);
  assert.equal(resolveMeetingCustomization(profile, second).day, 'WED');
});

test('Automatic restores one meeting from the EAF without removing its pair section', () => {
  const source = meeting({
    courseCode: 'NSTPCW1',
    section: 'CW1',
    id: 'NSTPCW1::CW1::0',
    meetingOrdinal: 0,
    title: 'CWTS PART 1',
  });
  let profile = setSectionCustomization(createProfile('Automatic reset'), 'NSTPCW1', 'CW1', {
    courseCode: 'NSTP',
    section: 'CWTS',
    title: 'Shared NSTP title',
    mode: 'online',
    professor: 'Prof. Shared',
    time: { day: 'SAT', startMinutes: 720, endMinutes: 780 },
    room: 'Zoom',
  });
  profile = setMeetingAutomaticOverride(profile, 'NSTPCW1', 'CW1', source.id);

  const resolved = resolveMeetingCustomization(profile, source);
  assert.equal(resolved.synced, false);
  assert.equal(resolved.courseCode, 'NSTPCW1');
  assert.equal(resolved.section, 'CW1');
  assert.equal(resolved.title, 'CWTS PART 1');
  assert.equal(resolved.mode, 'f2f');
  assert.equal(resolved.location, 'G404B');
  assert.equal(resolved.day, 'MON');
  assert.equal(resolved.startMinutes, 555);
  assert.equal(resolved.professor, null);

  const imported = parseProfileJson(serializeProfile(profile));
  assert.deepEqual(imported.sections['NSTPCW1::CW1'].meetings[source.id], {
    synced: false,
    automatic: true,
  });
  assert.equal(imported.sections['NSTPCW1::CW1'].title, 'Shared NSTP title');
});

test('keeps every NSTP form code independent and rejects partial manual times', () => {
  const nstpCodes = ['NSTPCW1', 'NSTPCW2', 'NSTPLT1', 'NSTPLT2', 'NSTPRO1', 'NSTPRO2'];
  let profile = createProfile('NSTP');
  const meetings = nstpCodes.map((courseCode) => ({
    ...meeting({ id: `${courseCode}::S01::0`, courseCode, section: 'S01', title: `${courseCode} source` }),
  }));
  nstpCodes.forEach((courseCode) => {
    profile = setSectionCustomization(profile, courseCode, 'S01', { title: `${courseCode} override` });
  });
  meetings.forEach((entry) => {
    assert.equal(resolveMeetingCustomization(profile, entry).title, `${entry.courseCode} override`);
  });
  assert.throws(
    () => setSectionCustomization(profile, 'NSTPCW1', 'S01', { time: { day: 'SAT', startMinutes: 480 } }),
    (error) => error.code === 'INVALID_TIME',
  );
});

test('treats normal paired EAF schedules as variation instead of a manual conflict', () => {
  const first = meeting({ day: 'MON', startMinutes: 480, endMinutes: 570, location: 'G404B' });
  const second = meeting({
    id: 'STSP002::S30A::1',
    meetingOrdinal: 1,
    day: 'THU',
    startMinutes: 600,
    endMinutes: 690,
    location: 'G405B',
  });
  const state = getPairCustomizationState({ meetings: [first, second] }, createDefaultProfile(), first, 'pair');

  assert.equal(state.groupStatus, 'eaf-variation');
  assert.equal(state.hasActionableConflict, false);
  assert.equal(state.conflicts.length, 0);
  assert.ok(state.sourceDifferences.some((difference) => difference.field === 'time'));
  assert.ok(state.sourceDifferences.some((difference) => difference.field === 'room'));
  assert.deepEqual(getPairScopeLabel(state), {
    title: 'Paired meetings',
    help: 'Changes apply to both meetings.',
    status: "Automatic keeps each meeting's EAF schedule.",
  });
});

test('describes manual pair conflicts with human field values', () => {
  const first = meeting({ day: 'MON', startMinutes: 480, endMinutes: 570 });
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU' });
  const schedule = { meetings: [first, second] };
  let profile = setMeetingCustomization(createDefaultProfile(), 'STSP002', 'S30A', first.id, {
    mode: 'online',
    room: 'Zoom',
    time: { day: 'FRI', startMinutes: 780, endMinutes: 870 },
  });
  const state = getPairCustomizationState(schedule, profile, first, 'meeting');

  assert.equal(state.groupStatus, 'manual-conflict');
  assert.deepEqual(state.conflicts.map((difference) => difference.field), ['mode', 'time', 'room']);
  const timeDifference = formatPairFieldDifference(state.conflicts.find((difference) => difference.field === 'time'));
  assert.deepEqual(timeDifference, {
    label: 'Schedule',
    current: 'Friday, 1:00 PM–2:30 PM',
    pair: 'Monday, 8:00 AM–9:30 AM',
    ariaLabel: 'Schedule: this meeting Friday, 1:00 PM–2:30 PM; pair settings Monday, 8:00 AM–9:30 AM',
  });
});

test('use-pair removes only the selected independent entry', () => {
  const first = meeting();
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU' });
  const schedule = { meetings: [first, second] };
  let profile = setMeetingCustomization(createDefaultProfile(), 'STSP002', 'S30A', first.id, { mode: 'online' });
  profile = setMeetingCustomization(profile, 'STSP002', 'S30A', second.id, { title: 'Keep this change' });
  const state = getPairCustomizationState(schedule, profile, first, 'meeting');
  const next = applySyncConflictChoice(profile, {
    schedule,
    selectedMeeting: first,
    pairState: state,
  }, 'use-pair');

  assert.deepEqual(next.sections['STSP002::S30A'].meetings, {
    [second.id]: { synced: false, title: 'Keep this change' },
  });
  assert.deepEqual(profile.sections['STSP002::S30A'].meetings[first.id], { synced: false, mode: 'online' });
});

test('use-current-for-pair promotes conflict fields and preserves unrelated peer fields', () => {
  const first = meeting({ day: 'MON', startMinutes: 480, endMinutes: 570 });
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU', startMinutes: 600, endMinutes: 690 });
  const schedule = { meetings: [first, second] };
  let profile = setMeetingCustomization(createDefaultProfile(), 'STSP002', 'S30A', first.id, {
    mode: 'online',
    room: 'Zoom',
  });
  profile = setMeetingCustomization(profile, 'STSP002', 'S30A', second.id, {
    title: 'Peer-only title',
    room: 'B201',
  });
  const state = getPairCustomizationState(schedule, profile, first, 'meeting');
  const next = applySyncConflictChoice(profile, {
    schedule,
    selectedMeeting: first,
    pairState: state,
  }, 'use-current-for-pair');

  assert.deepEqual(next.sections['STSP002::S30A'], {
    mode: 'online',
    room: 'Zoom',
    meetings: {
      [second.id]: { synced: false, title: 'Peer-only title' },
    },
  });
  const entries = resolveScheduleEntries(schedule, next);
  assert.deepEqual(entries.map(({ resolved }) => [resolved.mode, resolved.location, resolved.day]), [
    ['online', 'Zoom', 'MON'],
    ['online', 'Zoom', 'THU'],
  ]);
});

test('conflict cancellation and invalid choices leave the profile untouched', () => {
  const first = meeting();
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU' });
  const schedule = { meetings: [first, second] };
  const profile = setMeetingCustomization(createDefaultProfile(), 'STSP002', 'S30A', first.id, { mode: 'online' });
  const context = {
    schedule,
    selectedMeeting: first,
    pairState: getPairCustomizationState(schedule, profile, first, 'meeting'),
  };

  assert.strictEqual(applySyncConflictChoice(profile, context, 'cancel'), profile);
  assert.throws(
    () => applySyncConflictChoice(profile, context, 'not-a-choice'),
    (error) => error.code === 'INVALID_SYNC_CHOICE',
  );
  assert.deepEqual(profile.sections['STSP002::S30A'].meetings[first.id], { synced: false, mode: 'online' });
});

test('Automatic conflicts can return a meeting to its EAF source or promote that source explicitly', () => {
  const first = meeting();
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU' });
  const schedule = { meetings: [first, second] };
  let profile = setSectionCustomization(createDefaultProfile(), 'STSP002', 'S30A', {
    mode: 'online',
    room: 'Zoom',
    title: 'Shared title',
  });
  profile = setMeetingAutomaticOverride(profile, 'STSP002', 'S30A', first.id);
  const state = getPairCustomizationState(schedule, profile, first, 'meeting');
  assert.deepEqual(state.conflicts.map((difference) => difference.field), ['mode', 'room', 'title']);

  const usePair = applySyncConflictChoice(profile, { schedule, selectedMeeting: first, pairState: state }, 'use-pair');
  assert.equal(resolveMeetingCustomization(usePair, first).mode, 'online');
  assert.equal(resolveMeetingCustomization(usePair, first).title, 'Shared title');

  const useCurrent = applySyncConflictChoice(profile, { schedule, selectedMeeting: first, pairState: state }, 'use-current-for-pair');
  assert.equal(resolveMeetingCustomization(useCurrent, first).mode, 'f2f');
  assert.equal(resolveMeetingCustomization(useCurrent, first).location, 'G404B');
  assert.equal(resolveMeetingCustomization(useCurrent, first).title, 'SPECIAL TOPICS');
  assert.equal(useCurrent.sections['STSP002::S30A'].meetings, undefined);
});

test('Automatic conflict drafts do not promote untouched EAF pair differences', () => {
  const first = meeting({ day: 'MON', startMinutes: 480, endMinutes: 570 });
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU', startMinutes: 600, endMinutes: 690 });
  const schedule = { meetings: [first, second] };
  let profile = setSectionCustomization(createDefaultProfile(), 'STSP002', 'S30A', {
    mode: 'online',
    room: 'Zoom',
  });
  profile = setMeetingAutomaticOverride(profile, 'STSP002', 'S30A', first.id);
  const state = getPairCustomizationState(schedule, profile, first, 'meeting');
  const automaticDraft = {
    courseCode: first.courseCode,
    section: first.section,
    title: first.title,
    time: { day: first.day, startMinutes: first.startMinutes, endMinutes: first.endMinutes },
    room: first.location,
    professor: first.professor,
    mode: 'inherit',
  };

  const next = applySyncConflictChoice(profile, {
    schedule,
    selectedMeeting: first,
    pairState: state,
    draftPatch: automaticDraft,
    changedFields: new Set(),
  }, 'use-current-for-pair');
  const entries = resolveScheduleEntries(schedule, next);
  assert.equal(next.sections['STSP002::S30A'].time, undefined);

  assert.deepEqual(entries.map(({ resolved }) => [resolved.mode, resolved.location, resolved.day, resolved.startMinutes]), [
    ['f2f', 'G404B', 'MON', 480],
    ['f2f', 'G404B', 'THU', 600],
  ]);

  const sharedTime = applySyncConflictChoice(profile, {
    schedule,
    selectedMeeting: first,
    pairState: state,
    draftPatch: automaticDraft,
    changedFields: new Set(['time']),
  }, 'use-current-for-pair');
  const sharedTimeEntries = resolveScheduleEntries(schedule, sharedTime);

  assert.deepEqual(sharedTimeEntries.map(({ resolved }) => [resolved.day, resolved.startMinutes, resolved.endMinutes]), [
    ['MON', 480, 570],
    ['MON', 480, 570],
  ]);
});

test('meeting scope label stays truthful before an independent edit exists', () => {
  const first = meeting({ day: 'MON', startMinutes: 480, endMinutes: 570 });
  const second = meeting({ id: 'STSP002::S30A::1', meetingOrdinal: 1, day: 'THU', startMinutes: 600, endMinutes: 690 });
  const state = getPairCustomizationState({ meetings: [first, second] }, createDefaultProfile(), first, 'meeting');

  assert.deepEqual(getPairScopeLabel(state), {
    title: 'This meeting',
    help: 'Only this meeting changes.',
    status: 'This meeting uses its EAF details.',
  });
});

test('NSTP source codes do not become one paired sync group', () => {
  const first = meeting({ courseCode: 'NSTPCW1', section: 'CW1', id: 'NSTPCW1::CW1::0' });
  const second = meeting({ courseCode: 'NSTPCW2', section: 'CW2', id: 'NSTPCW2::CW2::0' });
  const state = getPairCustomizationState({ meetings: [first, second] }, createDefaultProfile(), first, 'meeting');

  assert.equal(state.sectionKey, 'NSTPCW1::CW1');
  assert.equal(state.meetingCount, 1);
  assert.deepEqual(state.peerMeetingIds, []);
});
