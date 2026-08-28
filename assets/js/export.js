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

export function wrapTitle(title, maxChars = 22) {
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
    dark: { bg: '#0a0a0a', border: '#334155', code: '#f8fafc', title: '#cbd5e1', meta: '#94a3b8' },
  },
  {
    id: 'sage',
    name: 'Pastel Sage',
    swatch: '#52796f',
    light: { bg: '#eaf4ee', border: '#aed2bc', code: '#245035', title: '#163823', meta: '#3d6c4f' },
    dark: { bg: '#0d1a14', border: '#2f523d', code: '#86efac', title: '#ecfdf5', meta: '#6ee7b7' },
  },
  {
    id: 'sky',
    name: 'Pastel Sky',
    swatch: '#4682b4',
    light: { bg: '#e8f2fa', border: '#b0d1ee', code: '#1f5380', title: '#13395b', meta: '#3873a4' },
    dark: { bg: '#0c1724', border: '#285882', code: '#93c5fd', title: '#eff6ff', meta: '#60a5fa' },
  },
  {
    id: 'lavender',
    name: 'Pastel Lavender',
    swatch: '#7d6ba8',
    light: { bg: '#f3eef9', border: '#cdc0ea', code: '#503a83', title: '#36245c', meta: '#6e5a9c' },
    dark: { bg: '#181226', border: '#564287', code: '#c4b5fd', title: '#faf5ff', meta: '#a78bfa' },
  },
  {
    id: 'peach',
    name: 'Pastel Peach',
    swatch: '#ba6e54',
    light: { bg: '#f9eee8', border: '#e7c6b7', code: '#7f3c24', title: '#562514', meta: '#aa5f45' },
    dark: { bg: '#22120c', border: '#8a442b', code: '#fdba74', title: '#fff7ed', meta: '#fb923c' },
  },
  {
    id: 'mint',
    name: 'Pastel Mint',
    swatch: '#3f827c',
    light: { bg: '#e7f5f3', border: '#a8dcd5', code: '#1c554e', title: '#103934', meta: '#30756e' },
    dark: { bg: '#0b1c1a', border: '#245953', code: '#5eead4', title: '#f0fdfa', meta: '#2dd4bf' },
  },
  {
    id: 'rose',
    name: 'Pastel Rose',
    swatch: '#b55e79',
    light: { bg: '#f9ecf0', border: '#e6bac9', code: '#7d2d46', title: '#551a2c', meta: '#a64d6a' },
    dark: { bg: '#230e16', border: '#873650', code: '#f472b6', title: '#fdf2f8', meta: '#f43f5e' },
  },
  {
    id: 'sand',
    name: 'Pastel Sand',
    swatch: '#917c56',
    light: { bg: '#f7f4ec', border: '#ded3bc', code: '#65512b', title: '#443419', meta: '#877149' },
    dark: { bg: '#1e1910', border: '#6e5a35', code: '#fde047', title: '#fefce8', meta: '#eab308' },
  },
  {
    id: 'slate',
    name: 'Pastel Slate',
    swatch: '#5a6f84',
    light: { bg: '#edf2f6', border: '#b9c7d4', code: '#2e4154', title: '#1b2a38', meta: '#4f6479' },
    dark: { bg: '#11171f', border: '#36495d', code: '#94a3b8', title: '#f8fafc', meta: '#cbd5e1' },
  },
];

function toHex(n) {
  const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

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

  const isDark = options?.theme === 'dark';
  const courseColorMap = options?.courseColors || buildCourseColorMap(schedule, options?.customColors);

  const parts = [];
  const esc = escapeSvgText;
  const title = esc(formatExportTitle(schedule));

  const canvasBg = isDark ? '#000000' : '#ffffff';
  const headerBrandColor = isDark ? '#22c55e' : '#087830';
  const summaryColor = isDark ? '#9ca3af' : '#555555';
  const containerBg = isDark ? '#050505' : '#ffffff';
  const headerBg = isDark ? '#0f0f0f' : '#f4f7f5';
  const containerBorder = isDark ? '#262626' : '#d5dad7';
  const columnDivider = isDark ? '#1f1f1f' : '#e2e7e4';
  const dayHeaderColor = isDark ? '#f9fafb' : '#1b2e23';
  const timeLabelColor = isDark ? '#9ca3af' : '#555555';
  const majorGridColor = isDark ? '#262626' : '#cad3ce';
  const minorGridColor = isDark ? '#171717' : '#ebf0ed';
  const emptyDayColor = isDark ? '#6b7280' : '#999999';
  const footerBrandText = isDark ? '#9ca3af' : '#666666';
  const footerBrandStrong = isDark ? '#f9fafb' : '#1b2e23';

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="Weekly schedule from AnimoSort">`);
  parts.push(`<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${canvasBg}"/>`);

  const titleSize = 32;
  const subSize = 16;
  const titleY = HEADER + 12;
  parts.push(`<text x="${MARGIN}" y="${titleY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="bold" fill="${headerBrandColor}">${title}</text>`);

  const meetingCount = schedule.meetings.length;
  const courseCount = new Set(schedule.meetings.map((m) => m.courseCode)).size;
  parts.push(`<text x="${MARGIN}" y="${titleY + 26}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" fill="${summaryColor}">${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${meetingCount} ${meetingCount === 1 ? 'meeting' : 'meetings'}</text>`);

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
  parts.push(`<rect x="${tableX}" y="${gridTop - headerHeight}" width="${tableWidth}" height="${gridHeight + headerHeight}" rx="6" fill="${containerBg}" stroke="${containerBorder}" stroke-width="1.2"/>`);
  parts.push(`<rect x="${tableX}" y="${gridTop - headerHeight}" width="${tableWidth}" height="${headerHeight}" rx="6" fill="${headerBg}" stroke="${containerBorder}" stroke-width="1.2"/>`);
  parts.push(`<rect x="${tableX}" y="${gridTop - 10}" width="${tableWidth}" height="10" fill="${headerBg}"/>`);
  parts.push(`<line x1="${tableX}" y1="${gridTop}" x2="${tableX + tableWidth}" y2="${gridTop}" stroke="${containerBorder}" stroke-width="1.2"/>`);

  // Horizontal gridlines and time labels
  for (const entry of guideEntries) {
    const y = gridTop + ((entry.minutes - canvasStart) / minutesInSpan) * gridHeight;
    const labelY = y + 4;
    const stroke = entry.kind === 'major' ? majorGridColor : minorGridColor;
    const strokeWidth = entry.kind === 'major' ? '1.2' : '1';
    parts.push(`<line x1="${tableX}" y1="${y.toFixed(1)}" x2="${tableX + tableWidth}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);
    parts.push(`<text x="${timeX}" y="${labelY.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" text-anchor="end" fill="${timeLabelColor}">${esc(formatTimeLabel(entry.minutes))}</text>`);
  }

  // Vertical column dividers
  for (let i = 0; i <= DAY_ORDER.length; i += 1) {
    const x = tableX + i * colWidth;
    parts.push(`<line x1="${x.toFixed(1)}" y1="${gridTop - headerHeight}" x2="${x.toFixed(1)}" y2="${gridBottom}" stroke="${columnDivider}" stroke-width="1"/>`);
  }

  // Column headers
  for (let i = 0; i < DAY_ORDER.length; i += 1) {
    const x = tableX + i * colWidth;
    parts.push(`<text x="${(x + colWidth / 2).toFixed(1)}" y="${gridTop - 13}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="${dayHeaderColor}">${DAY_LABELS[DAY_ORDER[i]]}</text>`);
  }

  // Empty day labels
  for (let i = 0; i < DAY_ORDER.length; i += 1) {
    const day = DAY_ORDER[i];
    const dayMeetings = schedule.meetings.filter((m) => m.day === day);
    if (!dayMeetings.length) {
      const x = tableX + i * colWidth;
      parts.push(`<text x="${(x + colWidth / 2).toFixed(1)}" y="${(gridTop + gridHeight / 2).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="${emptyDayColor}" text-anchor="middle">No classes</text>`);
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
    const colors = isDark ? palette.dark : palette.light;

    parts.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="8" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1.5"/>`);

    // Top-right color dot
    const dotX = x + width - 12;
    const dotY = top + 14;
    parts.push(`<circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="4.5" fill="${palette.swatch}" stroke="${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}" stroke-width="0.8"/>`);

    const textX = x + 9;
    let ty = top + 20;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="${colors.code}">${esc(meeting.courseCode)} <tspan font-size="10" font-weight="700" fill="${colors.meta}">${esc(meeting.section)}</tspan></text>`);
    ty += 16;
    if (showCourseTitles) {
      for (const titleLine of wrapTitle(meeting.title, 22)) {
        parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600" fill="${colors.title}">${esc(titleLine)}</text>`);
        ty += 13;
      }
      ty += 2;
    }
    for (const roomLine of wrapTitle(`Room: ${formatRoomLabel(meeting)}`, 25)) {
      parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${colors.meta}">${esc(roomLine)}</text>`);
      ty += 13;
    }
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${colors.meta}">${esc(`Time: ${meeting.startLabel} - ${meeting.endLabel}`)}</text>`);
  }

  // Footer branding
  parts.push(`<a href="https://animosort.netlify.app/" target="_blank"><text x="${SVG_WIDTH - MARGIN}" y="${SVG_HEIGHT - 16}" font-family="Helvetica, Arial, sans-serif" font-size="12" text-anchor="end" fill="${footerBrandText}">made with <tspan font-weight="bold" fill="${footerBrandStrong}">Animo</tspan><tspan font-weight="bold" fill="${headerBrandColor}">Sort</tspan> · <tspan fill="${headerBrandColor}" font-weight="500">https://animosort.netlify.app/</tspan></text></a>`);

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
