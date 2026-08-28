// Single-page PNG export and native print for AnimoSort.
// Accepts only the sanitized Schedule object produced by eaf-parser.js.

import { DAY_ORDER, STANDARD_PERIODS, expandLocation } from './eaf-parser.js';

const DAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday' };
const PNG_FILENAME = 'animo-sort-schedule.png';
const SVG_WIDTH = 1400;
const SVG_HEIGHT = 1000;
const MARGIN = 40;
const GUTTER = 120;
const HEADER = 90;

export function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatExportTitle(schedule) {
  if (schedule && typeof schedule.session === 'string' && schedule.session.trim()) {
    return schedule.session.trim();
  }
  return 'Weekly Timetable';
}

function formatTimeLabel(minutes) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
}

function createGuideEntries(periods) {
  const starts = new Set(periods.map(([start]) => start));
  const entries = new Map();
  for (const [start, end] of periods) {
    if (!entries.has(start)) entries.set(start, { minutes: start, kind: 'major' });
    if (!starts.has(end) && !entries.has(end)) entries.set(end, { minutes: end, kind: 'minor' });
  }
  return [...entries.values()].sort((a, b) => a.minutes - b.minutes);
}

function formatRoomLabel(meeting) {
  return meeting.expandedLocation || expandLocation(meeting.location) || meeting.location;
}

function wrapTitle(title, maxChars = 28) {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export const COURSE_PALETTES = [
  {
    id: 'emerald',
    name: 'Emerald Green',
    swatch: '#087830',
    light: { bg: '#edf7f0', border: '#97d4ab', code: '#087830', title: '#154726', meta: '#2d6340' },
    dark: { bg: '#0b2414', border: '#1e6837', code: '#4ade80', title: '#f0fdf4', meta: '#86efac' },
  },
  {
    id: 'blue',
    name: 'Ocean Blue',
    swatch: '#1d4ed8',
    light: { bg: '#eff6ff', border: '#93c5fd', code: '#1d4ed8', title: '#1e3a8a', meta: '#2563eb' },
    dark: { bg: '#0c1e36', border: '#1d4ed8', code: '#60a5fa', title: '#eff6ff', meta: '#93c5fd' },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    swatch: '#7e22ce',
    light: { bg: '#faf5ff', border: '#d8b4fe', code: '#7e22ce', title: '#3b0764', meta: '#9333ea' },
    dark: { bg: '#250f33', border: '#7e22ce', code: '#c084fc', title: '#faf5ff', meta: '#d8b4fe' },
  },
  {
    id: 'amber',
    name: 'Amber Orange',
    swatch: '#c2410c',
    light: { bg: '#fff7ed', border: '#fed7aa', code: '#c2410c', title: '#431407', meta: '#ea580c' },
    dark: { bg: '#2d140a', border: '#c2410c', code: '#fb923c', title: '#fff7ed', meta: '#fed7aa' },
  },
  {
    id: 'teal',
    name: 'Teal Green',
    swatch: '#0f766e',
    light: { bg: '#f0fdfa', border: '#99f6e4', code: '#0f766e', title: '#134e4a', meta: '#0d9488' },
    dark: { bg: '#082522', border: '#0f766e', code: '#2dd4bf', title: '#f0fdfa', meta: '#99f6e4' },
  },
  {
    id: 'rose',
    name: 'Ruby Rose',
    swatch: '#be123c',
    light: { bg: '#fff1f2', border: '#fecdd3', code: '#be123c', title: '#4c0519', meta: '#e11d48' },
    dark: { bg: '#2e0a13', border: '#be123c', code: '#fb7185', title: '#fff1f2', meta: '#fecdd3' },
  },
  {
    id: 'indigo',
    name: 'Indigo Night',
    swatch: '#4338ca',
    light: { bg: '#eef2ff', border: '#c7d2fe', code: '#4338ca', title: '#1e1b4b', meta: '#4f46e5' },
    dark: { bg: '#131538', border: '#4338ca', code: '#818cf8', title: '#eef2ff', meta: '#c7d2fe' },
  },
  {
    id: 'cyan',
    name: 'Sky Cyan',
    swatch: '#0369a1',
    light: { bg: '#f0f9ff', border: '#bae6fd', code: '#0369a1', title: '#082f49', meta: '#0284c7' },
    dark: { bg: '#082236', border: '#0369a1', code: '#38bdf8', title: '#f0f9ff', meta: '#bae6fd' },
  },
  {
    id: 'yellow',
    name: 'Gold Ochre',
    swatch: '#a16207',
    light: { bg: '#fefce8', border: '#fef08a', code: '#a16207', title: '#422006', meta: '#ca8a04' },
    dark: { bg: '#291f06', border: '#a16207', code: '#facc15', title: '#fefce8', meta: '#fef08a' },
  },
];

export function getPaletteById(id) {
  return COURSE_PALETTES.find((p) => p.id === id) || COURSE_PALETTES[0];
}

export function buildCourseColorMap(schedule, customColors = {}) {
  const map = {};
  if (!schedule || !Array.isArray(schedule.meetings)) return map;
  const distinctCourses = [...new Set(schedule.meetings.map((m) => m.courseCode))];
  distinctCourses.forEach((code, index) => {
    const customId = customColors[code];
    const palette = customId ? getPaletteById(customId) : COURSE_PALETTES[index % COURSE_PALETTES.length];
    map[code] = palette;
  });
  return map;
}

export function createScheduleSvg(schedule, options = {}) {
  const showCourseTitles = options?.showCourseTitles !== false;
  if (!schedule || !Array.isArray(schedule.meetings) || schedule.meetings.length === 0) {
    throw new Error('A valid schedule is required for export');
  }

  const courseColorMap = options?.courseColors || buildCourseColorMap(schedule, options?.customColors);

  const parts = [];
  const esc = escapeSvgText;
  const title = esc(formatExportTitle(schedule));

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="Weekly schedule from AnimoSort">`);
  parts.push(`<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#ffffff"/>`);

  const titleSize = 32;
  const subSize = 16;
  const titleY = HEADER + 12;
  parts.push(`<text x="${MARGIN}" y="${titleY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="bold" fill="#087830">${title}</text>`);

  const meetingCount = schedule.meetings.length;
  const courseCount = new Set(schedule.meetings.map((m) => m.courseCode)).size;
  parts.push(`<text x="${MARGIN}" y="${titleY + 26}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" fill="#555555">${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${meetingCount} ${meetingCount === 1 ? 'meeting' : 'meetings'}</text>`);

  const gridTop = HEADER + 100;
  const gridBottom = SVG_HEIGHT - MARGIN - 20;
  const gridHeight = gridBottom - gridTop;
  const tableX = MARGIN + GUTTER;
  const tableWidth = SVG_WIDTH - MARGIN * 2 - GUTTER;
  const headerHeight = 36;
  const colWidth = tableWidth / 6;
  const timeX = tableX - 10;
  const allMinutes = schedule.meetings.flatMap((meeting) => [meeting.startMinutes, meeting.endMinutes]);
  const canvasStart = Math.max(0, Math.min(...allMinutes) - 15);
  const canvasEnd = Math.min(1440, Math.max(...allMinutes) + 15);
  const minutesInSpan = Math.max(1, canvasEnd - canvasStart);
  const visiblePeriods = [
    ...STANDARD_PERIODS.filter(([start, end]) => start >= canvasStart && end <= canvasEnd),
    ...schedule.meetings.map((m) => [m.startMinutes, m.endMinutes]),
  ];
  const guideEntries = createGuideEntries(visiblePeriods);

  // Outer timetable container
  parts.push(`<rect x="${tableX}" y="${gridTop - headerHeight}" width="${tableWidth}" height="${gridHeight + headerHeight}" rx="6" fill="#ffffff" stroke="#d5dad7" stroke-width="1.2"/>`);
  parts.push(`<rect x="${tableX}" y="${gridTop - headerHeight}" width="${tableWidth}" height="${headerHeight}" rx="6" fill="#f4f7f5" stroke="#d5dad7" stroke-width="1.2"/>`);
  parts.push(`<rect x="${tableX}" y="${gridTop - 10}" width="${tableWidth}" height="10" fill="#f4f7f5"/>`);
  parts.push(`<line x1="${tableX}" y1="${gridTop}" x2="${tableX + tableWidth}" y2="${gridTop}" stroke="#d5dad7" stroke-width="1.2"/>`);

  // Horizontal gridlines and time labels
  for (const entry of guideEntries) {
    const y = gridTop + ((entry.minutes - canvasStart) / minutesInSpan) * gridHeight;
    const labelY = y + 4;
    const stroke = entry.kind === 'major' ? '#cad3ce' : '#ebf0ed';
    const strokeWidth = entry.kind === 'major' ? '1.2' : '1';
    parts.push(`<line x1="${tableX}" y1="${y.toFixed(1)}" x2="${tableX + tableWidth}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);
    parts.push(`<text x="${timeX}" y="${labelY.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" text-anchor="end" fill="#555555">${esc(formatTimeLabel(entry.minutes))}</text>`);
  }

  // Vertical column dividers
  for (let i = 0; i <= DAY_ORDER.length; i += 1) {
    const x = tableX + i * colWidth;
    parts.push(`<line x1="${x.toFixed(1)}" y1="${gridTop - headerHeight}" x2="${x.toFixed(1)}" y2="${gridBottom}" stroke="#e2e7e4" stroke-width="1"/>`);
  }

  // Column headers
  for (let i = 0; i < DAY_ORDER.length; i += 1) {
    const x = tableX + i * colWidth;
    parts.push(`<text x="${(x + colWidth / 2).toFixed(1)}" y="${gridTop - 13}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="#1b2e23">${DAY_LABELS[DAY_ORDER[i]]}</text>`);
  }

  // Empty day labels
  for (let i = 0; i < DAY_ORDER.length; i += 1) {
    const day = DAY_ORDER[i];
    const dayMeetings = schedule.meetings.filter((m) => m.day === day);
    if (!dayMeetings.length) {
      const x = tableX + i * colWidth;
      parts.push(`<text x="${(x + colWidth / 2).toFixed(1)}" y="${(gridTop + gridHeight / 2).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="#999999" text-anchor="middle">No classes</text>`);
    }
  }

  // Meeting blocks
  for (const meeting of schedule.meetings) {
    const dayIndex = DAY_ORDER.indexOf(meeting.day);
    if (dayIndex === -1) continue;
    const x = tableX + dayIndex * colWidth + 5;
    const width = colWidth - 10;
    const top = gridTop + ((meeting.startMinutes - canvasStart) / minutesInSpan) * gridHeight;
    const bottom = gridTop + ((meeting.endMinutes - canvasStart) / minutesInSpan) * gridHeight;
    const height = bottom - top;

    const palette = courseColorMap[meeting.courseCode] || COURSE_PALETTES[0];
    const colors = palette.light;

    parts.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="8" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1.5"/>`);

    const textX = x + 9;
    let ty = top + 20;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="${colors.code}">${esc(meeting.courseCode)} <tspan font-size="10" font-weight="700" fill="${colors.meta}">${esc(meeting.section)}</tspan></text>`);
    ty += 16;
    if (showCourseTitles) {
      for (const titleLine of wrapTitle(meeting.title)) {
        parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600" fill="${colors.title}">${esc(titleLine)}</text>`);
        ty += 13;
      }
      ty += 2;
    }
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${colors.meta}">${esc(`Room: ${formatRoomLabel(meeting)}`)}</text>`);
    ty += 13;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${colors.meta}">${esc(`Time: ${meeting.startLabel} - ${meeting.endLabel}`)}</text>`);
  }

  // Footer branding
  parts.push(`<a href="https://animosort.netlify.app/" target="_blank"><text x="${SVG_WIDTH - MARGIN}" y="${SVG_HEIGHT - 16}" font-family="Helvetica, Arial, sans-serif" font-size="12" text-anchor="end" fill="#666666">made with <tspan font-weight="bold" fill="#1b2e23">Animo</tspan><tspan font-weight="bold" fill="#087830">Sort</tspan> · <tspan fill="#087830" font-weight="500">https://animosort.netlify.app/</tspan></text></a>`);

  parts.push('</svg>');
  return parts.join('\n');
}

export function printSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule.meetings)) {
    const event = new CustomEvent('animosort:export-error', {
      detail: { message: 'Import a schedule before printing.' },
    });
    document.dispatchEvent(event);
    return;
  }
  document.body.classList.add('print-active');
  window.print();
  document.body.classList.remove('print-active');
}

export async function downloadSchedulePng(schedule, options = {}) {
  if (!schedule || !Array.isArray(schedule.meetings)) {
    throw new Error('A valid schedule is required for PNG export');
  }
  const svgString = createScheduleSvg(schedule, options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('SVG image could not be loaded'));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = SVG_WIDTH * scale;
    canvas.height = SVG_HEIGHT * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (typeof canvas.toBlob === 'function') {
      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (pngBlob) {
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.download = PNG_FILENAME;
        link.href = pngUrl;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          URL.revokeObjectURL(pngUrl);
          link.remove();
        }, 1500);
        return;
      }
    }

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.style.display = 'none';
    link.download = PNG_FILENAME;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
    }, 1500);
  } finally {
    URL.revokeObjectURL(url);
  }
}
