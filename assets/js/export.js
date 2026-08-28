// Single-page PNG export and native print for Animo Sort.
// Accepts only the sanitized Schedule object produced by eaf-parser.js.

import { DAY_ORDER, STANDARD_PERIODS } from './eaf-parser.js';

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
    return `Animo Sort — ${schedule.session}`;
  }
  return 'Animo Sort';
}

function formatTimeLabel(minutes) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
}

export function createScheduleSvg(schedule) {
  if (!schedule || !Array.isArray(schedule.meetings)) {
    throw new Error('A valid schedule is required for export');
  }

  const parts = [];
  const esc = escapeSvgText;
  const title = esc(formatExportTitle(schedule));

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="Weekly schedule from Animo Sort">`);
  parts.push(`<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#ffffff"/>`);

  const titleSize = 34;
  const subSize = 18;
  const titleY = HEADER + 12;
  parts.push(`<text x="${MARGIN}" y="${titleY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="bold" fill="#087830">${title}</text>`);

  const meetingCount = schedule.meetings.length;
  const courseCount = new Set(schedule.meetings.map((m) => m.courseCode)).size;
  parts.push(`<text x="${MARGIN}" y="${titleY + 28}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" fill="#444444">${courseCount} ${courseCount === 1 ? 'course' : 'courses'} · ${meetingCount} ${meetingCount === 1 ? 'meeting' : 'meetings'}</text>`);

  const gridTop = HEADER + 52;
  const gridBottom = SVG_HEIGHT - MARGIN;
  const gridHeight = gridBottom - gridTop;
  const colWidth = (SVG_WIDTH - MARGIN * 2 - GUTTER) / 6;
  const timeX = MARGIN + GUTTER - 10;

  // Time guides
  const minutesInSpan = 1440;
  for (const [start] of STANDARD_PERIODS) {
    const y = gridTop + (start / minutesInSpan) * gridHeight;
    parts.push(`<line x1="${MARGIN + GUTTER}" y1="${y.toFixed(1)}" x2="${SVG_WIDTH - MARGIN}" y2="${y.toFixed(1)}" stroke="#e0e0e0" stroke-width="1"/>`);
    parts.push(`<text x="${timeX}" y="${(y - 4).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" text-anchor="end" fill="#666666">${esc(formatTimeLabel(start))}</text>`);
  }

  // Column headers
  for (let i = 0; i < DAY_ORDER.length; i += 1) {
    const x = MARGIN + GUTTER + i * colWidth;
    parts.push(`<text x="${(x + colWidth / 2).toFixed(1)}" y="${gridTop - 14}" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#111111">${DAY_LABELS[DAY_ORDER[i]]}</text>`);
  }

  // Meeting blocks
  for (const meeting of schedule.meetings) {
    const dayIndex = DAY_ORDER.indexOf(meeting.day);
    if (dayIndex === -1) continue;
    const x = MARGIN + GUTTER + dayIndex * colWidth + 6;
    const width = colWidth - 12;
    const top = gridTop + (meeting.startMinutes / minutesInSpan) * gridHeight;
    const bottom = gridTop + (meeting.endMinutes / minutesInSpan) * gridHeight;
    const height = Math.max(bottom - top, 24);

    parts.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="3" fill="#f2f9f4" stroke="#087830" stroke-width="1.5"/>`);
    parts.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="5" height="${height.toFixed(1)}" fill="#087830"/>`);

    const textX = x + 10;
    let ty = top + 20;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#111111">${esc(meeting.courseCode)}</text>`);
    ty += 18;
    const titleText = meeting.title.length > 60 ? `${meeting.title.slice(0, 57)}…` : meeting.title;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#111111">${esc(titleText)}</text>`);
    ty += 16;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#444444">${esc(meeting.section)} · ${esc(String(meeting.credits))} cr</text>`);
    ty += 16;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#444444">${esc(meeting.location)}</text>`);
    ty += 15;
    parts.push(`<text x="${textX}" y="${ty.toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#087830">${esc(meeting.startLabel)}–${esc(meeting.endLabel)}</text>`);
  }

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

export async function downloadSchedulePng(schedule) {
  if (!schedule || !Array.isArray(schedule.meetings)) {
    throw new Error('A valid schedule is required for PNG export');
  }
  const svgString = createScheduleSvg(schedule);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.setAttribute('href', url);
  link.setAttribute('download', PNG_FILENAME);
  document.body.appendChild(link);

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
    const pngUrl = canvas.toDataURL('image/png');
    link.href = pngUrl;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
    link.remove();
  }
}
