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
    id: 'plain',
    name: 'Plain (Minimal)',
    swatch: '#94a3b8',
    light: { bg: '#ffffff', border: '#cbd5e1', code: '#1e293b', title: '#334155', meta: '#64748b' },
    dark: { bg: '#080808', border: '#334155', code: '#f8fafc', title: '#cbd5e1', meta: '#94a3b8' },
  },
  {
    id: 'sage',
    name: 'Pastel Sage',
    swatch: '#52796f',
    light: { bg: '#f2f7f4', border: '#bcd6c6', code: '#2f523d', title: '#1f3829', meta: '#52796f' },
    dark: { bg: '#0d1a14', border: '#2f523d', code: '#86efac', title: '#ecfdf5', meta: '#6ee7b7' },
  },
  {
    id: 'sky',
    name: 'Pastel Sky',
    swatch: '#4682b4',
    light: { bg: '#f0f5fb', border: '#bed4eb', code: '#285882', title: '#1b3b57', meta: '#4682b4' },
    dark: { bg: '#0c1724', border: '#285882', code: '#93c5fd', title: '#eff6ff', meta: '#60a5fa' },
  },
  {
    id: 'lavender',
    name: 'Pastel Lavender',
    swatch: '#7d6ba8',
    light: { bg: '#f6f3fb', border: '#d5c9ec', code: '#564287', title: '#3a2c5c', meta: '#7d6ba8' },
    dark: { bg: '#181226', border: '#564287', code: '#c4b5fd', title: '#faf5ff', meta: '#a78bfa' },
  },
  {
    id: 'peach',
    name: 'Pastel Peach',
    swatch: '#ba6e54',
    light: { bg: '#fbf4f0', border: '#ebcfc3', code: '#8a442b', title: '#5e2d1c', meta: '#ba6e54' },
    dark: { bg: '#22120c', border: '#8a442b', code: '#fdba74', title: '#fff7ed', meta: '#fb923c' },
  },
  {
    id: 'mint',
    name: 'Pastel Mint',
    swatch: '#3f827c',
    light: { bg: '#f0f8f7', border: '#b7deda', code: '#245953', title: '#163b37', meta: '#3f827c' },
    dark: { bg: '#0b1c1a', border: '#245953', code: '#5eead4', title: '#f0fdfa', meta: '#2dd4bf' },
  },
  {
    id: 'rose',
    name: 'Pastel Rose',
    swatch: '#b55e79',
    light: { bg: '#faf1f4', border: '#e7c3cf', code: '#873650', title: '#5e2235', meta: '#b55e79' },
    dark: { bg: '#230e16', border: '#873650', code: '#f472b6', title: '#fdf2f8', meta: '#f43f5e' },
  },
  {
    id: 'sand',
    name: 'Pastel Sand',
    swatch: '#917c56',
    light: { bg: '#f9f7f2', border: '#e0d8c4', code: '#6e5a35', title: '#4a3c22', meta: '#917c56' },
    dark: { bg: '#1e1910', border: '#6e5a35', code: '#fde047', title: '#fefce8', meta: '#eab308' },
  },
  {
    id: 'slate',
    name: 'Pastel Slate',
    swatch: '#5a6f84',
    light: { bg: '#f1f4f7', border: '#c3ced9', code: '#36495d', title: '#22303e', meta: '#5a6f84' },
    dark: { bg: '#11171f', border: '#36495d', code: '#94a3b8', title: '#f8fafc', meta: '#cbd5e1' },
  },
];

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  if (Number.isNaN(bigint)) return { r: 100, g: 116, b: 139 };
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

export function createCustomPalette(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lightBg = `rgb(${Math.round(r * 0.08 + 255 * 0.92)}, ${Math.round(g * 0.08 + 255 * 0.92)}, ${Math.round(b * 0.08 + 255 * 0.92)})`;
  const lightBorder = `rgb(${Math.round(r * 0.4 + 255 * 0.6)}, ${Math.round(g * 0.4 + 255 * 0.6)}, ${Math.round(b * 0.4 + 255 * 0.6)})`;
  const lightCode = `rgb(${Math.round(r * 0.75)}, ${Math.round(g * 0.75)}, ${Math.round(b * 0.75)})`;
  const lightTitle = `rgb(${Math.round(r * 0.45)}, ${Math.round(g * 0.45)}, ${Math.round(b * 0.45)})`;
  const lightMeta = `rgb(${Math.round(r * 0.65)}, ${Math.round(g * 0.65)}, ${Math.round(b * 0.65)})`;

  const darkBg = `rgb(${Math.round(r * 0.12)}, ${Math.round(g * 0.12)}, ${Math.round(b * 0.12)})`;
  const darkBorder = `rgb(${Math.round(r * 0.55 + 20)}, ${Math.round(g * 0.55 + 20)}, ${Math.round(b * 0.55 + 20)})`;
  const darkCode = `rgb(${Math.round(r * 0.4 + 255 * 0.6)}, ${Math.round(g * 0.4 + 255 * 0.6)}, ${Math.round(b * 0.4 + 255 * 0.6)})`;
  const darkTitle = '#f8fafc';
  const darkMeta = `rgb(${Math.round(r * 0.5 + 255 * 0.5)}, ${Math.round(g * 0.5 + 255 * 0.5)}, ${Math.round(b * 0.5 + 255 * 0.5)})`;

  return {
    id: `custom-${hex.replace('#', '')}`,
    name: `Custom (${hex.toUpperCase()})`,
    swatch: hex,
    isCustom: true,
    light: { bg: lightBg, border: lightBorder, code: lightCode, title: lightTitle, meta: lightMeta },
    dark: { bg: darkBg, border: darkBorder, code: darkCode, title: darkTitle, meta: darkMeta },
  };
}

export function getPaletteById(idOrHex) {
  if (!idOrHex) return COURSE_PALETTES[1];
  if (typeof idOrHex === 'string' && idOrHex.startsWith('#')) {
    return createCustomPalette(idOrHex);
  }
  return COURSE_PALETTES.find((p) => p.id === idOrHex) || COURSE_PALETTES[1];
}

export function buildCourseColorMap(schedule, customColors = {}) {
  const map = {};
  if (!schedule || !Array.isArray(schedule.meetings)) return map;
  const distinctCourses = [...new Set(schedule.meetings.map((m) => m.courseCode))];
  const pastelPresets = COURSE_PALETTES.slice(1);
  distinctCourses.forEach((code, index) => {
    const custom = customColors[code];
    const palette = custom ? getPaletteById(custom) : pastelPresets[index % pastelPresets.length];
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
