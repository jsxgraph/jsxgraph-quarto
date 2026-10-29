// Helpers for the browser tests of src_mjx_preload.
//
// Prerequisites (the tests skip with a message when one is missing):
//   - Quarto (QUARTO, or `quarto` on the PATH), to render the board frames
//   - Playwright with browsers installed: `playwright` resolvable from this
//     folder, or JXG_TEST_PLAYWRIGHT = path or module name of it
//   - MathJax 4 from npm, e.g. `npm install --no-save mathjax@4.1.3`: set
//     MATHJAX_DIR to the installed package folder (node_modules/mathjax)
//   - JXG_TEST_BROWSERS = comma separated chromium, firefox, webkit (default: chromium)
//   - CHROMIUM_EXECUTABLE optionally selects a locally installed Chromium
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cleanup } from './render.mjs';

export async function loadPlaywright() {
  const spec = process.env.JXG_TEST_PLAYWRIGHT || 'playwright';
  try {
    return await import(spec.startsWith('/') ? pathToFileURL(spec).href : spec);
  } catch (error) {
    return null;
  }
}

// MathJax package folder and its version, or null
export function findMathJax() {
  const dir = process.env.MATHJAX_DIR;
  if (!dir || !existsSync(join(dir, 'tex-mml-svg.js'))) return null;
  try {
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
    return { dir: resolve(dir), version };
  } catch { return null; }
}

// CTM's canonical MathJax adaptor, used here only as an external test fixture
// (fetched at test time, never stored in this repository; the hash is checked).
export const CTM = {
  repository: 'https://github.com/Erasmus-CTM/ctm-libs.git',
  commit: '62235ae386da9ce591d956caae3b54aa7da9785d',
  path: '_extensions/ctm-libs/runtime/mathjax-opaque-adaptor.js',
  sha256: '81642e45028f35eab27b7be2cbce427efb9395799b9e335e834c667315fd5b61'
};

// Buffer of the fixture, or {error} if it cannot be fetched (the test is then skipped).
// A file named explicitly by CTM_OPAQUE_ADAPTOR that is unreadable or whose SHA-256
// differs is an error that fails the tests, not a skip.
export function fetchCtmAdaptor() {
  let bytes;
  if (process.env.CTM_OPAQUE_ADAPTOR) {
    bytes = readFileSync(process.env.CTM_OPAQUE_ADAPTOR);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== CTM.sha256) throw new Error('CTM_OPAQUE_ADAPTOR has SHA-256 ' + sha256 + ', expected ' + CTM.sha256);
    return { bytes };
  }
  const dir = mkdtempSync(join(tmpdir(), 'jsxgraph-ctm-'));
  try {
    const run = (args) => spawnSync('git', args, { cwd: dir, encoding: 'buffer', maxBuffer: 1 << 26 });
    if (run(['init', '-q']).status !== 0) return { error: 'git init failed' };
    const fetch = run(['fetch', '-q', '--depth', '1', CTM.repository, CTM.commit]);
    if (fetch.status !== 0) return { error: 'git fetch of ' + CTM.repository + ' failed: ' + fetch.stderr.toString().trim() };
    const show = run(['show', 'FETCH_HEAD:' + CTM.path]);
    if (show.status !== 0) return { error: 'git show failed: ' + show.stderr.toString().trim() };
    bytes = show.stdout;
  } finally { cleanup(dir); }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== CTM.sha256) return { error: 'SHA-256 mismatch: ' + sha256 };
  return { bytes };
}

const TYPES = { '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.css': 'text/css' };

// Resource headers that let the isolated parent (COEP require-corp) and the
// opaque frame inside it use the files; the MathJax files also need CORS for
// fetch() (speech rules) and importScripts in the worker.
export const SHARED = { 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' };

// Static files of a folder under a URL prefix; returns a handler(request, response) => boolean
export function staticFiles(prefix, root) {
  const base = resolve(root);
  return (request, response) => {
    const url = new URL(request.url, 'http://x');
    if (!url.pathname.startsWith(prefix)) return false;
    const file = resolve(base, './' + decodeURIComponent(url.pathname.slice(prefix.length)));
    if (file !== base && !file.startsWith(base + sep)) { response.writeHead(403).end(); return true; }
    if (!existsSync(file)) { response.writeHead(404).end(); return true; }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', ...SHARED });
    response.end(readFileSync(file));
    return true;
  };
}

// Runs in every frame before its scripts. Test harness only: the shipped frame is not
// changed. Records what the original MathJax script's own load event observes, and
// how workers are created.
export function installHarness() {
  const workers = [];
  Object.defineProperty(self, '__workers', { value: workers });
  const NativeWorker = self.Worker;
  if (NativeWorker) {
    self.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        workers.push({ scheme: String(args[0]).slice(0, String(args[0]).indexOf(':') + 1), at: performance.now() });
        return Reflect.construct(target, args, newTarget);
      }
    });
  }
  document.addEventListener('load', (event) => {
    const element = event.target;
    if (element && element.id === 'MathJax-script') {
      self.__nativeLoader = {
        src: element.src,
        version: self.MathJax && self.MathJax.version,
        readyMethod: typeof (self.MathJax && self.MathJax.startup && self.MathJax.startup.defaultReady),
        at: performance.now()
      };
    }
  }, true);
}

export async function withinDeadline(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timed out')), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

