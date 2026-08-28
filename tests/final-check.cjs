// Final acceptance gate for the Animo Sort run.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');

let fails = 0;
const check = (cond, label) => {
  if (cond) console.log(`PASS: ${label}`);
  else { fails += 1; console.error(`FAIL: ${label}`); }
};

// Syntax
for (const f of ['assets/js/eaf-parser.js', 'assets/js/app.js', 'assets/js/export.js']) {
  try { execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' }); check(true, `syntax ${f}`); }
  catch { check(false, `syntax ${f}`); }
}

// Unit tests
try { execSync(`node "${path.join(ROOT, 'tests/parser.test.mjs')}"`, { stdio: 'pipe' }); check(true, 'parser unit tests'); }
catch { check(false, 'parser unit tests'); }
try { execSync(`node "${path.join(ROOT, 'tests/interval-checks.mjs')}"`, { stdio: 'pipe' }); check(true, 'interval checks'); }
catch { check(false, 'interval checks'); }

// Netlify static only
const netlify = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
check(netlify.includes('publish = "."'), 'netlify publish root');
check(!/functions|redirects|proxy/.test(netlify), 'netlify no functions/redirects/proxy');

// Vendored PDF.js
for (const f of ['vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs', 'vendor/pdfjs/legacy/build/pdf.mjs', 'vendor/pdfjs/LICENSE']) {
  check(fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).size > 0, `vendored ${f}`);
}

// No storage/network in app source
const appFiles = ['assets/js/eaf-parser.js', 'assets/js/app.js', 'assets/js/export.js', 'index.html'];
for (const f of appFiles) {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  check(!/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\s*\(|XMLHttpRequest/.test(content), `no storage/network APIs in ${f}`);
}

// No innerHTML with untrusted values
for (const f of ['assets/js/app.js', 'assets/js/export.js']) {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  check(!/innerHTML\s*=/.test(content), `no innerHTML assignment in ${f}`);
}

// No real identity in app/fixtures
const hygieneDirs = ['assets', 'index.html', 'styles.css', 'print.css', 'netlify.toml', 'tests/fixtures', 'vendor', 'package.json'];
let hygieneClean = true;
const scanFile = (full) => {
  if (/\.(js|mjs|html|css|toml|json)$/.test(full)) {
    const content = fs.readFileSync(full, 'utf8');
    if (/SISON|12320609|99,820/.test(content)) hygieneClean = false;
  }
};
for (const d of hygieneDirs) {
  const p = path.join(ROOT, d);
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isFile()) {
    scanFile(p);
    continue;
  }
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else scanFile(full);
    }
  };
  walk(p);
}
check(hygieneClean, 'no real identity/ID/fees in app, fixtures, vendor, config');

// One h1
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check((html.match(/<h1/g) || []).length === 1, 'exactly one h1');

// PNG filename and print css
const exportJs = fs.readFileSync(path.join(ROOT, 'assets/js/export.js'), 'utf8');
check(exportJs.includes('animo-sort-schedule.png'), 'fixed PNG filename');
const printCss = fs.readFileSync(path.join(ROOT, 'print.css'), 'utf8');
check(/@page/.test(printCss) && /landscape/.test(printCss), 'print @page landscape');

console.log(`\nfinal-check: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}`);
process.exit(fails === 0 ? 0 : 1);
