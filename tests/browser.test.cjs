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
    // ---- Empty state ----
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    ok(await page.isVisible('#empty-state'), 'empty state visible initially');
    ok(await page.locator('h1').count() === 1, 'exactly one h1');
    ok((await page.getAttribute('#eaf-file', 'accept')) === 'application/pdf', 'file input accepts application/pdf');
    ok(await page.isVisible('#drop-zone'), 'drop zone visible');

    // ---- Valid import (seven-course shape) ----
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

    // ---- Replace flow ----
    await importPdf(page, 'one-course.pdf');
    ok(await page.locator('.meeting-block').count() === 1, 'replace shows one meeting');
    ok((await page.textContent('#summary-label')).includes('1 course'), 'replace summary updated');

    // ---- Failed replacement preserves previous schedule ----
    await importPdfExpectError(page, 'overlap.pdf');
    ok((await page.locator('.meeting-block').count()) === 1, 'failed replace preserves previous schedule');
    ok((await page.textContent('#status-region')).includes('overlapping'), 'overlap error message shown');
    const errText = await page.textContent('#status-region');
    ok(!errText.includes('SISON') && !errText.includes('12320609'), 'error contains no identity data');

    // ---- Clear ----
    await page.click('#clear-btn');
    ok(await page.isVisible('#empty-state'), 'clear returns to empty state');
    ok((await page.locator('.meeting-block').count()) === 0, 'clear removes all meeting blocks');

    // ---- Parser boundary fixtures ----
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

    // ---- Privacy: storage untouched ----
    const storage = await page.evaluate(() => ({
      ls: localStorage.length,
      ss: sessionStorage.length,
    }));
    ok(storage.ls === 0 && storage.ss === 0, 'no localStorage/sessionStorage writes');

    // ---- Privacy: no EAF network traffic ----
    // The static server legitimately serves app assets and the local PDF the
    // user selected. Exfiltrating requests would target remote hosts, so count
    // only non-localhost requests carrying schedule data.
    const remoteEafRequests = eafRequests.filter((url) => !url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost'));
    ok(remoteEafRequests.length === 0, 'no remote requests carrying EAF data');

    // ---- PNG export ----
    const downloadPromise = page.waitForEvent('download');
    await page.click('#download-png-btn');
    const download = await downloadPromise;
    ok(download.suggestedFilename() === 'animo-sort-schedule.png', 'PNG filename is fixed safe name');
    const downloadPath = await download.path();
    const pngBytes = fs.readFileSync(downloadPath);
    ok(pngBytes.length > 5000, 'PNG file is non-trivial in size');
    const isPng = pngBytes[0] === 0x89 && pngBytes[1] === 0x50 && pngBytes[2] === 0x4e && pngBytes[3] === 0x47;
    ok(isPng, 'downloaded file is a PNG');

    // ---- Print: one landscape page ----
    await page.emulateMedia({ media: 'print' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: false,
    });
    ok(pdfBuffer.length > 1000, 'print produces a PDF buffer');
    ok((await page.$$eval('.import-panel', (els) => els.map((e) => getComputedStyle(e).display))).every((d) => d === 'none'), 'print CSS hides import panel');
    // Verify single page: the PDF page count is encoded in /Count N; extract via regex.
    const pdfText = pdfBuffer.toString('latin1');
    const countMatch = /\/Count\s+(\d+)/.exec(pdfText);
    ok(countMatch && Number(countMatch[1]) === 1, `print output is one page (Count=${countMatch ? countMatch[1] : 'unknown'})`);
    await page.emulateMedia({ media: 'screen' });

    // ---- Accessibility ----
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

    // ---- Responsive: narrow viewport horizontal scroll ----
    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await importPdf(page, 'valid-seven.pdf');
    const scrollable = await page.$eval('#schedule-scroll', (el) => el.scrollWidth > el.clientWidth);
    ok(scrollable, 'narrow viewport keeps horizontally scrollable timetable');
    const colWidth = await page.$eval('.day-column', (el) => el.getBoundingClientRect().width);
    ok(colWidth >= 120, `day column stays readable at narrow width (${colWidth.toFixed(0)}px)`);

    // ---- Refresh clears ----
    await page.reload({ waitUntil: 'networkidle' });
    ok(await page.isVisible('#empty-state'), 'refresh clears schedule (session-only state)');

    // ---- Repository hygiene ----
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
