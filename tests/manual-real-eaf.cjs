// Manual verification with the real ArcherHub EAF (never copied into repo).
// Run: PLAYWRIGHT_MODULE=... node tests/manual-real-eaf.cjs
const fs = require('fs');
const path = require('path');
const { startStaticServer, launchBrowser, ROOT } = require('./support/browser.cjs');

const REAL_EAF = process.env.REAL_EAF_PATH || require('path').join('/home/zen/Downloads', 'DLSU ' + 'ASSESSMENT FORM.pdf');

async function main() {
  if (!fs.existsSync(REAL_EAF)) {
    console.error(`Real EAF not found at ${REAL_EAF}`);
    process.exit(2);
  }
  const results = { pass: 0, fail: 0, failures: [] };
  const ok = (cond, label) => {
    if (cond) {
      results.pass += 1;
      console.log(`PASS: ${label}`);
    } else {
      results.fail += 1;
      results.failures.push(label);
      console.error(`FAIL: ${label}`);
    }
  };

  const { server, baseUrl } = await startStaticServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  const remoteRequests = [];
  page.on('request', (req) => {
    const url = req.url();
    // blob: URLs are in-browser local data (PNG export); not exfiltration.
    if (!url.startsWith(baseUrl) && !url.startsWith('blob:')) remoteRequests.push(url);
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.setInputFiles('#eaf-file', REAL_EAF);
    await page.waitForFunction(
      () => document.getElementById('schedule-panel') && !document.getElementById('schedule-panel').hidden,
      undefined,
      { timeout: 20000 }
    );
    await page.waitForFunction(() => !document.getElementById('eaf-file').disabled, undefined, { timeout: 20000 });

    const session = await page.textContent('#session-label');
    ok(session.includes('AY 2026-2027 Term 1'), `session rendered: ${session.trim()}`);

    const summary = await page.textContent('#summary-label');
    ok(/7 courses/.test(summary) && /14 meetings/.test(summary), `summary: ${summary.trim()}`);

    const blocks = await page.locator('.meeting-block').count();
    ok(blocks === 14, `14 meeting blocks rendered (got ${blocks})`);
    ok(await page.isChecked('#show-course-titles'), 'course names shown by default');
    ok(await page.$eval('.meeting-title', (el) => getComputedStyle(el).display !== 'none'), 'default course-name state renders titles');
    ok(await page.locator('.day-gridline.major').count() > 0 && await page.locator('.day-gridline.minor').count() > 0, 'major and minor timetable gridlines rendered');

    const domText = await page.textContent('#schedule-canvas');
    ok(!domText.includes('SISON'), 'DOM excludes student name');
    ok(!domText.includes('12320609'), 'DOM excludes student ID');
    ok(!domText.includes('99,820'), 'DOM excludes fees');
    ok(!domText.includes('08/26/2026'), 'DOM excludes enlistment date');
    ok(domText.includes('Room:') && domText.includes('Time:') && !domText.includes(' cr'), 'visible fields include room and time without credits');
    ok(await page.locator('.meeting-section').count() === 14, 'visible cards include Section after Course Code');
    ok(domText.includes('Miguel Hall'), 'mapped room expansion appears in the real EAF');
    ok(!domText.includes('M306, THU') || domText.includes('FINA101'), 'normalized course code present');

    await page.check('#show-course-titles');
    ok(await page.$eval('.meeting-title', (el) => getComputedStyle(el).display !== 'none'), 'course-name toggle reveals titles');
    await page.uncheck('#show-course-titles');

    // Verify actual parsed meetings include the paired pattern
    const monBlocks = await page.locator('.day-column[data-day="MON"] .meeting-block').count();
    const thuBlocks = await page.locator('.day-column[data-day="THU"] .meeting-block').count();
    ok(monBlocks === 3 && thuBlocks === 3, `MON/THU pair: ${monBlocks}/${thuBlocks}`);

    // Chronology: 7:30 AM meeting above 2:30 PM meeting on MON
    const tops = await page.$$eval('.day-column[data-day="MON"] .meeting-block', (els) =>
      els.map((el) => el.getBoundingClientRect().top).sort((a, b) => a - b)
    );
    ok(tops.length === 3 && tops[0] < tops[2], `MON blocks chronologically ordered (${tops.map((t) => t.toFixed(0)).join(',')})`);

    // PNG export
    const dlPromise = page.waitForEvent('download');
    await page.click('#download-png-btn');
    const dl = await dlPromise;
    ok(dl.suggestedFilename() === 'animo-sort-schedule.png', 'PNG filename fixed');

    // Print one page
    await page.emulateMedia({ media: 'print' });
    const pdfBuffer = await page.pdf({ format: 'Letter', landscape: true });
    const pdfText = pdfBuffer.toString('latin1');
    const countMatch = /\/Count\s+(\d+)/.exec(pdfText);
    ok(countMatch && Number(countMatch[1]) === 1, `print one page (Count=${countMatch ? countMatch[1] : 'unknown'})`);
    await page.emulateMedia({ media: 'screen' });

    ok(remoteRequests.length === 0, `no remote network requests (${remoteRequests.length})`);

    // Storage untouched
    const storage = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length }));
    ok(storage.ls === 0 && storage.ss === 0, 'no browser storage writes');

    // Real EAF not inside repo
    const inRepo = fs.existsSync(path.join(ROOT, 'tests/fixtures', 'DLSU ' + 'ASSESSMENT FORM.pdf')) ||
      fs.existsSync(path.join(ROOT, 'DLSU ' + 'ASSESSMENT FORM.pdf'));
    ok(!inRepo, 'real EAF not copied into repository');
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nmanual-real-eaf: ${results.pass} passed, ${results.fail} failed`);
  if (results.fail > 0) {
    for (const f of results.failures) console.error(' -', f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('manual-real-eaf crashed:', err);
  process.exit(2);
});
