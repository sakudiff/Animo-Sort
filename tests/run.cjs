#!/usr/bin/env node
// Runs the Animo Sort browser acceptance suite.

const { spawn } = require('child_process');
const path = require('path');

const testFile = path.join(__dirname, 'browser.test.cjs');
const child = spawn(process.execPath, [testFile], {
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
