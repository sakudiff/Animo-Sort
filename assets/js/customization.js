import { expandLocation } from './eaf-parser.js';

/** @typedef {'f2f'|'online'} SectionMode */
/** @typedef {'generated'|'plain'} DefaultColorMode */
/** @typedef {{ mode?: SectionMode, professor?: string }} SectionCustomization */
/** @typedef {{ format: 'animosort-customization', version: 1, name: string, defaults: { color: DefaultColorMode, mode: 'infer' }, courses: Record<string, { color: string }>, sections: Record<string, SectionCustomization> }} CustomizationProfile */

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

const DEFAULT_IMPORTED_NAME = 'Imported profile';
const PALETTE_IDS = new Set(['plain', 'sage', 'sky', 'lavender', 'peach', 'mint', 'rose', 'sand', 'slate']);

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
    sections: { ...profile.sections },
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
    const entry = {};
    if (hasOwn(rawEntry, 'mode') && rawEntry.mode !== null && rawEntry.mode !== undefined) {
      const mode = typeof rawEntry.mode === 'string' ? rawEntry.mode.trim().toLowerCase() : '';
      if (mode !== 'f2f' && mode !== 'online') {
        throw new CustomizationConfigError('INVALID_PROFILE', 'Section mode must be f2f or online.', `sections.${rawKey}.mode`);
      }
      entry.mode = mode;
    }
    if (hasOwn(rawEntry, 'professor') && rawEntry.professor !== null && rawEntry.professor !== undefined) {
      if (typeof rawEntry.professor !== 'string') {
        throw new CustomizationConfigError('INVALID_PROFILE', 'Professor must be text.', `sections.${rawKey}.professor`);
      }
      const professor = rawEntry.professor.trim();
      if ([...professor].length > PROFESSOR_NAME_LIMIT) {
        throw new CustomizationConfigError('INVALID_PROFILE', `Professor must contain at most ${PROFESSOR_NAME_LIMIT} characters.`, `sections.${rawKey}.professor`);
      }
      if (professor) entry.professor = professor;
    }
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
  if (!isRecord(patch)) {
    throw new CustomizationConfigError('INVALID_PROFILE', 'Section customization changes must be an object.', 'patch');
  }
  const next = cloneMaps(profile);
  const key = getSectionKey(courseCode, section);
  const current = isRecord(next.sections[key]) ? { ...next.sections[key] } : {};

  if (hasOwn(patch, 'mode')) {
    if (patch.mode === null || patch.mode === undefined || patch.mode === '') {
      delete current.mode;
    } else {
      const mode = typeof patch.mode === 'string' ? patch.mode.trim().toLowerCase() : '';
      if (mode !== 'f2f' && mode !== 'online') {
        throw new CustomizationConfigError('INVALID_MODE', 'Section mode must be f2f or online.', 'mode');
      }
      current.mode = mode;
    }
  }

  if (hasOwn(patch, 'professor')) {
    if (patch.professor === null || patch.professor === undefined) {
      delete current.professor;
    } else if (typeof patch.professor !== 'string') {
      throw new CustomizationConfigError('INVALID_PROFILE', 'Professor must be text.', 'professor');
    } else {
      const professor = patch.professor.trim();
      if ([...professor].length > PROFESSOR_NAME_LIMIT) {
        throw new CustomizationConfigError('INVALID_PROFILE', `Professor must contain at most ${PROFESSOR_NAME_LIMIT} characters.`, 'professor');
      }
      if (professor) current.professor = professor;
      else delete current.professor;
    }
  }

  if (Object.keys(current).length) next.sections[key] = current;
  else delete next.sections[key];
  return next;
}

export function resetSectionCustomization(profile, courseCode, section) {
  const next = cloneMaps(profile);
  delete next.sections[getSectionKey(courseCode, section)];
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

export function resolveMeetingCustomization(profile, meeting, courseIndex = 0, courseColorMap) {
  const courseKey = getCourseKey(meeting?.courseCode);
  const sectionKey = getSectionKey(meeting?.courseCode, meeting?.section);
  const map = courseColorMap || buildCourseColorMap({ meetings: [meeting] }, profile);
  const palette = map[courseKey] || getPaletteById(profile?.defaults?.color === 'plain' ? 'plain' : COURSE_PALETTES[1].id);
  const section = profile && isRecord(profile.sections) && isRecord(profile.sections[sectionKey])
    ? profile.sections[sectionKey]
    : {};
  const hasOverride = section.mode === 'f2f' || section.mode === 'online';
  const inferredOnline = meeting?.modality === 'online' || /^online$/i.test(String(meeting?.location || '').trim());
  const mode = hasOverride ? section.mode : inferredOnline ? 'online' : 'f2f';
  const professor = typeof section.professor === 'string' && section.professor.trim() ? section.professor.trim() : null;
  return {
    courseKey,
    sectionKey,
    palette,
    mode,
    professor,
    colorSource: profile?.courses?.[courseKey]?.color ? 'course' : 'profile-default',
    modeSource: hasOverride ? 'section' : 'eaf-inferred',
    courseIndex,
  };
}

export function formatMeetingMetadataLines(meeting, resolved) {
  const location = meeting?.expandedLocation || expandLocation(meeting?.location) || meeting?.location || 'Room not specified';
  const locationMode = resolved.mode === 'online'
    ? 'Mode: Online'
    : `Room: ${String(location)} · F2F`;
  const professor = resolved.professor ? `Professor: ${resolved.professor}` : null;
  const time = `Time: ${meeting?.startLabel || ''} - ${meeting?.endLabel || ''}`.trim();
  return { locationMode, professor, time };
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
