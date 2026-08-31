import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const diagramFiles = [
  'assets/animosort-workflow.html',
  'assets/animosort-workflow-mobile.html',
];

const siteFiles = [
  'index.html',
  'about.html',
  'how-to-use.html',
  'styles.css',
  'assets/js/calendar.js',
  ...diagramFiles,
];

function readSiteFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('diagram artifacts expose a staggered looping trace', () => {
  for (const path of diagramFiles) {
    const html = readSiteFile(path);
    assert.match(html, /<svg[^>]*data-animation="trace"/);
    assert.equal((html.match(/<path[^>]*data-animate="edge"/g) ?? []).length, 6);
    assert.equal((html.match(/<g id="node-[^"]+"[^>]*data-animate="node"/g) ?? []).length, 7);
    assert.match(html, /animation: archify-edge-flow 5\.4s linear infinite/);
    assert.match(html, /data-motion-hover="true"/);
  }
});

test('site source contains no em-dash punctuation', () => {
  const emDash = String.fromCodePoint(0x2014);
  for (const path of siteFiles) {
    assert.equal(readSiteFile(path).includes(emDash), false, path);
  }
});
