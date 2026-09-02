import { DAY_ORDER, DAY_SET, expandLocation } from './eaf-parser.js';

/** @typedef {'f2f'|'online'} SectionMode */
/** @typedef {'generated'|'plain'} DefaultColorMode */
/** @typedef {{ day: string, startMinutes: number, endMinutes: number }} ManualTime */
/** @typedef {{ automatic?: true, mode?: SectionMode, professor?: string, courseCode?: string, section?: string, title?: string, time?: ManualTime, room?: string }} MeetingCustomization */
/** @typedef {{ mode?: SectionMode, professor?: string, courseCode?: string, section?: string, title?: string, time?: ManualTime, room?: string, meetings?: Record<string, MeetingCustomization & { synced: false }> }} SectionCustomization */
/** @typedef {{ format: 'animosort-customization', version: 1, name: string, defaults: { color: DefaultColorMode, mode: 'infer' }, courses: Record<string, { color: string }>, sections: Record<string, SectionCustomization> }} CustomizationProfile */
/** @typedef {{ field: string, label: string, currentValue: string, pairValue: string, sourceValue: string, reason: 'eaf'|'manual' }} FieldDifference */
/** @typedef {{ sectionKey: string, selectedMeetingId: string, peerMeetingIds: string[], meetingCount: number, scope: 'meeting'|'pair', groupStatus: 'linked'|'eaf-variation'|'manual-conflict'|'partially-independent', sourceDifferences: FieldDifference[], conflicts: FieldDifference[], selectedOverrideFields: string[], peerOverrideFields: string[], hasActionableConflict: boolean }} PairCustomizationState */

export const CONFIG_FORMAT = 'animosort-customization';
export const CONFIG_VERSION = 1;
export const PROFILE_STORE_FORMAT = 'animosort-profile-store';
export const PROFILE_STORE_VERSION = 1;
export const DEFAULT_PROFILE_ID = 'default';
export const PROFILE_STORAGE_KEY = 'animosort_customization_profiles_v1';
export const LEGACY_COLOR_STORAGE_KEY = 'animosort_course_colors';
export const MAX_CUSTOMIZATION_FILE_SIZE = 256 * 1024;
export const PROFILE_NAME_LIMIT = 64;
export const PROFESSOR_NAME_LIMIT = 100;
export const COURSE_CODE_LIMIT = 24;
export const SECTION_NAME_LIMIT = 64;
export const TITLE_LIMIT = 160;
export const ROOM_NAME_LIMIT = 120;

const DEFAULT_IMPORTED_NAME = 'Imported profile';
const PALETTE_IDS = new Set(['plain', 'sage', 'sky', 'lavender', 'peach', 'mint', 'rose', 'sand', 'slate']);
const DETAIL_FIELDS = ['mode', 'time', 'room', 'courseCode', 'section', 'title', 'professor'];
const DETAIL_FIELD_LABELS = {
  mode: 'Delivery',
  time: 'Schedule',
  room: 'Room',
  courseCode: 'Course Code',
  section: 'Section',
  title: 'Title',
  professor: 'Professor',
};
const DAY_LABELS = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};

export class CustomizationConfigError extends Error {
  constructor(code, message, path = null) {
    super(message);
    this.name = 'CustomizationConfigError';
    this.code = code;
    this.path = path;
  }
}

export const COURSE_PALETTES = [
  {
    id: 'plain',
    name: 'Plain (Minimal)',
    swatch: '#94a3b8',
    isCustom: false,
    light: { bg: '#ffffff', border: '#cbd5e1', code: '#1e293b', title: '#334155', meta: '#64748b' },
    dark: { bg: '#0a0a0a', border: '#334155', code: '#f8fafc', title: '#cbd5e1', meta: '#94a3b8' },
  },
  {
    id: 'sage',
    name: 'Pastel Sage',
    swatch: '#52796f',
    isCustom: false,
    light: { bg: '#eaf4ee', border: '#aed2bc', code: '#245035', title: '#163823', meta: '#3d6c4f' },
    dark: { bg: '#0d1a14', border: '#2f523d', code: '#86efac', title: '#ecfdf5', meta: '#6ee7b7' },
  },
  {
    id: 'sky',
    name: 'Pastel Sky',
    swatch: '#4682b4',
    isCustom: false,
    light: { bg: '#e8f2fa', border: '#b0d1ee', code: '#1f5380', title: '#13395b', meta: '#3873a4' },
    dark: { bg: '#0c1724', border: '#285882', code: '#93c5fd', title: '#eff6ff', meta: '#60a5fa' },
  },
  {
    id: 'lavender',
    name: 'Pastel Lavender',
    swatch: '#7d6ba8',
    isCustom: false,
    light: { bg: '#f3eef9', border: '#cdc0ea', code: '#503a83', title: '#36245c', meta: '#6e5a9c' },
    dark: { bg: '#181226', border: '#564287', code: '#c4b5fd', title: '#faf5ff', meta: '#a78bfa' },
  },
  {
    id: 'peach',
    name: 'Pastel Peach',
    swatch: '#ba6e54',
    isCustom: false,
    light: { bg: '#f9eee8', border: '#e7c6b7', code: '#7f3c24', title: '#562514', meta: '#aa5f45' },
    dark: { bg: '#22120c', border: '#8a442b', code: '#fdba74', title: '#fff7ed', meta: '#fb923c' },
  },
  {
    id: 'mint',
    name: 'Pastel Mint',
    swatch: '#3f827c',
    isCustom: false,
    light: { bg: '#e7f5f3', border: '#a8dcd5', code: '#1c554e', title: '#103934', meta: '#30756e' },
    dark: { bg: '#0b1c1a', border: '#245953', code: '#5eead4', title: '#f0fdfa', meta: '#2dd4bf' },
  },
  {
    id: 'rose',
    name: 'Pastel Rose',
    swatch: '#b55e79',
    isCustom: false,
    light: { bg: '#f9ecf0', border: '#e6bac9', code: '#7d2d46', title: '#551a2c', meta: '#a64d6a' },
    dark: { bg: '#230e16', border: '#873650', code: '#f472b6', title: '#fdf2f8', meta: '#f43f5e' },
  },
  {
    id: 'sand',
    name: 'Pastel Sand',
    swatch: '#917c56',
    isCustom: false,
    light: { bg: '#f7f4ec', border: '#ded3bc', code: '#65512b', title: '#443419', meta: '#877149' },
    dark: { bg: '#1e1910', border: '#6e5a35', code: '#fde047', title: '#fefce8', meta: '#eab308' },
  },
  {
    id: 'slate',
    name: 'Pastel Slate',
    swatch: '#5a6f84',
    isCustom: false,
    light: { bg: '#edf2f6', border: '#b9c7d4', code: '#2e4154', title: '#1b2a38', meta: '#4f6479' },
    dark: { bg: '#11171f', border: '#36495d', code: '#94a3b8', title: '#f8fafc', meta: '#cbd5e1' },
  },
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeLimitedText(value, limit, code, label) {
  if (typeof value !== 'string') {
    throw new CustomizationConfigError(code, `${label} must be text.`, label.toLowerCase());
  }
  const text = value.trim();
  if (!text || [...text].length > limit) {
    throw new CustomizationConfigError(code, `${label} must contain between 1 and ${limit} characters.`, label.toLowerCase());
  }
  return text;
}

function truncateText(value, limit) {
  return [...value].slice(0, limit).join('').trim();
}

function normalizeProfileName(value) {
  return normalizeLimitedText(value, PROFILE_NAME_LIMIT, 'INVALID_NAME', 'Profile name');
}

function fallbackProfileName(value) {
  if (typeof value !== 'string') return '';
  const basename = value.replace(/^.*[\\/]/, '');
  return basename.replace(/\.[^.]*$/, '').trim();
}

function cloneMaps(profile) {
  return {
    ...profile,
    defaults: { ...profile.defaults },
    courses: { ...profile.courses },
    sections: Object.fromEntries(Object.entries(profile.sections || {}).map(([key, section]) => [
      key,
      {
        ...section,
        ...(isRecord(section?.meetings)
          ? { meetings: Object.fromEntries(Object.entries(section.meetings).map(([meetingId, meeting]) => [meetingId, { ...meeting }])) }
          : {}),
      },
    ])),
  };
}

export function normalizeCourseCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\s-]+/g, '').toUpperCase();
}

export function normalizeSection(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeTextOverride(value, limit, label, normalizer, path) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new CustomizationConfigError('INVALID_PROFILE', `${label} must be text.`, path);
  }
  const normalized = normalizer(value);
  if (!normalized) return null;
  if ([...normalized].length > limit) {
    throw new CustomizationConfigError('INVALID_PROFILE', `${label} must contain at most ${limit} characters.`, path);
  }
  return normalized;
}

function normalizeModeOverride(value, path, label = 'Section mode') {
  if (value === null || value === undefined || value === '') return null;
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (mode !== 'f2f' && mode !== 'online') {
    throw new CustomizationConfigError('INVALID_MODE', `${label} must be f2f or online.`, path);
  }
  return mode;
}

function normalizeManualTime(value, path) {
  if (!isRecord(value)) {
    throw new CustomizationConfigError('INVALID_TIME', 'A manual time must include a day, start time, and end time.', path);
  }
  const day = typeof value.day === 'string' ? value.day.trim().toUpperCase() : '';
  const startMinutes = value.startMinutes;
  const endMinutes = value.endMinutes;
  if (
    !DAY_SET.has(day)
    || !Number.isInteger(startMinutes)
    || !Number.isInteger(endMinutes)
    || startMinutes < 0
    || endMinutes > 1439
    || endMinutes <= startMinutes
  ) {
    throw new CustomizationConfigError('INVALID_TIME', 'Choose a Monday–Saturday day and a valid time interval.', path);
  }
  return { day, startMinutes, endMinutes };
}

function applyCustomizationPatch(patch, path = 'patch', labelPrefix = 'Section') {
  if (!isRecord(patch)) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'Customization changes must be an object.', path);
  }
  const result = {};
  if (hasOwn(patch, 'mode')) {
    const mode = normalizeModeOverride(patch.mode, `${path}.mode`, `${labelPrefix} mode`);
    if (mode) result.mode = mode;
  }
  if (hasOwn(patch, 'professor')) {
    const professor = normalizeTextOverride(patch.professor, PROFESSOR_NAME_LIMIT, 'Professor', (value) => value.trim(), `${path}.professor`);
    if (professor) result.professor = professor;
  }
  if (hasOwn(patch, 'courseCode')) {
    const courseCode = normalizeTextOverride(patch.courseCode, COURSE_CODE_LIMIT, 'Course code', normalizeCourseCode, `${path}.courseCode`);
    if (courseCode) result.courseCode = courseCode;
  }
  if (hasOwn(patch, 'section')) {
    const section = normalizeTextOverride(patch.section, SECTION_NAME_LIMIT, 'Section', normalizeSection, `${path}.section`);
    if (section) result.section = section;
  }
  if (hasOwn(patch, 'title')) {
    const title = normalizeTextOverride(patch.title, TITLE_LIMIT, 'Title', (value) => value.trim().replace(/\s+/g, ' '), `${path}.title`);
    if (title) result.title = title;
  }
  if (hasOwn(patch, 'time')) {
    if (patch.time !== null && patch.time !== undefined) result.time = normalizeManualTime(patch.time, `${path}.time`);
  }
  if (hasOwn(patch, 'room')) {
    const room = normalizeTextOverride(
      patch.room,
      ROOM_NAME_LIMIT,
      'Room',
      (value) => /^online$/i.test(value.trim()) ? 'Online' : value.trim().replace(/\s+/g, ' '),
      `${path}.room`,
    );
    if (room) result.room = room;
  }
  return result;
}

function normalizeMeetingOverrides(meetings, path, sectionKey) {
  if (meetings === undefined) return {};
  if (!isRecord(meetings)) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'Meeting customizations must be an object.', path);
  }
  const result = {};
  for (const [rawMeetingId, rawEntry] of Object.entries(meetings)) {
    const parts = rawMeetingId.split('::');
    const ordinal = parts.length === 3 ? Number(parts[2]) : NaN;
    const meetingId = parts.length === 3
      && getSectionKey(parts[0], parts[1]) === sectionKey
      && Number.isInteger(ordinal)
      && ordinal >= 0
      ? `${sectionKey}::${ordinal}`
      : '';
    if (!meetingId) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'A meeting customization needs a stable meeting id.', path);
    }
    if (hasOwn(result, meetingId)) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'Two meeting customizations resolve to the same meeting.', `${path}.${rawMeetingId}`);
    }
    if (!isRecord(rawEntry) || rawEntry.synced !== false) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'A meeting customization must explicitly be unsynced.', `${path}.${meetingId}`);
    }
    const hasAutomaticReset = hasOwn(rawEntry, 'automatic');
    if (hasAutomaticReset && rawEntry.automatic !== true) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'An automatic meeting reset must be true when present.', `${path}.${meetingId}.automatic`);
    }
    const entry = applyCustomizationPatch(rawEntry, `${path}.${rawMeetingId}`, 'Meeting');
    if (hasAutomaticReset && Object.keys(entry).length) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'An automatic meeting reset cannot include manual details.', `${path}.${meetingId}`);
    }
    if (hasAutomaticReset) result[meetingId] = { synced: false, automatic: true };
    else if (Object.keys(entry).length) result[meetingId] = { synced: false, ...entry };
  }
  return result;
}

export function getCourseKey(courseCode) {
  const key = normalizeCourseCode(courseCode);
  if (!key) {
    throw new CustomizationConfigError('INVALID_COURSE_KEY', 'A course code is required.', 'courseCode');
  }
  return key;
}

export function getSectionKey(courseCode, section) {
  const courseKey = normalizeCourseCode(courseCode);
  const sectionKey = normalizeSection(section);
  if (!courseKey || !sectionKey) {
    throw new CustomizationConfigError('INVALID_SECTION_KEY', 'A course code and section are required.', 'section');
  }
  return `${courseKey}::${sectionKey}`;
}

export function normalizeHexColor(value) {
  if (typeof value !== 'string') return null;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1].length === 3
    ? match[1].split('').map((digit) => `${digit}${digit}`).join('')
    : match[1];
  return `#${digits.toLowerCase()}`;
}

export function isColorValue(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return PALETTE_IDS.has(normalized) || normalizeHexColor(normalized) !== null;
}

function normalizeColorValue(value, path = 'color') {
  if (typeof value === 'string') {
    const preset = value.trim().toLowerCase();
    if (PALETTE_IDS.has(preset)) return preset;
  }
  const hex = normalizeHexColor(value);
  if (hex) return hex;
  throw new CustomizationConfigError('INVALID_COLOR', 'Choose a palette preset or an opaque 3- or 6-digit hex color.', path);
}

function toHex(value) {
  const hex = Math.max(0, Math.min(255, Math.round(value))).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex) || '#64748b';
  const number = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

export function createCustomPalette(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    throw new CustomizationConfigError('INVALID_COLOR', 'A custom palette requires a valid hex color.', 'color');
  }
  const { r, g, b } = hexToRgb(normalized);
  const lightBg = `#${toHex(r * 0.12 + 255 * 0.88)}${toHex(g * 0.12 + 255 * 0.88)}${toHex(b * 0.12 + 255 * 0.88)}`;
  const lightBorder = `#${toHex(r * 0.45 + 255 * 0.55)}${toHex(g * 0.45 + 255 * 0.55)}${toHex(b * 0.45 + 255 * 0.55)}`;
  const lightCode = `#${toHex(r * 0.7)}${toHex(g * 0.7)}${toHex(b * 0.7)}`;
  const lightTitle = `#${toHex(r * 0.4)}${toHex(g * 0.4)}${toHex(b * 0.4)}`;
  const lightMeta = `#${toHex(r * 0.6)}${toHex(g * 0.6)}${toHex(b * 0.6)}`;
  const darkBg = `#${toHex(r * 0.14)}${toHex(g * 0.14)}${toHex(b * 0.14)}`;
  const darkBorder = `#${toHex(r * 0.6 + 20)}${toHex(g * 0.6 + 20)}${toHex(b * 0.6 + 20)}`;
  const darkCode = `#${toHex(r * 0.4 + 255 * 0.6)}${toHex(g * 0.4 + 255 * 0.6)}${toHex(b * 0.4 + 255 * 0.6)}`;
  const darkTitle = '#f8fafc';
  const darkMeta = `#${toHex(r * 0.5 + 255 * 0.5)}${toHex(g * 0.5 + 255 * 0.5)}${toHex(b * 0.5 + 255 * 0.5)}`;

  return {
    id: `custom-${normalized.slice(1)}`,
    name: `Custom (${normalized.toUpperCase()})`,
    swatch: normalized,
    isCustom: true,
    light: { bg: lightBg, border: lightBorder, code: lightCode, title: lightTitle, meta: lightMeta },
    dark: { bg: darkBg, border: darkBorder, code: darkCode, title: darkTitle, meta: darkMeta },
  };
}

export function getPaletteById(idOrHex) {
  if (typeof idOrHex !== 'string' || !idOrHex.trim()) return COURSE_PALETTES[1];
  const value = idOrHex.trim().toLowerCase();
  const preset = COURSE_PALETTES.find((palette) => palette.id === value);
  if (preset) return preset;
  const hex = normalizeHexColor(value);
  return hex ? createCustomPalette(hex) : COURSE_PALETTES[1];
}

function normalizeDefaults(defaults, path = 'defaults') {
  if (defaults !== undefined && !isRecord(defaults)) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'Profile defaults must be an object.', path);
  }
  const color = defaults && hasOwn(defaults, 'color') ? defaults.color : 'generated';
  const mode = defaults && hasOwn(defaults, 'mode') ? defaults.mode : 'infer';
  if (color !== 'generated' && color !== 'plain') {
    throw new CustomizationConfigError('INVALID_PROFILE', 'The default color mode must be generated or plain.', `${path}.color`);
  }
  if (mode !== 'infer') {
    throw new CustomizationConfigError('INVALID_PROFILE', 'The default delivery mode must be infer.', `${path}.mode`);
  }
  return { color, mode };
}

function normalizeCourses(courses) {
  if (courses === undefined) return {};
  if (!isRecord(courses)) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'Course customizations must be an object.', 'courses');
  }
  const result = {};
  for (const [rawKey, rawEntry] of Object.entries(courses)) {
    let key;
    try {
      key = getCourseKey(rawKey);
    } catch (error) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'A course customization has an invalid course code.', `courses.${rawKey}`);
    }
    if (hasOwn(result, key)) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'Two course customizations resolve to the same course code.', `courses.${rawKey}`);
    }
    if (!isRecord(rawEntry) || !hasOwn(rawEntry, 'color')) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'Each course customization needs a color.', `courses.${rawKey}`);
    }
    result[key] = { color: normalizeColorValue(rawEntry.color, `courses.${rawKey}.color`) };
  }
  return result;
}

function parseSectionKey(rawKey) {
  if (typeof rawKey !== 'string') {
    throw new CustomizationConfigError('INVALID_PROFILE', 'A section customization key must be text.', 'sections');
  }
  const separator = rawKey.indexOf('::');
  if (separator < 1) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'A section key must use COURSECODE::SECTION.', `sections.${rawKey}`);
  }
  const courseCode = rawKey.slice(0, separator);
  const section = rawKey.slice(separator + 2);
  return getSectionKey(courseCode, section);
}

function normalizeSections(sections) {
  if (sections === undefined) return {};
  if (!isRecord(sections)) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'Section customizations must be an object.', 'sections');
  }
  const result = {};
  for (const [rawKey, rawEntry] of Object.entries(sections)) {
    const key = parseSectionKey(rawKey);
    if (hasOwn(result, key)) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'Two section customizations resolve to the same section.', `sections.${rawKey}`);
    }
    if (!isRecord(rawEntry)) {
      throw new CustomizationConfigError('INVALID_PROFILE', 'Each section customization must be an object.', `sections.${rawKey}`);
    }
    const entry = applyCustomizationPatch(rawEntry, `sections.${rawKey}`);
    const meetings = normalizeMeetingOverrides(rawEntry.meetings, `sections.${rawKey}.meetings`, key);
    if (Object.keys(meetings).length) entry.meetings = meetings;
    if (Object.keys(entry).length) result[key] = entry;
  }
  return result;
}

export function normalizeProfile(raw, fallbackName) {
  if (!isRecord(raw)) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'A customization profile must be an object.');
  }
  if (raw.format !== CONFIG_FORMAT) {
    throw new CustomizationConfigError('INVALID_FORMAT', 'This file is not an AnimoSort customization profile.', 'format');
  }
  if (raw.version !== CONFIG_VERSION) {
    throw new CustomizationConfigError('UNSUPPORTED_VERSION', 'This customization profile version is not supported.', 'version');
  }
  if (hasOwn(raw, 'session') || hasOwn(raw, 'meetings')) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'Customization profiles cannot contain imported schedule data.', 'profile');
  }

  let name;
  if (hasOwn(raw, 'name')) {
    name = normalizeProfileName(raw.name);
  } else {
    const fallback = fallbackProfileName(fallbackName) || DEFAULT_IMPORTED_NAME;
    name = normalizeProfileName(truncateText(fallback, PROFILE_NAME_LIMIT));
  }

  return {
    format: CONFIG_FORMAT,
    version: CONFIG_VERSION,
    name,
    defaults: normalizeDefaults(raw.defaults),
    courses: normalizeCourses(raw.courses),
    sections: normalizeSections(raw.sections),
  };
}

export function createProfile(name, defaults = {}) {
  return {
    format: CONFIG_FORMAT,
    version: CONFIG_VERSION,
    name: normalizeProfileName(name),
    defaults: normalizeDefaults(defaults),
    courses: {},
    sections: {},
  };
}

export function createDefaultProfile() {
  return createProfile('Default', { color: 'generated', mode: 'infer' });
}

export function setCourseColor(profile, courseCode, color) {
  const next = cloneMaps(profile);
  const key = getCourseKey(courseCode);
  next.courses[key] = { color: normalizeColorValue(color) };
  return next;
}

export function setSectionCustomization(profile, courseCode, section, patch) {
  const next = cloneMaps(profile);
  const key = getSectionKey(courseCode, section);
  const current = isRecord(next.sections[key]) ? { ...next.sections[key] } : {};
  const updated = applyCustomizationPatch(patch);
  for (const property of ['mode', 'professor', 'courseCode', 'section', 'title', 'time', 'room']) {
    if (!hasOwn(patch, property)) continue;
    if (hasOwn(updated, property)) current[property] = updated[property];
    else delete current[property];
  }
  if (Object.keys(current).some((property) => property !== 'meetings') || Object.keys(current.meetings || {}).length) next.sections[key] = current;
  else delete next.sections[key];
  return next;
}

export function setMeetingCustomization(profile, courseCode, section, meetingId, patch) {
  if (typeof meetingId !== 'string' || !meetingId.trim()) {
    throw new CustomizationConfigError('INVALID_MEETING_ID', 'A stable meeting id is required.', 'meetingId');
  }
  const key = getSectionKey(courseCode, section);
  if (!meetingId.startsWith(`${key}::`)) {
    throw new CustomizationConfigError('INVALID_MEETING_ID', 'The meeting does not belong to this course section.', 'meetingId');
  }
  const next = cloneMaps(profile);
  const sectionCurrent = isRecord(next.sections[key]) ? { ...next.sections[key] } : {};
  const meetings = isRecord(sectionCurrent.meetings) ? { ...sectionCurrent.meetings } : {};
  const updated = applyCustomizationPatch(patch, 'patch', 'Meeting');
  if (Object.keys(updated).length) meetings[meetingId] = { synced: false, ...updated };
  else delete meetings[meetingId];
  if (Object.keys(meetings).length) sectionCurrent.meetings = meetings;
  else delete sectionCurrent.meetings;
  if (Object.keys(sectionCurrent).length) next.sections[key] = sectionCurrent;
  else delete next.sections[key];
  return next;
}

export function setMeetingAutomaticOverride(profile, courseCode, section, meetingId) {
  if (typeof meetingId !== 'string' || !meetingId.trim()) {
    throw new CustomizationConfigError('INVALID_MEETING_ID', 'A stable meeting id is required.', 'meetingId');
  }
  const key = getSectionKey(courseCode, section);
  if (!meetingId.startsWith(`${key}::`)) {
    throw new CustomizationConfigError('INVALID_MEETING_ID', 'The meeting does not belong to this course section.', 'meetingId');
  }
  const next = cloneMaps(profile);
  const sectionCurrent = isRecord(next.sections[key]) ? { ...next.sections[key] } : {};
  const meetings = isRecord(sectionCurrent.meetings) ? { ...sectionCurrent.meetings } : {};
  meetings[meetingId] = { synced: false, automatic: true };
  sectionCurrent.meetings = meetings;
  next.sections[key] = sectionCurrent;
  return next;
}

export function resetMeetingCustomization(profile, courseCode, section, meetingId) {
  if (typeof meetingId !== 'string' || !meetingId.trim()) {
    throw new CustomizationConfigError('INVALID_MEETING_ID', 'A stable meeting id is required.', 'meetingId');
  }
  const key = getSectionKey(courseCode, section);
  if (!meetingId.startsWith(`${key}::`)) {
    throw new CustomizationConfigError('INVALID_MEETING_ID', 'The meeting does not belong to this course section.', 'meetingId');
  }
  const next = cloneMaps(profile);
  const sectionCurrent = next.sections[key];
  if (!isRecord(sectionCurrent) || !isRecord(sectionCurrent.meetings)) return next;
  const meetings = { ...sectionCurrent.meetings };
  delete meetings[meetingId];
  const updatedSection = { ...sectionCurrent };
  if (Object.keys(meetings).length) updatedSection.meetings = meetings;
  else delete updatedSection.meetings;
  if (Object.keys(updatedSection).length) next.sections[key] = updatedSection;
  else delete next.sections[key];
  return next;
}

export function resetSectionCustomization(profile, courseCode, section) {
  const next = cloneMaps(profile);
  delete next.sections[getSectionKey(courseCode, section)];
  return next;
}

export function resetSectionDefaults(profile, courseCode, section) {
  const next = cloneMaps(profile);
  const key = getSectionKey(courseCode, section);
  const current = next.sections[key];
  if (!isRecord(current) || !isRecord(current.meetings) || !Object.keys(current.meetings).length) {
    delete next.sections[key];
    return next;
  }
  next.sections[key] = { meetings: current.meetings };
  return next;
}

export function resetProfile(profile, scope) {
  if (!['colors', 'details', 'all'].includes(scope)) {
    throw new CustomizationConfigError('INVALID_RESET_SCOPE', 'Reset scope must be colors, details, or all.', 'scope');
  }
  const next = cloneMaps(profile);
  if (scope === 'colors' || scope === 'all') {
    next.defaults.color = 'plain';
    next.courses = {};
  }
  if (scope === 'details' || scope === 'all') {
    next.defaults.mode = 'infer';
    next.sections = {};
  }
  return next;
}

function safeRandom(random) {
  const value = Number(random());
  return Number.isFinite(value) && value >= 0 && value < 1 ? value : 0;
}

export function randomizeCourseColors(profile, courseCodes, random = Math.random) {
  if (typeof random !== 'function') {
    throw new CustomizationConfigError('INVALID_RANDOMIZER', 'Randomizer must be a function.', 'random');
  }
  const next = cloneMaps(profile);
  const codes = [];
  const seen = new Set();
  for (const code of Array.isArray(courseCodes) ? courseCodes : []) {
    const key = getCourseKey(code);
    if (!seen.has(key)) {
      seen.add(key);
      codes.push(key);
    }
  }
  const palettes = COURSE_PALETTES.slice(1).map((palette) => palette.id);
  for (let index = palettes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(safeRandom(random) * (index + 1));
    [palettes[index], palettes[swapIndex]] = [palettes[swapIndex], palettes[index]];
  }
  codes.forEach((code, index) => {
    next.courses[code] = { color: palettes[index % palettes.length] };
  });
  return next;
}

export function buildCourseColorMap(schedule, profile = createDefaultProfile()) {
  const map = {};
  if (!schedule || !Array.isArray(schedule.meetings)) return map;
  const distinctCourses = [];
  const seen = new Set();
  for (const meeting of schedule.meetings) {
    const key = normalizeCourseCode(meeting?.courseCode);
    if (key && !seen.has(key)) {
      seen.add(key);
      distinctCourses.push(key);
    }
  }
  const pastelPresets = COURSE_PALETTES.slice(1);
  for (const [index, code] of distinctCourses.entries()) {
    const override = profile && isRecord(profile.courses) && profile.courses[code]?.color;
    if (override) {
      map[code] = getPaletteById(override);
    } else if (profile?.defaults?.color === 'plain') {
      map[code] = COURSE_PALETTES[0];
    } else {
      map[code] = pastelPresets[index % pastelPresets.length];
    }
  }
  return map;
}

function formatTimeLabel(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return '';
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
}

function sourceMeetingId(meeting, sectionKey, fallbackOrdinal = 0) {
  if (typeof meeting?.id === 'string' && meeting.id.trim()) return meeting.id.trim();
  const ordinal = Number.isInteger(meeting?.meetingOrdinal) && meeting.meetingOrdinal >= 0
    ? meeting.meetingOrdinal
    : fallbackOrdinal;
  return `${sectionKey}::${ordinal}`;
}

function isScheduledTime(value) {
  return isRecord(value)
    && DAY_SET.has(value.day)
    && Number.isInteger(value.startMinutes)
    && Number.isInteger(value.endMinutes)
    && value.startMinutes >= 0
    && value.endMinutes <= 1439
    && value.endMinutes > value.startMinutes;
}

function pickCustomizationValue(meetingOverride, section, source, property) {
  if (meetingOverride && hasOwn(meetingOverride, property)) return meetingOverride[property];
  if (section && hasOwn(section, property)) return section[property];
  return source;
}

export function resolveMeetingCustomization(profile, meeting, courseIndex = 0, courseColorMap, fallbackOrdinal = 0) {
  const courseKey = getCourseKey(meeting?.courseCode);
  const sectionKey = getSectionKey(meeting?.courseCode, meeting?.section);
  const meetingId = sourceMeetingId(meeting, sectionKey, fallbackOrdinal);
  const map = courseColorMap || buildCourseColorMap({ meetings: [meeting] }, profile);
  const palette = map[courseKey] || getPaletteById(profile?.defaults?.color === 'plain' ? 'plain' : COURSE_PALETTES[1].id);
  const section = profile && isRecord(profile.sections) && isRecord(profile.sections[sectionKey])
    ? profile.sections[sectionKey]
    : {};
  const meetingOverride = isRecord(section.meetings) && isRecord(section.meetings[meetingId])
    && section.meetings[meetingId].synced === false
    ? section.meetings[meetingId]
    : null;
  const automaticReset = meetingOverride?.automatic === true;
  const detailMeetingOverride = automaticReset ? null : meetingOverride;
  const detailSection = automaticReset ? {} : section;
  const sourceTime = meeting?.scheduled === false || !isScheduledTime({
    day: typeof meeting?.day === 'string' ? meeting.day.trim().toUpperCase() : '',
    startMinutes: meeting?.startMinutes,
    endMinutes: meeting?.endMinutes,
  })
    ? null
    : {
      day: meeting.day.trim().toUpperCase(),
      startMinutes: meeting.startMinutes,
      endMinutes: meeting.endMinutes,
    };
  const time = pickCustomizationValue(detailMeetingOverride, detailSection, sourceTime, 'time');
  const scheduled = isScheduledTime(time);
  const courseCode = pickCustomizationValue(detailMeetingOverride, detailSection, meeting.courseCode, 'courseCode');
  const displaySection = pickCustomizationValue(detailMeetingOverride, detailSection, meeting.section, 'section');
  const title = pickCustomizationValue(detailMeetingOverride, detailSection, meeting.title, 'title');
  const sourceLocation = typeof meeting.location === 'string' && meeting.location.trim() ? meeting.location.trim() : null;
  const sourceIsOnline = meeting?.modality === 'online' || /^online$/i.test(String(sourceLocation || '').trim());
  const explicitMode = pickCustomizationValue(detailMeetingOverride, detailSection, null, 'mode');
  const selectedLocation = pickCustomizationValue(detailMeetingOverride, detailSection, sourceLocation, 'room');
  const hasManualRoom = Boolean(
    (detailMeetingOverride && hasOwn(detailMeetingOverride, 'room'))
      || (detailSection && hasOwn(detailSection, 'room')),
  );
  const inferredOnline = /^online$/i.test(String(selectedLocation || '').trim())
    || sourceIsOnline;
  const mode = explicitMode || (inferredOnline ? 'online' : scheduled ? 'f2f' : 'async');
  const location = mode === 'f2f' && sourceIsOnline && !hasManualRoom ? null : selectedLocation;
  const locationSource = detailMeetingOverride && hasOwn(detailMeetingOverride, 'room')
    ? 'meeting'
    : detailSection && hasOwn(detailSection, 'room')
      ? 'section'
      : 'eaf';
  const expandedLocation = location
    ? (detailMeetingOverride?.room || detailSection.room ? expandLocation(location) : meeting.expandedLocation || expandLocation(location))
    : null;
  const professor = pickCustomizationValue(detailMeetingOverride, detailSection, null, 'professor') || null;
  const hasSectionOverride = Object.keys(detailSection).some((property) => property !== 'meetings');
  const syncSource = meetingOverride ? 'meeting' : hasSectionOverride ? 'section' : 'eaf';
  const startLabel = scheduled
    ? time.startMinutes === sourceTime?.startMinutes && time.endMinutes === sourceTime?.endMinutes && time.day === sourceTime?.day
      ? meeting.startLabel || formatTimeLabel(time.startMinutes)
      : formatTimeLabel(time.startMinutes)
    : null;
  const endLabel = scheduled
    ? time.startMinutes === sourceTime?.startMinutes && time.endMinutes === sourceTime?.endMinutes && time.day === sourceTime?.day
      ? meeting.endLabel || formatTimeLabel(time.endMinutes)
      : formatTimeLabel(time.endMinutes)
    : null;
  return {
    sourceCourseCode: meeting.courseCode,
    sourceSection: meeting.section,
    courseKey,
    sectionKey,
    meetingId,
    synced: !meetingOverride,
    syncSource,
    courseCode,
    section: displaySection,
    title,
    day: scheduled ? time.day : null,
    startMinutes: scheduled ? time.startMinutes : null,
    endMinutes: scheduled ? time.endMinutes : null,
    startLabel,
    endLabel,
    location,
    locationSource,
    expandedLocation,
    scheduled,
    palette,
    mode,
    professor,
    colorSource: profile?.courses?.[courseKey]?.color ? 'course' : 'profile-default',
    modeSource: detailMeetingOverride?.mode ? 'meeting' : detailSection.mode ? 'section' : 'eaf-inferred',
    courseIndex,
  };
}

export function resolveScheduleEntries(schedule, profile = createDefaultProfile()) {
  if (!schedule || !Array.isArray(schedule.meetings)) return [];
  const courseColorMap = buildCourseColorMap(schedule, profile);
  const courseIndexes = new Map();
  for (const meeting of schedule.meetings) {
    const code = normalizeCourseCode(meeting?.courseCode);
    if (code && !courseIndexes.has(code)) courseIndexes.set(code, courseIndexes.size);
  }
  return schedule.meetings.map((meeting, index) => {
    const courseKey = getCourseKey(meeting.courseCode);
    const resolved = resolveMeetingCustomization(profile, meeting, courseIndexes.get(courseKey) || 0, courseColorMap, index);
    return {
      meeting,
      resolved,
      effective: {
        ...meeting,
        id: resolved.meetingId,
        courseCode: resolved.courseCode,
        section: resolved.section,
        title: resolved.title,
        day: resolved.day,
        startMinutes: resolved.startMinutes,
        endMinutes: resolved.endMinutes,
        startLabel: resolved.startLabel,
        endLabel: resolved.endLabel,
        location: resolved.location,
        expandedLocation: resolved.expandedLocation,
        scheduled: resolved.scheduled,
        modality: resolved.mode === 'online' ? 'online' : meeting.modality,
      },
    };
  });
}

export function formatMeetingMetadataLines(meeting, resolved) {
  const sourceIsOnline = meeting?.modality === 'online' || /^online$/i.test(String(meeting?.location || '').trim());
  const missingPhysicalRoom = resolved?.mode === 'f2f' && sourceIsOnline && !resolved?.location;
  const rawLocation = missingPhysicalRoom
    ? 'Room not specified'
    : resolved?.expandedLocation || meeting?.expandedLocation || expandLocation(resolved?.location || meeting?.location) || resolved?.location || meeting?.location || 'Room not specified';
  const location = resolved?.mode === 'f2f' && /^online$/i.test(String(rawLocation).trim()) ? 'Room not specified' : rawLocation;
  const onlineDetail = String(location).trim();
  const looksLikePhysicalRoom = /^(?:room\s+)?[A-Z]{1,6}\s*\d[A-Z0-9-]*$/i.test(onlineDetail);
  const hasOnlineDetail = onlineDetail
    && !/^online$/i.test(onlineDetail)
    && onlineDetail !== 'Room not specified'
    && !looksLikePhysicalRoom
    && (resolved?.locationSource !== 'eaf' || sourceIsOnline);
  const locationMode = resolved.mode === 'online'
    ? `Mode: Online${hasOnlineDetail ? ` · ${onlineDetail}` : ''}`
    : resolved.mode === 'async'
      ? 'Mode: Async · no fixed time'
      : `Room: ${String(location)} · F2F`;
  const professor = resolved.professor ? `Professor: ${resolved.professor}` : null;
  const time = resolved.scheduled === false
    ? null
    : `Time: ${resolved.startLabel || meeting?.startLabel || ''} - ${resolved.endLabel || meeting?.endLabel || ''}`.trim();
  return { locationMode, professor, time };
}

function getSourceTime(meeting) {
  if (meeting?.scheduled === false) return null;
  const time = {
    day: typeof meeting?.day === 'string' ? meeting.day.trim().toUpperCase() : '',
    startMinutes: meeting?.startMinutes,
    endMinutes: meeting?.endMinutes,
  };
  return isScheduledTime(time) ? time : null;
}

function getSourceMode(meeting) {
  if (meeting?.modality === 'online' || /^online$/i.test(String(meeting?.location || '').trim())) return 'online';
  return getSourceTime(meeting) ? 'f2f' : 'async';
}

function getSourceFieldValue(meeting, field) {
  if (field === 'mode') return getSourceMode(meeting);
  if (field === 'time') return getSourceTime(meeting);
  if (field === 'room') {
    return typeof meeting?.location === 'string' && meeting.location.trim() ? meeting.location.trim() : null;
  }
  if (field === 'courseCode') return typeof meeting?.courseCode === 'string' ? meeting.courseCode.trim() : null;
  if (field === 'section') return typeof meeting?.section === 'string' ? meeting.section.trim() : null;
  if (field === 'title') return typeof meeting?.title === 'string' && meeting.title.trim() ? meeting.title.trim() : null;
  if (field === 'professor') return typeof meeting?.professor === 'string' && meeting.professor.trim() ? meeting.professor.trim() : null;
  return null;
}

function getResolvedFieldValue(resolved, field) {
  if (field === 'mode') return resolved?.mode || null;
  if (field === 'time') {
    if (!resolved?.scheduled) return null;
    return {
      day: resolved.day,
      startMinutes: resolved.startMinutes,
      endMinutes: resolved.endMinutes,
    };
  }
  if (field === 'room') return resolved?.location || null;
  if (field === 'courseCode') return resolved?.courseCode || null;
  if (field === 'section') return resolved?.section || null;
  if (field === 'title') return resolved?.title || null;
  if (field === 'professor') return resolved?.professor || null;
  return null;
}

function comparableFieldValue(value, field) {
  if (field === 'time') {
    if (!isScheduledTime(value)) return '';
    return `${value.day}|${value.startMinutes}|${value.endMinutes}`;
  }
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase();
}

function fieldValuesEqual(first, second, field) {
  return comparableFieldValue(first, field) === comparableFieldValue(second, field);
}

function formatPairFieldValue(field, value) {
  if (field === 'mode') {
    if (value === 'online') return 'Online';
    if (value === 'f2f') return 'F2F';
    if (value === 'async') return 'Async';
    return 'Automatic';
  }
  if (field === 'time') {
    if (!isScheduledTime(value)) return 'No fixed time';
    const day = DAY_LABELS[value.day] || value.day;
    return `${day}, ${formatTimeLabel(value.startMinutes)}–${formatTimeLabel(value.endMinutes)}`;
  }
  if (field === 'room') return value ? String(value).trim() : 'Room not specified';
  if (field === 'courseCode') return value ? String(value).trim() : 'Not specified';
  if (field === 'section') return value ? String(value).trim() : 'Not specified';
  if (field === 'title') return value ? String(value).trim() : 'Not specified';
  if (field === 'professor') return value ? String(value).trim() : 'Not specified';
  return 'Not specified';
}

function getSectionRecord(profile, sectionKey) {
  return profile && isRecord(profile.sections) && isRecord(profile.sections[sectionKey])
    ? profile.sections[sectionKey]
    : {};
}

function getMeetingOverride(section, meetingId) {
  return isRecord(section.meetings) && isRecord(section.meetings[meetingId])
    ? section.meetings[meetingId]
    : null;
}

function getOwnedMeetingFields(override) {
  if (!isRecord(override)) return [];
  if (override.automatic === true) return DETAIL_FIELDS.slice();
  return DETAIL_FIELDS.filter((field) => hasOwn(override, field));
}

function getSourceMeetingIdForPair(meeting, sectionKey, fallbackOrdinal) {
  return sourceMeetingId(meeting, sectionKey, fallbackOrdinal);
}

function assertPairScope(scope) {
  if (scope !== 'meeting' && scope !== 'pair') {
    throw new CustomizationConfigError('INVALID_SYNC_SCOPE', 'Sync scope must be meeting or pair.', 'scope');
  }
}

function assertPairContext(schedule, selectedMeeting) {
  if (!schedule || !Array.isArray(schedule.meetings)) {
    throw new CustomizationConfigError('INVALID_SCHEDULE', 'A schedule with meetings is required.', 'schedule');
  }
  if (!isRecord(selectedMeeting)) {
    throw new CustomizationConfigError('INVALID_MEETING', 'A selected meeting is required.', 'selectedMeeting');
  }
  const sectionKey = getSectionKey(selectedMeeting.courseCode, selectedMeeting.section);
  const selectedId = getSourceMeetingIdForPair(selectedMeeting, sectionKey, 0);
  const selectedIndex = schedule.meetings.findIndex((meeting, index) => (
    meeting === selectedMeeting
      || getSectionKey(meeting.courseCode, meeting.section) === sectionKey
        && getSourceMeetingIdForPair(meeting, sectionKey, index) === selectedId
  ));
  if (selectedIndex < 0) {
    throw new CustomizationConfigError('INVALID_MEETING', 'The selected meeting is not in the schedule.', 'selectedMeeting');
  }
  return { sectionKey, selectedIndex, selectedMeeting: schedule.meetings[selectedIndex] };
}

function buildSourceDifference(field, selectedSource, peerSource) {
  return {
    field,
    label: DETAIL_FIELD_LABELS[field],
    currentValue: formatPairFieldValue(field, getSourceFieldValue(selectedSource, field)),
    pairValue: formatPairFieldValue(field, getSourceFieldValue(peerSource, field)),
    sourceValue: formatPairFieldValue(field, getSourceFieldValue(selectedSource, field)),
    reason: 'eaf',
  };
}

function buildManualDifference(field, selectedResolved, pairResolved, selectedSource) {
  return {
    field,
    label: DETAIL_FIELD_LABELS[field],
    currentValue: formatPairFieldValue(field, getResolvedFieldValue(selectedResolved, field)),
    pairValue: formatPairFieldValue(field, getResolvedFieldValue(pairResolved, field)),
    sourceValue: formatPairFieldValue(field, getSourceFieldValue(selectedSource, field)),
    reason: 'manual',
  };
}

export function getPairCustomizationState(schedule, profile = createDefaultProfile(), selectedMeeting, scope = 'meeting') {
  assertPairScope(scope);
  const context = assertPairContext(schedule, selectedMeeting);
  const selected = context.selectedMeeting;
  const section = getSectionRecord(profile, context.sectionKey);
  const selectedId = getSourceMeetingIdForPair(selected, context.sectionKey, context.selectedIndex);
  const group = schedule.meetings
    .map((meeting, index) => ({
      meeting,
      id: getSourceMeetingIdForPair(meeting, getSectionKey(meeting.courseCode, meeting.section), index),
      index,
    }))
    .filter(({ meeting }) => getSectionKey(meeting.courseCode, meeting.section) === context.sectionKey);
  const selectedEntry = getMeetingOverride(section, selectedId);
  const selectedResolved = resolveMeetingCustomization(profile, selected, 0, undefined, context.selectedIndex);
  const pairProfile = selectedEntry
    ? resetMeetingCustomization(profile, selected.courseCode, selected.section, selectedId)
    : profile;
  const pairResolved = resolveMeetingCustomization(pairProfile, selected, 0, undefined, context.selectedIndex);
  const selectedSource = resolveMeetingCustomization(createDefaultProfile(), selected, 0, undefined, context.selectedIndex);
  const sourceDifferences = [];
  const conflicts = [];
  const peerMeetingIds = [];
  const peerOverrideFields = new Set();

  for (const { meeting, id, index } of group) {
    if (id === selectedId) continue;
    peerMeetingIds.push(id);
    const peerEntry = getMeetingOverride(section, id);
    getOwnedMeetingFields(peerEntry).forEach((field) => peerOverrideFields.add(field));
    const peerSource = resolveMeetingCustomization(createDefaultProfile(), meeting, 0, undefined, index);
    for (const field of DETAIL_FIELDS) {
      const selectedValue = getResolvedFieldValue(selectedSource, field);
      const peerValue = getResolvedFieldValue(peerSource, field);
      if (!fieldValuesEqual(selectedValue, peerValue, field)) sourceDifferences.push(buildSourceDifference(field, selected, meeting));
    }
  }

  const selectedOverrideFields = getOwnedMeetingFields(selectedEntry);
  for (const field of DETAIL_FIELDS) {
    const selectedValue = getResolvedFieldValue(selectedResolved, field);
    const pairValue = getResolvedFieldValue(pairResolved, field);
    if (!fieldValuesEqual(selectedValue, pairValue, field)) {
      conflicts.push(buildManualDifference(field, selectedResolved, pairResolved, selected));
    }
  }

  const hasIndependentMeeting = Boolean(selectedEntry) || peerMeetingIds.some((id) => getMeetingOverride(section, id));
  let groupStatus = 'linked';
  if (conflicts.length) groupStatus = 'manual-conflict';
  else if (hasIndependentMeeting) groupStatus = 'partially-independent';
  else if (sourceDifferences.length) groupStatus = 'eaf-variation';

  return {
    sectionKey: context.sectionKey,
    selectedMeetingId: selectedId,
    peerMeetingIds,
    meetingCount: group.length,
    scope,
    groupStatus,
    sourceDifferences,
    conflicts,
    selectedOverrideFields,
    peerOverrideFields: [...peerOverrideFields],
    hasActionableConflict: conflicts.length > 0,
  };
}

export function formatPairFieldDifference(difference) {
  if (!isRecord(difference) || typeof difference.field !== 'string') {
    throw new CustomizationConfigError('INVALID_SYNC_DIFFERENCE', 'A sync difference must include a field.', 'difference');
  }
  const label = difference.label || DETAIL_FIELD_LABELS[difference.field] || difference.field;
  const current = difference.currentValue || 'Not specified';
  const pair = difference.pairValue || 'Not specified';
  return {
    label,
    current,
    pair,
    ariaLabel: `${label}: this meeting ${current}; pair settings ${pair}`,
  };
}

export function getPairScopeLabel(pairState) {
  if (!isRecord(pairState)) {
    throw new CustomizationConfigError('INVALID_SYNC_STATE', 'A pair customization state is required.', 'pairState');
  }
  if (pairState.scope === 'meeting') {
    const hasSelectedMeetingChanges = Array.isArray(pairState.selectedOverrideFields)
      && pairState.selectedOverrideFields.length > 0;
    return {
      title: 'This meeting',
      help: 'Only this meeting changes.',
      status: hasSelectedMeetingChanges
        ? 'This meeting has its own changes.'
        : 'This meeting uses its EAF details.',
    };
  }
  if (pairState.scope !== 'pair') assertPairScope(pairState.scope);
  if (pairState.hasActionableConflict || pairState.groupStatus === 'manual-conflict') {
    return {
      title: 'Paired meetings',
      help: 'Changes apply to both meetings.',
      status: 'Some details are customized per meeting.',
    };
  }
  if (pairState.groupStatus === 'partially-independent') {
    return {
      title: 'Paired meetings',
      help: 'Changes apply to both meetings.',
      status: 'One meeting still has its own changes.',
    };
  }
  if (pairState.groupStatus === 'eaf-variation') {
    return {
      title: 'Paired meetings',
      help: 'Changes apply to both meetings.',
      status: "Automatic keeps each meeting's EAF schedule.",
    };
  }
  return {
    title: 'Paired meetings',
    help: 'Changes apply to both meetings.',
    status: 'Both meetings use the shared settings.',
  };
}

function normalizeConflictFieldValue(field, value) {
  if (field === 'mode' && (value === null || value === undefined || value === '' || value === 'inherit')) return null;
  if (value === null || value === undefined || value === '') return null;
  return value;
}

function getConflictTargetValue(field, selectedMeeting, selectedEntry, draftPatch) {
  if (isRecord(draftPatch) && hasOwn(draftPatch, field)) return normalizeConflictFieldValue(field, draftPatch[field]);
  if (selectedEntry?.automatic !== true && selectedEntry && hasOwn(selectedEntry, field)) return selectedEntry[field];
  const sourceValue = getSourceFieldValue(selectedMeeting, field);
  if (field === 'mode' && sourceValue === 'async') return null;
  return sourceValue;
}

function clearMeetingFields(profile, sectionKey, fields) {
  const next = cloneMaps(profile);
  const section = next.sections[sectionKey];
  if (!isRecord(section) || !isRecord(section.meetings)) return next;
  const meetings = {};
  for (const [meetingId, rawEntry] of Object.entries(section.meetings)) {
    const entry = { ...rawEntry };
    fields.forEach((field) => delete entry[field]);
    if (entry.automatic === true) delete entry.automatic;
    if (Object.keys(entry).some((key) => key !== 'synced')) meetings[meetingId] = { synced: false, ...entry };
  }
  const updatedSection = { ...section };
  if (Object.keys(meetings).length) updatedSection.meetings = meetings;
  else delete updatedSection.meetings;
  if (Object.keys(updatedSection).length) next.sections[sectionKey] = updatedSection;
  else delete next.sections[sectionKey];
  return next;
}

export function applySyncConflictChoice(profile, context, choice) {
  if (!['use-pair', 'use-current-for-pair', 'cancel'].includes(choice)) {
    throw new CustomizationConfigError('INVALID_SYNC_CHOICE', 'Choose a valid pair sync action.', 'choice');
  }
  if (choice === 'cancel') return profile;
  if (!isRecord(context)) {
    throw new CustomizationConfigError('INVALID_SYNC_CONTEXT', 'A sync context is required.', 'context');
  }
  const pairContext = assertPairContext(context.schedule, context.selectedMeeting);
  const selected = pairContext.selectedMeeting;
  const selectedId = getSourceMeetingIdForPair(selected, pairContext.sectionKey, pairContext.selectedIndex);
  if (choice === 'use-pair') return resetMeetingCustomization(profile, selected.courseCode, selected.section, selectedId);

  const pairState = context.pairState && context.pairState.sectionKey === pairContext.sectionKey
    ? context.pairState
    : getPairCustomizationState(context.schedule, profile, selected, 'meeting');
  const draftPatch = isRecord(context.draftPatch) ? context.draftPatch : {};
  const changedFields = context.changedFields instanceof Set
    ? context.changedFields
    : Array.isArray(context.changedFields) ? new Set(context.changedFields) : null;
  const actionableDraftPatch = {};
  for (const field of DETAIL_FIELDS) {
    if (hasOwn(draftPatch, field) && (!changedFields || changedFields.has(field))) {
      actionableDraftPatch[field] = draftPatch[field];
    }
  }
  const fields = new Set(pairState.conflicts.map((difference) => difference.field));
  for (const field of DETAIL_FIELDS) {
    if (hasOwn(actionableDraftPatch, field)) fields.add(field);
  }
  const sectionPatch = {};
  for (const field of fields) {
    sectionPatch[field] = getConflictTargetValue(
      field,
      selected,
      getMeetingOverride(getSectionRecord(profile, pairContext.sectionKey), selectedId),
      actionableDraftPatch,
    );
  }
  let next = setSectionCustomization(profile, selected.courseCode, selected.section, sectionPatch);
  next = clearMeetingFields(next, pairContext.sectionKey, [...fields]);
  return next;
}

function createDefaultStore() {
  return {
    format: PROFILE_STORE_FORMAT,
    version: PROFILE_STORE_VERSION,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [{ id: DEFAULT_PROFILE_ID, builtIn: true, profile: createDefaultProfile() }],
  };
}

function normalizeStoredProfile(raw) {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim() || !hasOwn(raw, 'profile')) {
    throw new CustomizationConfigError('INVALID_PROFILE_STORE', 'A stored profile record is invalid.');
  }
  return {
    id: raw.id.trim(),
    builtIn: raw.id.trim() === DEFAULT_PROFILE_ID,
    profile: normalizeProfile(raw.profile),
  };
}

export function normalizeProfileStore(raw) {
  if (!isRecord(raw) || raw.format !== PROFILE_STORE_FORMAT || raw.version !== PROFILE_STORE_VERSION) {
    throw new CustomizationConfigError('INVALID_PROFILE_STORE', 'The stored profile collection is invalid.');
  }
  if (!Array.isArray(raw.profiles)) {
    throw new CustomizationConfigError('INVALID_PROFILE_STORE', 'The stored profile collection has no profile list.');
  }
  const profiles = [];
  const ids = new Set();
  for (const rawProfile of raw.profiles) {
    const profile = normalizeStoredProfile(rawProfile);
    if (ids.has(profile.id)) {
      throw new CustomizationConfigError('INVALID_PROFILE_STORE', 'Stored profile IDs must be unique.');
    }
    ids.add(profile.id);
    profiles.push(profile);
  }
  const defaultRecord = profiles.find((entry) => entry.id === DEFAULT_PROFILE_ID);
  if (!defaultRecord) profiles.unshift({ id: DEFAULT_PROFILE_ID, builtIn: true, profile: createDefaultProfile() });
  const activeProfileId = profiles.some((entry) => entry.id === raw.activeProfileId)
    ? raw.activeProfileId
    : DEFAULT_PROFILE_ID;
  return { format: PROFILE_STORE_FORMAT, version: PROFILE_STORE_VERSION, activeProfileId, profiles };
}

function storageFromArgument(storage) {
  if (storage !== undefined) {
    return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function' ? storage : null;
  }
  try {
    return typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null;
  } catch (error) {
    return null;
  }
}

function errorFromUnknown(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function migrateLegacyColors(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {};
  }
  if (!isRecord(parsed)) return {};
  const courses = {};
  for (const [rawCode, rawColor] of Object.entries(parsed)) {
    const code = normalizeCourseCode(rawCode);
    if (!code || !isColorValue(rawColor)) continue;
    try {
      courses[code] = { color: normalizeColorValue(rawColor, `courses.${rawCode}`) };
    } catch (error) {
      continue;
    }
  }
  return courses;
}

export function loadProfileStore(storage) {
  const storageApi = storageFromArgument(storage);
  if (!storageApi) return createDefaultStore();

  let storedText;
  try {
    storedText = storageApi.getItem(PROFILE_STORAGE_KEY);
  } catch (error) {
    return createDefaultStore();
  }

  if (storedText !== null) {
    try {
      const raw = JSON.parse(storedText);
      const loaded = normalizeProfileStore(raw);
      const hadDefault = Array.isArray(raw.profiles) && raw.profiles.some((entry) => isRecord(entry) && entry.id === DEFAULT_PROFILE_ID);
      if (!hadDefault) saveProfileStore(loaded, storageApi);
      return loaded;
    } catch (error) {
      const repaired = createDefaultStore();
      saveProfileStore(repaired, storageApi);
      return repaired;
    }
  }

  const store = createDefaultStore();
  let legacyText = null;
  try {
    legacyText = storageApi.getItem(LEGACY_COLOR_STORAGE_KEY);
  } catch (error) {
    legacyText = null;
  }
  const migratedCourses = migrateLegacyColors(legacyText);
  if (Object.keys(migratedCourses).length) {
    store.profiles[0] = { ...store.profiles[0], profile: { ...store.profiles[0].profile, courses: migratedCourses } };
  }
  saveProfileStore(store, storageApi);
  return store;
}

export function saveProfileStore(store, storage) {
  const storageApi = storageFromArgument(storage);
  if (!storageApi) {
    return { ok: false, error: new CustomizationConfigError('STORAGE_UNAVAILABLE', 'Browser storage is unavailable.') };
  }
  let serialized;
  try {
    serialized = JSON.stringify(normalizeProfileStore(store));
    storageApi.setItem(PROFILE_STORAGE_KEY, serialized);
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: errorFromUnknown(error) };
  }
}

export function getActiveProfile(store) {
  const active = store.profiles.find((entry) => entry.id === store.activeProfileId);
  return (active || store.profiles.find((entry) => entry.id === DEFAULT_PROFILE_ID) || store.profiles[0]).profile;
}

export function setActiveProfile(store, profileId) {
  if (!store.profiles.some((entry) => entry.id === profileId)) {
    throw new CustomizationConfigError('PROFILE_NOT_FOUND', 'That customization profile is not available.', 'profileId');
  }
  return { ...store, activeProfileId: profileId, profiles: store.profiles.slice() };
}

function createProfileId(existingIds) {
  let candidate = '';
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      candidate = globalThis.crypto.randomUUID();
    }
  } catch (error) {
    candidate = '';
  }
  if (!candidate) candidate = `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  while (existingIds.has(candidate)) candidate = `${candidate}-${Math.random().toString(36).slice(2)}`;
  return candidate;
}

export function createUniqueProfileName(name, existingNames) {
  const base = normalizeProfileName(name);
  const names = new Set((Array.isArray(existingNames) ? existingNames : []).filter((value) => typeof value === 'string').map((value) => value.trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (true) {
    const suffixText = ` (${suffix})`;
    const candidate = `${truncateText(base, PROFILE_NAME_LIMIT - [...suffixText].length)}${suffixText}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
    suffix += 1;
  }
}

export function addProfile(store, profile, id) {
  const normalized = normalizeProfile(profile);
  const name = createUniqueProfileName(normalized.name, store.profiles.map((entry) => entry.profile.name));
  const ids = new Set(store.profiles.map((entry) => entry.id));
  const profileId = typeof id === 'string' && id.trim() && !ids.has(id.trim()) ? id.trim() : createProfileId(ids);
  const nextProfiles = [...store.profiles, { id: profileId, builtIn: false, profile: { ...normalized, name } }];
  return { ...store, activeProfileId: profileId, profiles: nextProfiles };
}

export function renameProfile(store, profileId, name) {
  const target = store.profiles.find((entry) => entry.id === profileId);
  if (!target) throw new CustomizationConfigError('PROFILE_NOT_FOUND', 'That customization profile is not available.', 'profileId');
  const requested = normalizeProfileName(name);
  const names = store.profiles.filter((entry) => entry.id !== profileId).map((entry) => entry.profile.name);
  const uniqueName = createUniqueProfileName(requested, names);
  return {
    ...store,
    profiles: store.profiles.map((entry) => entry.id === profileId ? { ...entry, profile: { ...entry.profile, name: uniqueName } } : entry),
  };
}

export function deleteProfile(store, profileId) {
  if (profileId === DEFAULT_PROFILE_ID) {
    throw new CustomizationConfigError('BUILT_IN_PROFILE', 'The Default profile cannot be deleted.', 'profileId');
  }
  if (!store.profiles.some((entry) => entry.id === profileId)) {
    throw new CustomizationConfigError('PROFILE_NOT_FOUND', 'That customization profile is not available.', 'profileId');
  }
  const profiles = store.profiles.filter((entry) => entry.id !== profileId);
  const activeProfileId = store.activeProfileId === profileId ? DEFAULT_PROFILE_ID : store.activeProfileId;
  return { ...store, activeProfileId, profiles };
}

export function parseProfileJson(text, fallbackName) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new CustomizationConfigError('INVALID_JSON', 'The selected file is not valid JSON.');
  }
  return normalizeProfile(raw, fallbackName);
}

export function serializeProfile(profile) {
  return `${JSON.stringify(normalizeProfile(profile), null, 2)}\n`;
}

export function profileFilename(profile) {
  const normalized = normalizeProfile(profile);
  const slug = normalized.name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `animosort-${slug || 'customization'}.json`;
}
