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
  getActiveProfile,
  loadProfileStore,
  PROFILE_STORE_FORMAT,
  PROFILE_STORE_VERSION,
  normalizeHexColor,
  parseProfileJson,
  randomizeCourseColors,
  renameProfile,
  resetProfile,
  resetSectionCustomization,
  resolveMeetingCustomization,
  serializeProfile,
  setCourseColor,
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
