import { DAY_ORDER, STANDARD_PERIODS } from './eaf-parser.js';
import {
  COURSE_PALETTES,
  buildCourseColorMap,
  createCustomPalette,
  createDefaultProfile,
  formatMeetingMetadataLines,
  getCourseKey,
  getPaletteById,
  normalizeCourseCode,
  resolveMeetingCustomization,
} from './customization.js';

// Keep the palette helpers available to existing direct consumers while the
// implementation remains centralized in customization.js.
export { COURSE_PALETTES, buildCourseColorMap, createCustomPalette, getPaletteById };

const DAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday' };
const PNG_FILENAME = 'animo-sort-schedule.png';
const SVG_WIDTH = 1400;
const SVG_HEIGHT = 1000;
const MARGIN = 40;
const GUTTER = 120;
const HEADER = 90;
const GRID_TOP = HEADER + 100;
const FOOTER_BOTTOM_GAP = MARGIN + 20;
const BASE_GRID_HEIGHT = SVG_HEIGHT - GRID_TOP - FOOTER_BOTTOM_GAP;

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

function createCourseIndexMap(schedule) {
  const indexes = new Map();
  for (const meeting of schedule.meetings) {
    const code = normalizeCourseCode(meeting.courseCode);
    if (code && !indexes.has(code)) indexes.set(code, indexes.size);
  }
  return indexes;
}

export function getMeetingContentRequirements(meeting, resolved, showCourseTitles) {
  const lines = formatMeetingMetadataLines(meeting, resolved);
  return {
    titleLines: showCourseTitles ? wrapTitle(meeting.title, 22).length : 0,
    locationLines: wrapTitle(lines.locationMode, 25).length,
    professorLines: lines.professor ? wrapTitle(lines.professor, 25).length : 0,
    timeLines: wrapTitle(lines.time, 25).length,
  };
}

export function getTimelineLayout(schedule, showCourseTitles, profile = createDefaultProfile()) {
  if (!schedule || !Array.isArray(schedule.meetings) || schedule.meetings.length === 0) {
    throw new Error('A valid schedule is required for export');
  }
  const allMinutes = schedule.meetings.flatMap((meeting) => [meeting.startMinutes, meeting.endMinutes]);
  const canvasStart = Math.max(0, Math.min(...allMinutes) - 15);
  const canvasEnd = Math.min(1440, Math.max(...allMinutes) + 15);
  const minutesInSpan = Math.max(1, canvasEnd - canvasStart);
  const courseColorMap = buildCourseColorMap(schedule, profile);
  const courseIndexes = createCourseIndexMap(schedule);
  let gridHeight = BASE_GRID_HEIGHT;

  for (const meeting of schedule.meetings) {
    const code = getCourseKey(meeting.courseCode);
    const resolved = resolveMeetingCustomization(profile, meeting, courseIndexes.get(code) || 0, courseColorMap);
    const requirements = getMeetingContentRequirements(meeting, resolved, showCourseTitles);
    const contentHeight = 20 + 16 +
      (showCourseTitles ? requirements.titleLines * 13 + 2 : 0) +
      requirements.locationLines * 13 +
      requirements.professorLines * 13 +
      requirements.timeLines * 13 + 8;
    const duration = Math.max(1, meeting.endMinutes - meeting.startMinutes);
    gridHeight = Math.max(gridHeight, (contentHeight * minutesInSpan) / duration);
  }

  gridHeight = Math.ceil(gridHeight);
  return {
    canvasStart,
    canvasEnd,
    minutesInSpan,
    gridHeight,
    gridBottom: GRID_TOP + gridHeight,
    svgHeight: GRID_TOP + gridHeight + FOOTER_BOTTOM_GAP,
  };
}

export function createScheduleSvg(schedule, options = {}) {
  if (!schedule || !Array.isArray(schedule.meetings) || schedule.meetings.length === 0) {
    throw new Error('A valid schedule is required for export');
  }
  const showCourseTitles = options?.showCourseTitles !== false;
  const profile = options?.profile || createDefaultProfile();
  const isDark = options?.theme === 'dark';
  const courseColorMap = buildCourseColorMap(schedule, profile);
  const courseIndexes = createCourseIndexMap(schedule);
  const parts = [];
  const title = escapeSvgText(formatExportTitle(schedule));

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
  const footerBrandStrong = isDark ? '#f9fafb' : '#111111';

  const { canvasStart, minutesInSpan, gridHeight, gridBottom, svgHeight } = getTimelineLayout(schedule, showCourseTitles, profile);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${svgHeight}" viewBox="0 0 ${SVG_WIDTH} ${svgHeight}" role="img" aria-label="Weekly schedule from AnimoSort">`);
  parts.push(`<rect width="${SVG_WIDTH}" height="${svgHeight}" fill="${canvasBg}"/>`);

  const titleSize = 32;
  const subSize = 16;
  const titleY = HEADER + 12;
  parts.push(`<text x="${MARGIN}" y="${titleY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="bold" fill="${headerBrandColor}">${title}</text>`);

  const meetingCount = schedule.meetings.length;
  const courseCount = new Set(schedule.meetings.map((m) => normalizeCourseCode(m.courseCode))).size;
  parts.push(`<text x="${MARGIN}" y="${titleY + 26}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" fill="${summaryColor}">${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${meetingCount} ${meetingCount === 1 ? 'meeting' : 'meetings'}</text>`);

  const gridTop = GRID_TOP;
  const tableX = MARGIN + GUTTER;
  const tableWidth = SVG_WIDTH - MARGIN * 2 - GUTTER;
  const headerHeight = 36;
  const colWidth = tableWidth / 6;
  const timeX = tableX - 10;
  const visiblePeriods = [
    ...STANDARD_PERIODS.filter(([start, end]) => start >= canvasStart && end <= canvasStart + minutesInSpan),
    ...schedule.meetings.map((m) => [m.startMinutes, m.endMinutes]),
  ];
  const guideEntries = createGuideEntries(visiblePeriods);

  parts.push(`<rect x="${tableX}" y="${gridTop - headerHeight}" width="${tableWidth}" height="${gridHeight + headerHeight}" rx="6" fill="${containerBg}" stroke="${containerBorder}" stroke-width="1.2"/>`);
  parts.push(`<rect x="${tableX}" y="${gridTop - headerHeight}" width="${tableWidth}" height="${headerHeight}" rx="6" fill="${headerBg}" stroke="${containerBorder}" stroke-width="1.2"/>`);
  parts.push(`<rect x="${tableX}" y="${gridTop - 10}" width="${tableWidth}" height="10" fill="${headerBg}"/>`);
  parts.push(`<line x1="${tableX}" y1="${gridTop}" x2="${tableX + tableWidth}" y2="${gridTop}" stroke="${containerBorder}" stroke-width="1.2"/>`);

  for (const entry of guideEntries) {
    const y = gridTop + ((entry.minutes - canvasStart) / minutesInSpan) * gridHeight;
    const labelY = y + 4;
    const stroke = entry.kind === 'major' ? majorGridColor : minorGridColor;
    const strokeWidth = entry.kind === 'major' ? '1.2' : '1';
    parts.push(`<line x1="${tableX}" y1="${y.toFixed(1)}" x2="${tableX + tableWidth}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);
    parts.push(`<text x="${timeX}" y="${labelY.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" text-anchor="end" fill="${timeLabelColor}">${escapeSvgText(formatTimeLabel(entry.minutes))}</text>`);
  }

  for (let i = 0; i <= DAY_ORDER.length; i += 1) {
    const x = tableX + i * colWidth;
    parts.push(`<line x1="${x.toFixed(1)}" y1="${gridTop - headerHeight}" x2="${x.toFixed(1)}" y2="${gridBottom}" stroke="${columnDivider}" stroke-width="1"/>`);
  }

  for (let i = 0; i < DAY_ORDER.length; i += 1) {
    const x = tableX + i * colWidth;
    parts.push(`<text x="${(x + colWidth / 2).toFixed(1)}" y="${gridTop - 13}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="${dayHeaderColor}">${DAY_LABELS[DAY_ORDER[i]]}</text>`);
  }

  for (let i = 0; i < DAY_ORDER.length; i += 1) {
    const day = DAY_ORDER[i];
    const dayMeetings = schedule.meetings.filter((m) => m.day === day);
    if (!dayMeetings.length) {
      const x = tableX + i * colWidth;
      parts.push(`<text x="${(x + colWidth / 2).toFixed(1)}" y="${(gridTop + gridHeight / 2).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="${emptyDayColor}" text-anchor="middle">No classes</text>`);
    }
  }

  for (const meeting of schedule.meetings) {
    const dayIndex = DAY_ORDER.indexOf(meeting.day);
    if (dayIndex === -1) continue;
    const courseKey = getCourseKey(meeting.courseCode);
    const resolved = resolveMeetingCustomization(profile, meeting, courseIndexes.get(courseKey) || 0, courseColorMap);
    const lines = formatMeetingMetadataLines(meeting, resolved);
    const palette = resolved.palette;
    const colors = isDark ? palette.dark : palette.light;
    const x = tableX + dayIndex * colWidth + 5;
    const width = colWidth - 10;
    const top = gridTop + ((meeting.startMinutes - canvasStart) / minutesInSpan) * gridHeight;
    const bottom = gridTop + ((meeting.endMinutes - canvasStart) / minutesInSpan) * gridHeight;
    const height = bottom - top;

    parts.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="8" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1.5"/>`);
    const dotX = x + width - 12;
    const dotY = top + 14;
    parts.push(`<circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="4.5" fill="${palette.swatch}" stroke="${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}" stroke-width="0.8"/>`);

    const textX = x + 9;
    let ty = top + 20;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="${colors.code}">${escapeSvgText(meeting.courseCode)} <tspan font-size="10" font-weight="700" fill="${colors.meta}">${escapeSvgText(meeting.section)}</tspan></text>`);
    ty += 16;
    if (showCourseTitles) {
      for (const titleLine of wrapTitle(meeting.title, 22)) {
        parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600" fill="${colors.title}">${escapeSvgText(titleLine)}</text>`);
        ty += 13;
      }
      ty += 2;
    }
    for (const locationLine of wrapTitle(lines.locationMode, 25)) {
      parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${colors.meta}">${escapeSvgText(locationLine)}</text>`);
      ty += 13;
    }
    if (lines.professor) {
      for (const professorLine of wrapTitle(lines.professor, 25)) {
        parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${colors.meta}">${escapeSvgText(professorLine)}</text>`);
        ty += 13;
      }
    }
    for (const timeLine of wrapTitle(lines.time, 25)) {
      parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${colors.meta}">${escapeSvgText(timeLine)}</text>`);
      ty += 13;
    }
  }

  parts.push(`<a href="https://animosort.netlify.app/" target="_blank"><text x="${SVG_WIDTH - MARGIN}" y="${svgHeight - 16}" font-family="Helvetica, Arial, sans-serif" font-size="12" text-anchor="end" fill="${footerBrandText}">made with <tspan font-weight="bold" fill="${footerBrandStrong}">Animo</tspan><tspan font-weight="bold" font-style="italic" fill="${headerBrandColor}">Sort</tspan> · <tspan fill="${headerBrandColor}" font-weight="500">https://animosort.netlify.app/</tspan></text></a>`);
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
  const showCourseTitles = options?.showCourseTitles !== false;
  const profile = options?.profile || createDefaultProfile();
  const svgString = createScheduleSvg(schedule, { ...options, profile, showCourseTitles });
  const { svgHeight } = getTimelineLayout(schedule, showCourseTitles, profile);
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
    canvas.height = svgHeight * scale;
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
    setTimeout(() => link.remove(), 1500);
  } finally {
    URL.revokeObjectURL(url);
  }
}
