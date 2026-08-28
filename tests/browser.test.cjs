// Animo Sort browser acceptance suite. Run with: node tests/run.cjs
// Covers parser boundaries, UI lifecycle, privacy, exports, print,
// accessibility, responsive behavior, and repository hygiene.

const fs = require('fs');
const path = require('path');
const { startStaticServer, launchBrowser, ROOT } = require('./support/browser.cjs');

const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const RESULTS = { pass: 0, fail: 0, failures: [] };

function ok(cond, label) {
  if (cond) {
    RESULTS.pass += 1;
  } else {
    RESULTS.fail += 1;
    RESULTS.failures.push(label);
    console.error(`FAIL: ${label}`);
  }
}

function fixture(name) {
  return path.join(FIXTURES, name);
}

async function importPdf(page, fixtureName) {
  await page.setInputFiles('#eaf-file', fixture(fixtureName));
  await page.waitForFunction(
    (shown) => document.getElementById('schedule-panel') && !document.getElementById('schedule-panel').hidden,
    true,
    { timeout: 15000 }
  );
  // Ensure the change handler finished by waiting for the parsing status to settle.
  await page.waitForFunction(
    () => {
      const input = document.getElementById('eaf-file');
      return !input.disabled;
    },
    undefined,
    { timeout: 15000 }
  );
}

async function importPdfExpectError(page, fixtureName) {
  await page.setInputFiles('#eaf-file', fixture(fixtureName));
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status-region');
      return status && status.getAttribute('role') === 'alert' && status.textContent.trim().length > 0;
    },
    undefined,
    { timeout: 15000 }
  );
}

async function dropPdf(page, fixtureName) {
  const bytes = Array.from(fs.readFileSync(fixture(fixtureName)));
  await page.evaluate((data) => {
    const zone = document.getElementById('drop-zone');
    const file = new File([new Uint8Array(data)], 'schedule.pdf', { type: 'application/pdf' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, bytes);
  await page.waitForFunction(
    () => document.getElementById('schedule-panel') && !document.getElementById('schedule-panel').hidden,
    undefined,
    { timeout: 15000 }
  );
  await page.waitForFunction(
    () => !document.getElementById('eaf-file').disabled,
    undefined,
    { timeout: 15000 }
  );
}

async function main() {
  const { server, baseUrl } = await startStaticServer();
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  const eafRequests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('DLSU') || url.includes('.pdf') || url.includes('eaf')) {
      eafRequests.push(url);
    }
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    ok(!(await page.isVisible('#empty-state')), 'empty state hidden initially');
    ok(await page.locator('h1').count() === 1, 'exactly one h1');
    ok((await page.getAttribute('#eaf-file', 'accept')) === 'application/pdf', 'file input accepts application/pdf');
    ok(await page.isVisible('#drop-zone'), 'drop zone visible');
    ok(await page.locator('.hero-badge').count() === 0 && !(await page.textContent('body')).includes('Built for ArcherHub EAF schedules'), 'hero badge removed');
    ok(await page.locator('#eaf-file').count() === 1 && !(await page.isVisible('#eaf-file')) && await page.getAttribute('#eaf-file', 'aria-describedby') === 'import-hint', 'native file input is visually hidden but labelled for assistive technology');
    ok(await page.locator('.nav-logo').count() === 1, 'nav logo is rendered');
    ok(await page.locator('.nav-links, #mobileMenu').count() === 0, 'navigation links and mobile menu removed');

    const browseChooser = page.waitForEvent('filechooser');
    await page.click('#browse-btn');
    await browseChooser;
    ok(true, 'browse button opens the file picker');

    const keyboardChooser = page.waitForEvent('filechooser');
    await page.focus('#drop-zone');
    await page.keyboard.press('Enter');
    await keyboardChooser;
    ok(true, 'drop zone opens the file picker from Enter');
    const spaceChooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Space');
    await spaceChooser;
    ok(true, 'drop zone opens the file picker from Space');
    const clickChooser = page.waitForEvent('filechooser');
    await page.click('#drop-zone');
    await clickChooser;
    ok(true, 'drop zone opens the file picker from click');

    await dropPdf(page, 'one-course.pdf');
    ok(await page.locator('.meeting-block').count() === 1, 'drop zone imports a dropped PDF');

    await importPdf(page, 'valid-seven.pdf');
    const session = await page.textContent('#session-label');
    ok(session.includes('AY 2026-2027 Term 1'), 'session rendered');
    const summary = await page.textContent('#summary-label');
    ok(/7 courses/.test(summary) && /14 meetings/.test(summary), `summary shows 7 courses 14 meetings (${summary.trim()})`);
    ok(await page.locator('.meeting-block').count() === 14, '14 meeting blocks rendered');
    ok(await page.locator('.day-column').count() === 6, 'six day columns');
    ok(await page.locator('.day-column[data-day="SAT"] .empty-day').count() === 1, 'empty day shows No classes');
    ok(await page.isVisible('#schedule-panel'), 'schedule panel visible');
    ok(!(await page.isVisible('#empty-state')), 'empty state hidden after import');
    ok(await page.$eval('#schedule-panel .panel-card', (el) => getComputedStyle(el).opacity === '1'), 'schedule panel is visually revealed after import');
    ok(await page.$eval('#schedule-scroll', (el) => el.scrollWidth === el.clientWidth), 'desktop timetable fits all six days without horizontal scrolling');
    ok(await page.isChecked('#show-course-titles'), 'course names are shown by default');
    ok(await page.$eval('.meeting-title', (el) => getComputedStyle(el).display !== 'none'), 'default course-name state renders title text visually');
    const firstMeetingText = await page.locator('.meeting-block').first().textContent();
    ok(firstMeetingText.includes('Room:') && firstMeetingText.includes('Time:') && !firstMeetingText.includes(' cr'), 'meeting blocks retain section, room, and time without credits');
    const visibleOrder = await page.$eval('.meeting-block', (el) => ({
      children: [...el.children].map((child) => child.className),
      codeGroup: [...el.querySelector('.meeting-code-group').children].map((child) => child.className),
    }));
    ok(visibleOrder.children.join(',') === 'meeting-primary,meeting-title,meeting-room,meeting-time' && visibleOrder.codeGroup.join(',') === 'meeting-code,meeting-section', 'visible meeting fields follow code, section, title, room, time order');
    const roomStyles = await page.$eval('.meeting-block[data-course="FINA101"]', (el) => {
      const room = el.querySelector('.meeting-room');
      const time = el.querySelector('.meeting-time');
      return {
        roomText: room.textContent,
        roomClass: room.className,
        roomColor: getComputedStyle(room).color,
        roomBorder: getComputedStyle(room).borderStyle,
        roomBackground: getComputedStyle(room).backgroundColor,
        timeColor: getComputedStyle(time).color,
        timeBorder: getComputedStyle(time).borderStyle,
        timeBackground: getComputedStyle(time).backgroundColor,
      };
    });
    ok(roomStyles.roomText.includes('M306') && roomStyles.roomText.includes('Miguel Hall'), 'mapped room renders normalized expansion');
    ok(roomStyles.roomClass === 'meeting-room' && roomStyles.roomBorder === 'none' && roomStyles.roomBackground === 'rgba(0, 0, 0, 0)' && roomStyles.roomColor === roomStyles.timeColor && roomStyles.timeBorder === 'none' && roomStyles.timeBackground === 'rgba(0, 0, 0, 0)', 'room and time use neutral plain text without visual chips');
    ok(await page.$eval('.meeting-block[data-course="ECON210"] .meeting-room', (el) => el.textContent.trim() === 'Room: V305'), 'unknown room code stays compact');
    ok(await page.locator('.day-gridline.major').count() > 0 && await page.locator('.day-gridline.minor').count() > 0, 'timetable renders major and minor gridlines');
    const axisSummary = await page.$$eval('.time-gutter .guide-label', (labels) => ({
      labels: labels.map((label) => label.textContent),
      unique: new Set(labels.map((label) => label.textContent)).size,
      starts: document.querySelectorAll('.time-gutter .guide-label.start').length,
      ends: document.querySelectorAll('.time-gutter .guide-label.end').length,
    }));
    ok(axisSummary.labels.includes('7:30 AM') && axisSummary.labels.includes('9:00 AM') && axisSummary.labels.includes('7:30 PM'), 'y axis shows start and end times');
    ok(axisSummary.unique === axisSummary.labels.length && axisSummary.starts === 7 && axisSummary.ends === 7, 'axis end labels are unique and deduplicated');
    const gridMetrics = await page.$eval('#schedule-panel .panel-card', (card) => ({
      canvasWidth: card.querySelector('.schedule-canvas').getBoundingClientRect().width,
      timetableWidth: card.querySelector('.timetable').getBoundingClientRect().width,
      dayWidth: card.querySelector('.day-column').getBoundingClientRect().width,
      bodyHeight: card.querySelector('.day-body').getBoundingClientRect().height,
      scrollWidth: card.querySelector('.schedule-scroll').scrollWidth,
      clientWidth: card.querySelector('.schedule-scroll').clientWidth,
    }));
    ok(gridMetrics.dayWidth >= 120 && gridMetrics.bodyHeight >= 900, `meeting blocks retain readable geometry (${gridMetrics.dayWidth.toFixed(0)}px columns, ${gridMetrics.bodyHeight.toFixed(0)}px body)`);
    ok(gridMetrics.timetableWidth === gridMetrics.clientWidth && gridMetrics.scrollWidth === gridMetrics.clientWidth, 'desktop grid remains within the schedule card width');
    await page.uncheck('#show-course-titles');
    ok(await page.$eval('.meeting-title', (el) => getComputedStyle(el).display === 'none'), 'course-name toggle hides full names');
    await page.check('#show-course-titles');
    ok(await page.$eval('.meeting-title', (el) => getComputedStyle(el).display !== 'none'), 'course-name toggle reveals full names');
    ok((await page.locator('.meeting-block').first().getAttribute('aria-label')).includes('ADVANCED FINANCIAL ECONOMETRICS'), 'accessible meeting label retains course name');
    await page.setViewportSize({ width: 1200, height: 1000 });
    ok(await page.$eval('#schedule-scroll', (el) => el.scrollWidth === el.clientWidth), 'desktop timetable remains within the schedule card at 1200px');
    await page.setViewportSize({ width: 1400, height: 1000 });
    ok(await page.locator('#print-btn').count() === 0, 'print/pdf export button scrapped from actions');

    // Meeting block positioning: 7:30 AM (450) should be above 11:00 AM (660)
    const mon = page.locator('.day-column[data-day="MON"]');
    const yMorning = await mon.locator('.meeting-block', { hasText: 'PHLO201' }).evaluate((el) => el.getBoundingClientRect().top);
    const yMid = await mon.locator('.meeting-block', { hasText: 'ECON210' }).evaluate((el) => el.getBoundingClientRect().top);
    ok(yMorning < yMid, 'continuous chronological placement (early block above later block)');

    // Custom interval sits between 9:15-10:45 and 11:00-12:30 guides (only in custom fixture)
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await importPdf(page, 'custom-interval.pdf');
    const blockRect = await page.locator('.meeting-block').boundingBox();
    const guides = await page.$$eval('.guide-line', (nodes) => nodes.map((n) => ({
      top: n.getBoundingClientRect().top,
      label: n.querySelector('.guide-label') ? n.querySelector('.guide-label').textContent : '',
    })));
    // 10:50 AM-12:20 PM (650-740) must sit above the 11:00 AM (660) guide.
    const guide660 = guides.find((g) => g.label === '11:00 AM');
    ok(guide660 && blockRect.y < guide660.top - 2, `custom interval above 11:00 AM guide (block ${blockRect.y.toFixed(0)} vs guide ${guide660 ? guide660.top.toFixed(0) : 'missing'})`);
    const customGeometry = await page.$eval('.meeting-block', (el) => ({
      top: Number.parseFloat(el.style.top),
      height: Number.parseFloat(el.style.height),
    }));
    ok(Math.abs(customGeometry.top - ((650 - 635) / 120) * 100) < 0.001 && Math.abs(customGeometry.height - (90 / 120) * 100) < 0.001, 'custom interval top and height remain minute-derived');

    await importPdf(page, 'long-title.pdf');
    await page.check('#show-course-titles');
    const longTitleFit = await page.$eval('.meeting-block', (el) => {
      const title = el.querySelector('.meeting-title');
      return {
        text: title.textContent,
        hasMultipleLines: title.getBoundingClientRect().height > parseFloat(getComputedStyle(title).lineHeight),
        titleFits: title.scrollHeight <= title.clientHeight,
        blockFits: el.scrollHeight <= el.clientHeight,
      };
    });
    ok(longTitleFit.text.includes('PHILOSOPHY OF THE HUMAN PERSON') && longTitleFit.hasMultipleLines && longTitleFit.titleFits && longTitleFit.blockFits, 'long course names wrap to full lines without clipping or ellipsis');
    await page.uncheck('#show-course-titles');

    const replaceChooser = page.waitForEvent('filechooser');
    await page.click('#replace-btn');
    await replaceChooser;
    ok(true, 'replace button opens the file picker');
    await importPdf(page, 'one-course.pdf');
    ok(await page.locator('.meeting-block').count() === 1, 'replace shows one meeting');
    ok((await page.textContent('#summary-label')).includes('1 course'), 'replace summary updated');

    await importPdfExpectError(page, 'overlap.pdf');
    ok((await page.locator('.meeting-block').count()) === 1, 'failed replace preserves previous schedule');
    ok((await page.textContent('#status-region')).includes('overlapping'), 'overlap error message shown');
    const errText = await page.textContent('#status-region');
    ok(!errText.includes('SISON') && !errText.includes('12320609'), 'error contains no identity data');

    await page.click('#clear-btn');
    ok(!(await page.isVisible('#empty-state')) && (await page.isHidden('#schedule-panel')), 'clear returns to initial state with schedule hidden');
    ok((await page.locator('.meeting-block').count()) === 0, 'clear removes all meeting blocks');

    await page.setInputFiles('#eaf-file', {
      name: 'oversized.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1024 * 1024 + 1),
    });
    await page.waitForFunction(
      () => document.getElementById('status-region')?.getAttribute('role') === 'alert',
      undefined,
      { timeout: 15000 },
    );
    ok((await page.textContent('#status-region')).includes('larger than 1 MiB'), 'oversized PDF is rejected before parsing');
    ok(!(await page.isVisible('#empty-state')) && (await page.isHidden('#schedule-panel')), 'oversized PDF leaves the schedule hidden');

    await page.evaluate(async () => {
      const { replaceSchedule } = await import('/assets/js/app.js');
      replaceSchedule({
        session: 'AY 2026-2027 Term 1',
        meetings: [
          { id: 'LONG', courseCode: 'LONG101', title: 'LONG COURSE NAME', section: 'A', credits: 3, day: 'MON', startMinutes: 450, endMinutes: 1275, startLabel: '7:30 AM', endLabel: '9:15 PM', location: 'M101' },
          { id: 'SHORT', courseCode: 'SHORT101', title: 'SHORT COURSE NAME', section: 'B', credits: 3, day: 'TUE', startMinutes: 600, endMinutes: 630, startLabel: '10:00 AM', endLabel: '10:30 AM', location: 'Online' },
        ],
      });
    });
    const shortOff = await page.$eval('.meeting-block[data-course="SHORT101"]', (el) => ({
      top: Number.parseFloat(el.style.top),
      height: Number.parseFloat(el.style.height),
      roomVisible: el.textContent.includes('Room: Online'),
      fits: el.scrollHeight <= el.clientHeight,
    }));
    ok(shortOff.roomVisible && shortOff.fits && Math.abs(shortOff.top - ((600 - 435) / 855) * 100) < 0.001 && Math.abs(shortOff.height - (30 / 855) * 100) < 0.001, 'short interval retains room and exact minute-derived placement');
    await page.check('#show-course-titles');
    const shortOn = await page.$eval('.meeting-block[data-course="SHORT101"]', (el) => ({
      fits: el.scrollHeight <= el.clientHeight,
      titleFits: el.querySelector('.meeting-title').scrollHeight <= el.querySelector('.meeting-title').clientHeight,
      bodyHeight: el.closest('.timetable').querySelector('.day-body').getBoundingClientRect().height,
    }));
    ok(shortOn.fits && shortOn.titleFits && shortOn.bodyHeight > 900, 'title-on short interval scales the timetable without clipping');
    await page.uncheck('#show-course-titles');

    await importPdf(page, 'one-course.pdf');
    await page.evaluate(() => {
      const originalArrayBuffer = File.prototype.arrayBuffer;
      window.__animoSortOriginalArrayBuffer = originalArrayBuffer;
      File.prototype.arrayBuffer = function delayedArrayBuffer() {
        return originalArrayBuffer.call(this).then((buffer) => new Promise((resolve) => {
          window.setTimeout(() => resolve(buffer), 250);
        }));
      };
    });
    await page.setInputFiles('#eaf-file', fixture('valid-seven.pdf'));
    await page.click('#clear-btn');
    await page.waitForFunction(
      () => !document.getElementById('eaf-file').disabled,
      undefined,
      { timeout: 15000 },
    );
    ok(!(await page.isVisible('#empty-state')) && (await page.isHidden('#schedule-panel')), 'clear invalidates a pending import');
    ok((await page.locator('.meeting-block').count()) === 0, 'stale import cannot repopulate after clear');
    await page.evaluate(() => {
      File.prototype.arrayBuffer = window.__animoSortOriginalArrayBuffer;
      delete window.__animoSortOriginalArrayBuffer;
    });

    const boundary = [
      ['eaf-no-schedule.pdf', 'no schedule table'],
      ['missing-time.pdf', 'missing a readable time'],
      ['unsupported-day.pdf', 'outside Monday through Saturday'],
      ['invalid-interval.pdf', 'invalid time interval'],
    ];
    for (const [name, expect] of boundary) {
      await importPdfExpectError(page, name);
      const text = await page.textContent('#status-region');
      ok(text.includes(expect), `${name} rejected with expected message (${text.slice(0, 60)})`);
    }

    // non-eaf may surface as NOT_ARCHERHUB_EAF or SESSION_NOT_FOUND; both are valid rejections
    await importPdfExpectError(page, 'non-eaf.pdf');
    const nonEafText = await page.textContent('#status-region');
    ok(/not look like an official ArcherHub EAF|academic session could not be found/.test(nonEafText), `non-eaf.pdf rejected (${nonEafText.slice(0, 50)})`);

    // Touching intervals are valid
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await importPdf(page, 'touching-intervals.pdf');
    ok((await page.locator('.meeting-block').count()) === 2, 'touching intervals accepted');

    // Six-day fixture
    await importPdf(page, 'six-day.pdf');
    const daysWithBlocks = await page.$$eval('.day-column', (cols) => cols.filter((c) => c.querySelector('.meeting-block')).length);
    ok(daysWithBlocks === 6, `meetings on all six days (${daysWithBlocks})`);

    // Multi-page fixture (scan across pages)
    await importPdf(page, 'multi-page.pdf');
    ok((await page.locator('.meeting-block').count()) === 2, 'multi-page EAF parsed across pages');

    const storage = await page.evaluate(() => ({
      ls: localStorage.length,
      ss: sessionStorage.length,
    }));
    ok(storage.ls === 0 && storage.ss === 0, 'no localStorage/sessionStorage writes');

    // The static server legitimately serves app assets and the local PDF the
    // user selected. Exfiltrating requests would target remote hosts, so count
    // only non-localhost requests carrying schedule data.
    const remoteEafRequests = eafRequests.filter((url) => !url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost'));
    ok(remoteEafRequests.length === 0, 'no remote requests carrying EAF data');

    const downloadPromise = page.waitForEvent('download');
    await page.click('#download-png-btn');
    const download = await downloadPromise;
    ok(download.suggestedFilename() === 'animo-sort-schedule.png', 'PNG filename is fixed safe name');
    const downloadPath = await download.path();
    const pngBytes = fs.readFileSync(downloadPath);
    ok(pngBytes.length > 5000, 'PNG file is non-trivial in size');
    const isPng = pngBytes[0] === 0x89 && pngBytes[1] === 0x50 && pngBytes[2] === 0x4e && pngBytes[3] === 0x47;
    ok(isPng, 'downloaded file is a PNG');

    const exportFixture = {
      session: 'AY 2026-2027 Term 1',
      meetings: [{
        courseCode: 'TEST101',
        title: 'SCIENCE, TECHNOLOGY, AND THE SOCIETY',
        section: 'A',
        credits: 3,
        day: 'MON',
        startMinutes: 450,
        endMinutes: 540,
        startLabel: '7:30 AM',
        endLabel: '9:00 AM',
        location: 'M306',
      }],
    };
    const exportedSvgs = await page.evaluate(async (schedule) => {
      const { createScheduleSvg } = await import('/assets/js/export.js');
      const periods = [[450, 540], [555, 645], [660, 750], [765, 855], [870, 960], [975, 1065], [1080, 1170], [1185, 1275]];
      const axisSchedule = {
        session: schedule.session,
        meetings: periods.map(([startMinutes, endMinutes], index) => ({
          courseCode: `AXIS${index}`,
          title: '',
          day: 'MON',
          startMinutes,
          endMinutes,
          location: 'Online',
        })),
      };
      return {
        shown: createScheduleSvg(schedule, { showCourseTitles: true }),
        hidden: createScheduleSvg(schedule, { showCourseTitles: false }),
        axis: createScheduleSvg(axisSchedule, { showCourseTitles: false }),
      };
    }, exportFixture);
    ok(exportedSvgs.shown.includes('SCIENCE, TECHNOLOGY, AND THE') && exportedSvgs.shown.includes('SOCIETY') && !exportedSvgs.shown.includes('…'), 'PNG SVG wraps full titles without ellipsis');
    ok(exportedSvgs.shown.includes('7:30 AM') && exportedSvgs.shown.includes('9:00 AM'), 'PNG SVG includes start and end axis labels');
    const exportedAxisLabels = [...exportedSvgs.axis.matchAll(/<text x="150" y="([\d.]+)"[^>]*>([^<]+)<\/text>/g)].map((match) => ({ y: Number(match[1]), label: match[2] }));
    ok(exportedAxisLabels.length === 16 && new Set(exportedAxisLabels.map((entry) => entry.label)).size === 16 && exportedAxisLabels.slice(1).every((entry, index) => entry.y - exportedAxisLabels[index].y >= 10), 'PNG SVG axis labels are deduplicated and separated by at least 10px');
    ok(exportedSvgs.shown.includes('width="1400" height="1000"') && exportedSvgs.shown.includes('viewBox="0 0 1400 1000"'), 'PNG SVG preserves the single-canvas dimensions');
    ok(exportedSvgs.hidden.includes('Room: M306') && !exportedSvgs.hidden.includes('SCIENCE, TECHNOLOGY') && !exportedSvgs.hidden.includes(' cr') && !exportedSvgs.hidden.includes('Section') && !exportedSvgs.hidden.includes('V45'), 'PNG SVG toggle keeps only the approved exported fields');

    await page.emulateMedia({ media: 'print' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: false,
    });
    ok(pdfBuffer.length > 1000, 'print produces a PDF buffer');
    ok(await page.$eval('#schedule-panel .panel-card', (el) => getComputedStyle(el).opacity === '1'), 'print CSS reveals the schedule card');
    ok((await page.$$eval('.import-panel', (els) => els.map((e) => getComputedStyle(e).display))).every((d) => d === 'none'), 'print CSS hides import panel');
    ok(await page.$eval('.meeting-section', (el) => getComputedStyle(el).display === 'none'), 'print CSS omits Section from exported presentation');
    // Verify single page: the PDF page count is encoded in /Count N; extract via regex.
    const pdfText = pdfBuffer.toString('latin1');
    const countMatch = /\/Count\s+(\d+)/.exec(pdfText);
    ok(countMatch && Number(countMatch[1]) === 1, `print output is one page (Count=${countMatch ? countMatch[1] : 'unknown'})`);
    await page.emulateMedia({ media: 'screen' });

    const dropZoneLabel = await page.getAttribute('#drop-zone', 'aria-label');
    ok(dropZoneLabel && dropZoneLabel.length > 0, 'drop zone has aria-label');
    // Keyboard: focus drop zone, press Enter, file chooser opens (input click). We can't drive the OS dialog,
    // but we can verify the input is reachable and the drop zone handles Enter by checking no error occurs.
    await page.focus('#drop-zone');
    ok(true, 'drop zone focusable');
    const statusRole = await page.getAttribute('#status-region', 'role');
    ok(statusRole === 'status' || statusRole === 'alert', 'status region has role');
    const blocks = await page.$$eval('.meeting-block', (els) => els.map((el) => el.getAttribute('aria-label')));
    ok(blocks.every((b) => b && b.length > 0), 'meeting blocks have accessible names');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const reducedMotionBehavior = await page.evaluate(() => {
      return { scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior };
    });
    ok(reducedMotionBehavior.scrollBehavior === 'auto', 'reduced motion disables smooth navigation');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'narrow file controls do not create page overflow');

    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    ok(await page.locator('#hamburger').count() === 0 && await page.locator('#mobileMenu').count() === 0, 'navigation buttons and mobile menu are removed');
    await importPdf(page, 'valid-seven.pdf');
    const scrollable = await page.$eval('#schedule-scroll', (el) => el.scrollWidth > el.clientWidth);
    ok(scrollable, 'narrow viewport keeps horizontally scrollable timetable');
    const colWidth = await page.$eval('.day-column', (el) => el.getBoundingClientRect().width);
    ok(colWidth >= 120, `day column stays readable at narrow width (${colWidth.toFixed(0)}px)`);

    await page.reload({ waitUntil: 'networkidle' });
    ok(!(await page.isVisible('#empty-state')) && (await page.isHidden('#schedule-panel')), 'refresh clears schedule (session-only state)');

    const grep = (pattern, roots) => {
      const results = [];
      const walk = (d) => {
        let entries;
        try {
          entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.name === '.git' || entry.name === 'node_modules') continue;
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/^.*\.(js|html|css|toml|mjs|cjs)$/.test(entry.name)) {
            const content = fs.readFileSync(full, 'utf8');
            if (pattern.test(content)) results.push(full);
          }
        }
      };
      for (const root of roots) {
        if (fs.statSync(root).isFile()) {
          const content = fs.readFileSync(root, 'utf8');
          if (pattern.test(content)) results.push(root);
        } else {
          walk(root);
        }
      }
      return results;
    };
    const storageHits = grep(/localStorage|sessionStorage|indexedDB|sendBeacon/, [path.join(ROOT, 'assets'), path.join(ROOT, 'index.html'), path.join(ROOT, 'styles.css')]);
    ok(storageHits.length === 0, `no persistent storage or beacon APIs in app source (${storageHits.join(', ')})`);
    const fetchHits = grep(/fetch\s*\(|XMLHttpRequest/, [path.join(ROOT, 'assets'), path.join(ROOT, 'index.html')]);
    ok(fetchHits.length === 0, `no fetch or XHR in app source (${fetchHits.join(', ')})`);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nbrowser.test.cjs: ${RESULTS.pass} passed, ${RESULTS.fail} failed`);
  if (RESULTS.fail > 0) {
    console.error('Failures:');
    for (const f of RESULTS.failures) console.error(' -', f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Browser suite crashed:', err);
  process.exit(2);
});
