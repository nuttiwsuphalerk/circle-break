#!/usr/bin/env node
/**
 * Build script for วงแตก (Circle Break) — static version.
 *
 * This replaces the job Google Apps Script's `include()` used to do at
 * request time: it stitches src/index.html together with every partial
 * it references, and writes one plain index.html to dist/. Cloudflare
 * Pages then just serves that file — no server-side logic involved.
 *
 * Usage:  node build.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const INCLUDE_PATTERN = /<\?!=\s*include\(['"]([^'"]+)['"]\)\s*\?>/g;

function readPartial(name) {
  const filePath = path.join(SRC, name + '.html');
  if (!fs.existsSync(filePath)) {
    throw new Error(`include('${name}') failed — no such file: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/** Resolves every <?!= include('x') ?> tag, including nested ones, in src/index.html. */
function resolveIncludes(html, depth = 0) {
  if (depth > 10) throw new Error('Include depth exceeded — check for a circular include()');
  if (!INCLUDE_PATTERN.test(html)) return html;
  const resolved = html.replace(INCLUDE_PATTERN, (_, name) => readPartial(name));
  return resolveIncludes(resolved, depth + 1);
}

function copyDirIfExists(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDirIfExists(s, d);
    else fs.copyFileSync(s, d);
  }
}

function build() {
  const entry = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
  const html = resolveIncludes(entry);

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf-8');

  // Copy any static assets (images, icons, etc.) straight through, if present.
  copyDirIfExists(path.join(SRC, 'assets'), path.join(DIST, 'assets'));

  // Copy root-level static files (ads.txt, robots.txt, favicon.ico, ...) as-is,
  // straight into the dist root — these MUST live at the domain root to work.
  copyDirIfExists(path.join(SRC, 'static'), DIST);

  console.log(`✅ Built dist/index.html (${(html.length / 1024).toFixed(1)} KB)`);
}

build();
