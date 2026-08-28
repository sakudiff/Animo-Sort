// Playwright bootstrap for Animo Sort browser tests.
// Resolves the playwright module from env or a fallback path, and starts a
// local static server. CJS because the fallback playwright install is CJS.

const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROMIUM_EXECUTABLE = process.env.CHROMIUM_EXECUTABLE || '/home/zen/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

function resolvePlaywright() {
  const envPath = process.env.PLAYWRIGHT_MODULE;
  if (envPath) {
    // Accept either a package directory or a direct path to the package entry.
    const candidate = envPath.endsWith('.js') || envPath.endsWith('.cjs')
      ? envPath
      : path.join(envPath, 'index.js');
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }
  const candidates = [
    path.join(ROOT, 'node_modules', 'playwright'),
    '/home/zen/local code/AaronSison-Portfolio/node_modules/playwright',
    '/home/zen/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return require(candidate);
    }
  }
  throw new Error('Playwright module not found. Set PLAYWRIGHT_MODULE to a playwright install path.');
}

async function startStaticServer(port = 0) {
  const base = ROOT;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(base, pathname);
    if (!filePath.startsWith(base)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, {
        'Content-Type': types[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function launchBrowser() {
  const { chromium } = resolvePlaywright();
  return chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROMIUM_EXECUTABLE) ? CHROMIUM_EXECUTABLE : undefined,
  });
}

module.exports = { resolvePlaywright, startStaticServer, launchBrowser, ROOT, CHROMIUM_EXECUTABLE };
