// Archershub EAF parser. Reads an official DLSU EAF PDF entirely in the
// browser, validates the structure, and returns only normalized schedule data.

export const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const DAY_SET = new Set(DAY_ORDER);

// Canonical DLSU periods, used only as layout hints for the UI renderer.
export const STANDARD_PERIODS = [
  [450, 540],
  [555, 645],
  [660, 750],
  [765, 855],
  [870, 960],
  [975, 1065],
  [1080, 1170],
  [1185, 1275],
];

export const ASYNC_SCHEDULE_MARKERS = Object.freeze([
  'ASYNC',
  'ASYNCHRONOUS',
  'ASYNC ONLY',
  'JUST ASYNC',
  'NO FIXED TIME',
  'NO SCHEDULE',
  'NO TIME NO VENUE JUST ASYNC',
  'NO TIME NO ROOM JUST ASYNC',
]);
const ASYNC_MARKER_SET = new Set(ASYNC_SCHEDULE_MARKERS);

export const BUILDING_NAMES = Object.freeze({
  L: 'Saint La Salle Hall',
  LS: 'Saint La Salle Hall',
  M: 'Miguel Hall',
  SM: 'Miguel Hall',
  AG: 'Brother Andrew Gonzales Building',
  BAG: 'Brother Andrew Gonzales Building',
  EY: 'Don Enrique Yuchengco Hall',
  Y: 'Don Enrique Yuchengco Hall',
  V: 'Velasco Hall',
  VL: 'Velasco Hall',
  VE: 'Velasco Hall',
  ER: 'Enrique Razon Sports Center',
  RC: 'Enrique Razon Sports Center',
  SJ: 'St. Joseph Hall',
  S: 'St. Joseph Hall',
  G: 'Gokongwei Hall',
  GK: 'Gokongwei Hall',
  ST: 'Science & Technology Research Center',
  STRC: 'Science & Technology Research Center',
  MM: 'St. Mutien Marie Hall',
  MRR: 'Milagros R. del Rosario Building',
  UH: 'University Hall',
  EKR: 'Enrique K. Razon Jr. Hall',
  RL: 'Richard L. Lee Engineering Technology Block',
  LC: 'Integrated School Learning Centers',
  WH: 'William Hall',
  W: 'William Hall',
  H: 'William Hall',
  J: 'John Gokongwei, Jr. Innovation Center',
  B: 'Bloemen Hall',
  C: 'Connon Hall',
});

export class EafParseError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'EafParseError';
    this.code = code;
    this.details = details;
  }
}

let pdfjsPromise = null;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    const moduleUrl = new URL('../../vendor/pdfjs/pdf.min.mjs', import.meta.url);
    const pdfjs = await import(moduleUrl.href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    pdfjsPromise = pdfjs;
  }
  return pdfjsPromise;
}

export function parseTimeLabel(label) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridian = m[3].toUpperCase();
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  if (meridian === 'PM' && hours !== 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;
  return { minutes: hours * 60 + minutes, display: label.trim() };
}

export function parseTimeRange(raw) {
  const m = /^(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i.exec(raw.trim());
  if (!m) return null;
  const start = parseTimeLabel(`${m[1]} ${m[2]}`);
  const end = parseTimeLabel(`${m[3]} ${m[4]}`);
  if (!start || !end) return null;
  if (end.minutes <= start.minutes) return null;
  return {
    startMinutes: start.minutes,
    endMinutes: end.minutes,
    startLabel: start.display,
    endLabel: end.display,
  };
}

export function splitMeetingSegments(text) {
  const re = /\b([A-Z]{3})\b/g;
  const matches = [];
  let m;
  while ((m = re.exec(text))) matches.push(m);
  if (!matches.length) return null;
  const segments = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const seg = text.slice(start, end).trim();
    const parts = seg.split('|');
    if (parts.length < 2) return null;
    const day = parts[0].trim().toUpperCase();
    const rest = parts.slice(1).join('|').trim();
    const timeMatch = /^(\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M)/i.exec(rest);
    const locationText = timeMatch ? rest.slice(timeMatch[0].length).replace(/^\s*\|\s*/, '').trim() : rest;
    segments.push({ day, timeText: timeMatch ? timeMatch[1].trim() : '', locationText });
  }
  return segments;
}

export function normalizeLocation(text) {
  let t = String(text).trim().replace(/[,\s]+$/, '').replace(/^\s*\|\s*/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  if (/^online$/i.test(t)) return 'Online';
  return t;
}

export function getBuildingCode(location) {
  const normalized = String(location).trim().toUpperCase();
  if (!normalized || normalized === 'ONLINE') return null;
  const match = /^([A-Z]+)(?=\s*(?:\d|-|$))/.exec(normalized);
  return match ? match[1] : null;
}

export function getBuildingName(location) {
  const code = getBuildingCode(location);
  return code ? BUILDING_NAMES[code] || null : null;
}

export function expandLocation(location) {
  const normalized = normalizeLocation(location);
  if (!normalized) return null;
  const buildingName = getBuildingName(normalized);
  return buildingName ? `${normalized} · ${buildingName}` : normalized;
}

function isExplicitAsyncSchedule(text) {
  const normalized = String(text || '')
    .trim()
    .replace(/[|:;,/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
  return !normalized || ASYNC_MARKER_SET.has(normalized);
}

export function normalizeMeeting(rawMeeting, course, meetingOrdinal = 0) {
  if (!rawMeeting || typeof rawMeeting !== 'object') {
    throw new EafParseError('MEETING_UNREADABLE', 'A schedule entry could not be read.', { courseCode: course?.code ?? null });
  }
  const day = String(rawMeeting.day || '').trim().toUpperCase();
  if (!DAY_SET.has(day)) {
    throw new EafParseError('UNSUPPORTED_DAY', 'The schedule contains a day outside Monday through Saturday.', {
      courseCode: course?.code ?? null,
      day,
    });
  }
  const timeText = String(rawMeeting.timeText || '').trim();
  const hasTimeShape = /^\d{1,2}:\d{2}\s*[AP]M\s*-/i.test(timeText);
  const range = parseTimeRange(timeText);
  if (!hasTimeShape || !range) {
    if (!hasTimeShape) {
      throw new EafParseError('MEETING_UNREADABLE', 'A schedule entry is missing a readable time.', {
        courseCode: course?.code ?? null,
        day,
      });
    }
    throw new EafParseError('INVALID_TIME', 'The schedule contains an invalid time interval.', {
      courseCode: course?.code ?? null,
      day,
    });
  }
  const location = normalizeLocation(rawMeeting.locationText) || 'Room not specified';
  const buildingCode = getBuildingCode(location);
  const buildingName = getBuildingName(location);
  return {
    id: `${course.code}::${course.section}::${meetingOrdinal}`,
    meetingOrdinal,
    courseCode: course.code,
    title: course.title,
    section: course.section,
    credits: course.credits,
    day,
    startMinutes: range.startMinutes,
    endMinutes: range.endMinutes,
    startLabel: range.startLabel,
    endLabel: range.endLabel,
    location,
    expandedLocation: expandLocation(location),
    buildingCode,
    buildingName,
    modality: /^online$/i.test(location) ? 'online' : 'room',
    scheduled: true,
  };
}

export function normalizeUnplacedMeeting(course, meetingOrdinal = 0) {
  return {
    id: `${course.code}::${course.section}::${meetingOrdinal}`,
    meetingOrdinal,
    courseCode: course.code,
    title: course.title,
    section: course.section,
    credits: course.credits,
    day: null,
    startMinutes: null,
    endMinutes: null,
    startLabel: null,
    endLabel: null,
    location: null,
    expandedLocation: null,
    buildingCode: null,
    buildingName: null,
    modality: 'async',
    scheduled: false,
  };
}

export function validateNoOverlaps(meetings) {
  const byDay = new Map();
  for (const meeting of meetings) {
    if (meeting?.scheduled === false || !DAY_SET.has(meeting?.day) || !Number.isFinite(meeting?.startMinutes) || !Number.isFinite(meeting?.endMinutes)) continue;
    if (!byDay.has(meeting.day)) byDay.set(meeting.day, []);
    byDay.get(meeting.day).push(meeting);
  }
  for (const [day, list] of byDay) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
          throw new EafParseError('MEETING_OVERLAP', 'The imported EAF contains overlapping meetings. No schedule was replaced because the timetable could not be validated.', {
            courseCodes: [a.courseCode, b.courseCode],
            meetings: [a, b].map((item) => ({
              id: item.id,
              courseCode: item.courseCode,
              section: item.section,
              startMinutes: item.startMinutes,
              endMinutes: item.endMinutes,
            })),
            day,
          });
        }
      }
    }
  }
}

export function sanitizeSchedule(session, rows) {
  const meetings = [];
  for (const row of rows) {
    for (const meeting of row.meetings) {
      const sourceIsScheduled = meeting?.scheduled !== false;
      const validIdentity =
        meeting &&
        typeof meeting.courseCode === 'string' &&
        typeof meeting.title === 'string' &&
        typeof meeting.section === 'string' &&
        Number.isFinite(meeting.credits) &&
        meeting.credits >= 0;
      const validScheduled =
        sourceIsScheduled &&
        DAY_SET.has(meeting.day) &&
        Number.isFinite(meeting.startMinutes) &&
        Number.isFinite(meeting.endMinutes) &&
        meeting.endMinutes > meeting.startMinutes &&
        typeof meeting.location === 'string' &&
        typeof meeting.expandedLocation === 'string' &&
        (meeting.buildingCode === null || typeof meeting.buildingCode === 'string') &&
        (meeting.buildingName === null || typeof meeting.buildingName === 'string');
      const validUnplaced =
        !sourceIsScheduled &&
        meeting.day === null &&
        meeting.startMinutes === null &&
        meeting.endMinutes === null &&
        meeting.startLabel === null &&
        meeting.endLabel === null &&
        meeting.location === null &&
        meeting.expandedLocation === null &&
        meeting.buildingCode === null &&
        meeting.buildingName === null &&
        meeting.modality === 'async';
      const valid = validIdentity && (validScheduled || validUnplaced);
      if (!valid) {
        throw new EafParseError('SCHEDULE_SANITIZATION_FAILED', 'A schedule row could not be reduced to the allowed fields.');
      }
      meetings.push(meeting);
    }
  }
  return { session, meetings };
}

export function groupItemsIntoLines(items, tolerance = 2.5) {
  // PDF.js y is bottom-up, so descending sort reads the page top-first.
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(item.y - last.y) <= tolerance) {
      last.words.push(item);
    } else {
      lines.push({ y: item.y, words: [item] });
    }
  }
  for (const line of lines) {
    line.words.sort((a, b) => a.x - b.x);
  }
  return lines;
}

function columnBoundaries(headerLine) {
  if (!headerLine || !headerLine.words) return null;
  const word = (re) => headerLine.words.find((w) => re.test(w.str));
  // Header tokens can merge in extraction (e.g. "Sr.No Course"), so anchor on
  // the stable later columns and derive the earlier boundaries from them.
  const typeX = word(/^Course\s*Type$/);
  const sectionX = word(/^Section$/);
  const creditsX = word(/^Credits$/);
  const scheduleX = word(/^Day\/Time\/Room/);
  if (!sectionX || !creditsX || !scheduleX) return null;
  const mid = (a, b) => (a.x + b.x) / 2;
  const typeLeft = typeX ? typeX.x - 150 : sectionX.x - 260;
  const noRight = 100; // row numbers end near x=92; the Course column starts near x=107
  const courseRight = typeX ? typeX.x - 30 : mid({ x: typeLeft }, sectionX);
  return {
    no: [0, noRight],
    course: [noRight, courseRight],
    type: typeX ? [courseRight, mid(typeX, sectionX)] : [typeLeft, mid({ x: typeLeft }, sectionX)],
    section: [mid(typeX || { x: typeLeft }, sectionX), mid(sectionX, creditsX)],
    credits: [mid(sectionX, creditsX), creditsX.x + 25],
    schedule: [creditsX.x + 25, Infinity],
  };
}

function assignColumns(words, headerInfo) {
  // headerInfo is either a precomputed bounds object or a header line object.
  const bounds =
    headerInfo && headerInfo.no && headerInfo.course
      ? headerInfo
      : columnBoundaries(headerInfo) || {
          no: [0, 100],
          course: [100, 245],
          type: [245, 337],
          section: [337, 398],
          credits: [398, 441],
          schedule: [441, Infinity],
        };
  const cols = { no: [], course: [], type: [], section: [], credits: [], schedule: [] };
  for (const word of words) {
    const x = word.x;
    for (const [name, [lo, hi]] of Object.entries(bounds)) {
      if (x >= lo && x < hi) {
        cols[name].push(word);
        break;
      }
    }
  }
  return cols;
}

function joinColumnWords(words) {
  return words
    .map((w) => w.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCourseIdentity(courseText) {
  const codeMatch = /^((?:[A-Z]{2,12}\s*\d{0,4})(?:\s*-\s*(?:[A-Z]{1,12}\s*)?\d{1,4})?)\s*-?\s*/.exec(courseText);
  if (!codeMatch) return { code: null, title: '' };
  return {
    code: codeMatch[1].replace(/[\s-]/g, ''),
    title: courseText.slice(codeMatch[0].length).trim(),
  };
}

function parseCourseRow(row, headerInfo) {
  const cols = assignColumns(row.words, headerInfo);
  const noWord = cols.no.find((w) => /^\d+$/.test(w.str));
  const no = noWord ? Number(noWord.str) : null;
  const courseText = joinColumnWords(cols.course);
  const { code, title } = parseCourseIdentity(courseText);
  const section = joinColumnWords(cols.section);
  const credits = Number.parseFloat(joinColumnWords(cols.credits));
  if (!code || !title || !section || !Number.isFinite(credits) || credits < 0) {
    throw new EafParseError('ROW_UNREADABLE', 'The Archershub EAF was recognized, but one or more schedule entries could not be read reliably. No schedule was replaced. Upload the original PDF again or verify the document format.', { row: no ?? null });
  }
  const scheduleText = joinColumnWords(cols.schedule);
  const segments = splitMeetingSegments(scheduleText);
  const courseInfo = { code, title, section, credits, row: no };
  if (!segments || !segments.length) {
    if (isExplicitAsyncSchedule(scheduleText)) {
      return { no, code, title, section, credits, meetings: [normalizeUnplacedMeeting(courseInfo)] };
    }
    throw new EafParseError('ROW_UNREADABLE', 'The Archershub EAF was recognized, but one or more schedule entries could not be read reliably. No schedule was replaced. Upload the original PDF again or verify the document format.', { row: no });
  }
  const meetings = segments.map((raw, index) => normalizeMeeting(raw, courseInfo, index));
  return { no, code, title, section, credits, meetings };
}

export function parseScheduleRows(pages, session) {
  const rows = [];
  for (const pageItems of pages) {
    const items = (pageItems || []).filter((it) => it && typeof it.str === 'string' && it.str.trim() !== '');
    if (!items.length) continue;
    const lines = groupItemsIntoLines(items); // top-first
    const headerIdx = lines.findIndex((line) => line.words.some((w) => /Day\/Time\/Room/.test(w.str)));
    if (headerIdx === -1) continue;
    const headerLine = lines[headerIdx];
    const bounds = columnBoundaries(headerLine);
    const noCol = (w) => bounds && w.x >= bounds.no[0] && w.x < bounds.no[1];
    const scheduleCol = (w) => bounds && w.x >= bounds.schedule[0];
    const courseCol = (w) => bounds && w.x >= bounds.course[0] && w.x < bounds.course[1];
    const WRAP_GAP = 16; // wrapped row lines sit ~11 points apart; sections ~25+
    let current = null;
    for (const line of lines.slice(headerIdx + 1)) {
      const words = line.words;
      if (!words.length) continue;
      const noWord = words.find((w) => noCol(w) && /^\d+$/.test(w.str.trim()));
      const hasSchedule = words.some(scheduleCol);
      const hasCourse = words.some(courseCol);
      if (noWord) {
        current = { no: Number(noWord.str.trim()), lines: [line], bounds };
        rows.push(current);
      } else if (current) {
        const lastY = current.lines[current.lines.length - 1].y;
        const gapOk = line.y >= lastY - WRAP_GAP;
        if ((hasSchedule || hasCourse) && gapOk) {
          current.lines.push(line);
        } else {
          current = null; // section break (payments etc.) closes the block
        }
      }
    }
  }
  if (!rows.length) {
    throw new EafParseError('SCHEDULE_NOT_FOUND', 'The Archershub EAF was recognized, but no schedule table with numbered rows was found. No schedule was replaced.');
  }
  const result = [];
  for (const row of rows) {
    const allWords = row.lines.flatMap((l) => l.words);
    result.push(parseCourseRow({ words: allWords }, row.bounds || null));
  }
  return result;
}

export function validateArchershubEaf(pages) {
  const pageTexts = (pages || []).map((items) =>
    (items || []).map((it) => it.str).join(' ')
  );
  const fullText = pageTexts.join(' ').replace(/\s+/g, ' ');
  if (!/ENROLLMENT\s+ASSESSMENT\s+FORM/i.test(fullText)) {
    throw new EafParseError('NOT_ARCHERSHUB_EAF', 'This does not look like an official Archershub EAF. Upload the official De La Salle University Archershub EAF PDF.');
  }
  const sessionMatch = /ACADEMIC\s+SESSION\s*:?\s*(AY\s+\d{4}-\d{4}\s+Term\s+\d+)/i.exec(fullText);
  if (!sessionMatch) {
    throw new EafParseError('SESSION_NOT_FOUND', 'The Archershub EAF was recognized, but the academic session could not be found.');
  }
  return { session: sessionMatch[1] };
}

function reportImportProgress(onProgress, phase, percent, message) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress({
      phase,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      message,
    });
  } catch {
    return;
  }
}

export async function extractPdfTextItems(file, onProgress = () => {}) {
  const pdfjs = await loadPdfJs();
  try {
    reportImportProgress(onProgress, 'reading', 8, 'Reading the EAF locally…');
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    reportImportProgress(onProgress, 'extracting', 15, 'Opening the PDF locally…');
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      pages.push(
        textContent.items.map((it) => ({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          width: it.width,
        }))
      );
      reportImportProgress(
        onProgress,
        'extracting',
        15 + (40 * i) / Math.max(1, doc.numPages),
        `Reading PDF page ${i} of ${doc.numPages} locally…`,
      );
    }
    return pages;
  } catch (err) {
    if (err instanceof EafParseError) throw err;
    throw new EafParseError('PDF_READ_FAILED', 'The selected PDF could not be read. Upload the official De La Salle University Archershub EAF PDF.');
  }
}

export async function parseEafFile(file, onProgress = () => {}) {
  const isPdf = (file && file.type === 'application/pdf') || /\.pdf$/i.test((file && file.name) || '');
  if (!isPdf) {
    throw new EafParseError('NOT_A_PDF', 'This does not look like an official Archershub EAF. Upload the official De La Salle University Archershub EAF PDF.');
  }
  if (!file || file.size === 0) {
    throw new EafParseError('EMPTY_FILE', 'The selected file is empty. Upload the official De La Salle University Archershub EAF PDF.');
  }
  reportImportProgress(onProgress, 'reading', 5, 'Preparing the EAF locally…');
  const pages = await extractPdfTextItems(file, onProgress);
  reportImportProgress(onProgress, 'validating', 65, 'Checking the Archershub EAF…');
  const { session } = validateArchershubEaf(pages);
  reportImportProgress(onProgress, 'parsing', 75, 'Reading class rows…');
  const rows = parseScheduleRows(pages, session);
  reportImportProgress(onProgress, 'checking', 88, 'Checking meeting times…');
  validateNoOverlaps(rows.flatMap((row) => row.meetings));
  reportImportProgress(onProgress, 'building', 95, 'Preparing the timetable…');
  return sanitizeSchedule(session, rows);
}
