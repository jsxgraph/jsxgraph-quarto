// The src_mjx_preload option in real browsers, with real MathJax.
//
// The board frame is rendered with Quarto, then loaded as the iframe the
// extension writes (sandbox="allow-scripts", src a data: URL, so an opaque
// origin) inside a parent page that is cross-origin isolated (COOP/COEP). MathJax
// 4 is served from a local HTTP server as a custom, linked src_mjx.
//
// Cases per browser (MathJax 4.1.3 exactly):
//  - control, no option: no element is added; reports what native MathJax does here
//  - pre-loader as a local file (embedded) and as a linked URL, speech and braille
//    switched off: the pre-loader ran in the frame's head before MathJax existed and
//    before it started; the original MathJax script keeps its attributes and its own
//    load event sees the MathJax version and startup.defaultReady; the pre-loader's
//    MathJax configuration is used; SVG output; no worker; no page error, console
//    error or failed request. These cases assert no speech or braille.
//  - pre-loader that leaves speech and braille on: they are produced. Runs only where
//    the control found native MathJax speech working (Chromium and Firefox in the
//    tested setup); skipped by design in WebKit.
//  - CTM's MathJax adaptor as pre-loader: speech and braille in all browsers, from a
//    worker made from a data: URL. This is an external fixture: a hash-pinned script
//    of Erasmus-CTM/ctm-libs, fetched over the network at test time (or taken from
//    CTM_OPAQUE_ADAPTOR), never stored here; the case is skipped when unavailable.
//
// Prerequisites: see tests/support/browser.mjs (Quarto, Playwright with browsers,
// MATHJAX_DIR, JXG_TEST_BROWSERS). Without them the tests are skipped with a
// message. Example:
//   MATHJAX_DIR=$PWD/node_modules/mathjax JXG_TEST_BROWSERS=chromium \
//     node --test tests/mathjax-preload.browser.test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { fetchCtmAdaptor, findMathJax, installHarness, loadPlaywright, SHARED, staticFiles, withinDeadline } from './support/browser.mjs';
import { cleanup, findQuarto, renderProject } from './support/render.mjs';
import { dirname, basename } from 'node:path';

const EXPECTED_SPEECH = 'x squared plus 1';
const EXPECTED_BRAILLE = '⠭⠘⠆⠐⠬⠂'; // x^2+1

const quarto = findQuarto();
const playwright = await loadPlaywright();
const EXPECTED_MATHJAX_VERSION = '4.1.3';
const mathjax = findMathJax();
const browserNames = (process.env.JXG_TEST_BROWSERS || 'chromium').split(',').map((s) => s.trim()).filter(Boolean);
const missing = !quarto ? 'Quarto not found (set QUARTO or put quarto on the PATH)'
  : !playwright ? 'Playwright not found (install it, or set JXG_TEST_PLAYWRIGHT)'
  : !mathjax ? 'MathJax not found (npm install mathjax@4.1.3 and set MATHJAX_DIR to node_modules/mathjax)'
  : null;

// The test-owned generic pre-loader: records what the page looks like when it runs, and
// configures MathJax: a marker option, a startup.ready hook that records its time and, if
// speech is false, speech and braille off (so no MathJax worker is needed, which is what
// keeps this pre-loader independent of how a browser treats workers in opaque frames).
const probePreload = (speech) => `(function () {
  window.__preload = { at: performance.now(), typeofMathJax: typeof MathJax, scripts: document.scripts.length };
  window.MathJax = {
    jxgPreloadMarker: 'configured',
    ${speech ? '' : 'options: { enableSpeech: false, enableBraille: false, menuOptions: { settings: { speech: false, braille: false } } },'}
    startup: { ready: function () {
      window.__preload.readyAt = performance.now();
      window.__preload.readyVersion = MathJax.version;
      return MathJax.startup.defaultReady();
    } }
  };
})();
`;
const PROBE_PRELOAD = probePreload(false);

const BOARD = String.raw`var board = JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [-5, 5, 5, -5], axis: true});
var label = board.create('text', [-3, 3, '\\(x^2+1\\)'], {useMathJax: true, fontSize: 20});
// MathJax is loaded asynchronously: have the board typeset its text once MathJax is ready
window.addEventListener('load', function () { MathJax.startup.promise.then(function () { label.needsUpdate = true; board.update(); }); });`;

async function defineTests() {
  const ctm = fetchCtmAdaptor();
  const server = http.createServer((request, response) => {
    if (staticFiles('/node_modules/' + basename(mathjax.dir) + '/', mathjax.dir)(request, response)) return;
    if (staticFiles('/node_modules/@mathjax/', dirname(mathjax.dir) + '/@mathjax')(request, response)) return;
    if (request.url === '/probe-preload.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', ...SHARED });
      response.end(PROBE_PRELOAD);
      return;
    }
    const match = request.url.match(/^\/case\/([\w-]+)$/);
    const item = match && cases[match[1]];
    if (!item) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' });
    response.end('<!doctype html><meta charset="utf-8"><title>' + match[1] + '</title>' + item.frame.element);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const mathjaxUrl = origin + '/node_modules/' + basename(mathjax.dir) + '/tex-mml-svg.js';

  // One rendered document per case: custom linked src_mjx; the bundled JSXGraph (any
  // value that is not an http(s) URL selects the copy shipped with the extension).
  const rendered = [];
  function renderCase(name, meta, extraFiles = {}) {
    const text = ['---', 'title: ' + name, 'filters: [jsxgraph]', 'jsxgraph:', '  src_jxg: bundled', '  src_css: bundled',
      '  src_mjx: ' + mathjaxUrl, ...meta.map((line) => '  ' + line), '---', '', '```{.jsxgraph}', BOARD, '```', ''].join('\n');
    const r = renderProject({ quarto, files: { 'a.qmd': text, ...extraFiles }, doc: 'a.qmd' });
    rendered.push(r.dir);
    assert.equal(r.status, 0, name + ': ' + r.stderr);
    assert.equal(r.frames.length, 1);
    return r.frames[0];
  }
  const cases = {
    control: { frame: renderCase('control', []) },
    embedded: { frame: renderCase('embedded', ['src_mjx_preload: probe-preload.js'], { 'probe-preload.js': PROBE_PRELOAD }) },
    linked: { frame: renderCase('linked', ['src_mjx_preload: ' + origin + '/probe-preload.js']) },
    'embedded-speech': { frame: renderCase('embedded-speech', ['src_mjx_preload: probe-preload.js'], { 'probe-preload.js': probePreload(true) }) }
  };
  if (!ctm.error) {
    cases['ctm-adaptor'] = { frame: renderCase('ctm-adaptor', ['src_mjx_preload: mathjax-opaque-adaptor.js'], { 'mathjax-opaque-adaptor.js': ctm.bytes }) };
  }

  async function run(engine, name, { startupTimeout = 60000, tolerateStall = false } = {}) {
    const browser = await playwright[engine].launch({ headless: true,
      ...(engine === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    await context.addInitScript(installHarness);
    const page = await context.newPage();
    const result = { errors: [], consoleErrors: [], failedRequests: [], badResponses: [] };
    page.on('pageerror', (error) => result.errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    page.on('requestfailed', (request) => result.failedRequests.push(request.url().slice(0, 120) + ' ' + (request.failure() || {}).errorText));
    page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(response.status() + ' ' + response.url().slice(0, 120)); });
    if (process.env.JXG_TEST_DEBUG) {
      page.on('console', (m) => console.error('[console]', m.type(), m.text().slice(0, 300)));
      page.on('requestfailed', (q) => console.error('[requestfailed]', q.url().slice(0, 150), q.failure()));
      page.on('response', (q) => console.error('[response]', q.status(), q.url().slice(0, 150)));
    }
    try {
      await page.goto(origin + '/case/' + name, { waitUntil: 'domcontentloaded' });
      result.topIsolated = await page.evaluate(() => crossOriginIsolated);
      const frame = page.frames().find((f) => f.parentFrame() === page.mainFrame());
      result.sandbox = await page.evaluate(() => document.querySelector('iframe').getAttribute('sandbox'));
      result.srcScheme = await page.evaluate(() => document.querySelector('iframe').getAttribute('src').slice(0, 22));
      // What the frame's head looks like, before MathJax has started
      await frame.waitForFunction(() => !!document.getElementById('MathJax-script'), null, { timeout: 30000 });
      result.dom = await frame.evaluate(() => {
        const mj = document.getElementById('MathJax-script');
        const before = mj.previousElementSibling;
        return {
          mathjaxAttributes: [...mj.attributes].map((a) => a.name).sort(),
          previousTag: before && before.tagName,
          previousAttributes: before ? [...before.attributes].map((a) => a.name).sort() : null,
          previousSrcScheme: before && before.getAttribute('src') ? before.getAttribute('src').slice(0, 5) : null,
          inHead: before ? before.parentElement.tagName : null,
          scriptsBeforeMathJax: [...document.scripts].indexOf(mj)
        };
      });
      try {
        await frame.waitForFunction(() => !!(window.MathJax && MathJax.startup && MathJax.startup.promise), null, { timeout: startupTimeout });
        await withinDeadline(frame.evaluate(() => MathJax.startup.promise), startupTimeout, 'MathJax startup');
        await frame.waitForFunction(() => Object.keys(window.JXG && JXG.boards || {}).length > 0, null, { timeout: 30000 });
      } catch (error) {
        if (!tolerateStall) throw error;
        result.stalled = error.message.split('\n')[0];
      }
      if (!result.stalled) try {
        result.renderer = await withinDeadline(frame.evaluate(async () => {
          const node = await MathJax.tex2svgPromise('x^2+1');
          const svg = node.querySelector('svg');
          return { svg: !!svg, glyphs: svg ? svg.querySelectorAll('path,use').length : 0,
            speech: node.getAttribute('data-semantic-speech-none'), braille: node.getAttribute('data-semantic-braille') };
        }), 30000, 'MathJax SVG');
      } catch (error) { result.renderer = { svg: false, error: error.message }; }
      // The board's own MathJax text, typeset by JSXGraph through the page's MathJax
      if (!result.stalled) try {
        await frame.waitForFunction(() => document.querySelector('.jxgbox mjx-container svg, .jxgbox svg mjx-container, .jxgbox mjx-container'), null, { timeout: 15000 });
        result.boardMath = true;
      } catch { result.boardMath = false; }
      result.state = await frame.evaluate(() => ({
        origin: self.origin, preload: window.__preload || null, nativeLoader: window.__nativeLoader || null,
        marker: window.MathJax && MathJax.config && MathJax.config.jxgPreloadMarker, workers: window.__workers.slice(),
        version: window.MathJax && MathJax.version,
        speechOptions: window.MathJax && MathJax.startup && MathJax.startup.document && MathJax.startup.document.options ? {
          enableSpeech: MathJax.startup.document.options.enableSpeech, enableBraille: MathJax.startup.document.options.enableBraille } : null
      }));
      await page.waitForTimeout(1500); // late errors
    } finally { await browser.close(); }
    return result;
  }

  for (const engine of browserNames) {
    const launchable = playwright[engine];
    const skip = launchable ? false : 'unknown browser ' + engine;
    const common = (r) => {
      assert.equal(r.topIsolated, true, 'parent page is cross-origin isolated');
      assert.equal(r.sandbox, 'allow-scripts');
      assert.equal(r.srcScheme, 'data:text/html;base64,');
      assert.equal(r.state.origin, 'null', 'frame has an opaque origin');
      assert.equal(r.renderer.svg, true, 'actual SVG output: ' + r.renderer.error);
      assert.ok(r.renderer.glyphs > 0, 'SVG has glyphs');
      assert.deepEqual(r.errors, [], 'no uncaught page errors');
      assert.deepEqual(r.consoleErrors, [], 'no console errors');
      assert.deepEqual(r.failedRequests, [], 'no failed requests');
      assert.deepEqual(r.badResponses, [], 'no HTTP error responses');
    };
    const assertNativeLoader = (r) => {
      assert.deepEqual({ src: r.state.nativeLoader.src, version: r.state.nativeLoader.version, readyMethod: r.state.nativeLoader.readyMethod },
        { src: mathjaxUrl, version: EXPECTED_MATHJAX_VERSION, readyMethod: 'function' }, 'the original script\'s own load event sees MathJax ' + EXPECTED_MATHJAX_VERSION);
      assert.deepEqual(r.dom.mathjaxAttributes, ['async', 'id', 'src'], 'MathJax script keeps id, async and src only');
    };
    const assertPreloaderPlaced = (r, scheme) => {
      assert.equal(r.dom.previousTag, 'SCRIPT', 'a script directly before the MathJax script');
      assert.equal(r.dom.inHead, 'HEAD');
      assert.deepEqual(r.dom.previousAttributes, ['src'], 'pre-loader has no async/defer/type');
      assert.equal(r.dom.previousSrcScheme, scheme);
      assert.equal(r.dom.scriptsBeforeMathJax, 1, 'exactly one pre-loader before MathJax');
    };

    // What MathJax does in an opaque frame in this browser without any pre-loader. Not a
    // requirement of the extension; it says whether the native speech worker can work here
    // (WebKit blocks it, and MathJax's SVG conversion then stalls).
    let native = null;
    test(engine + ': control without src_mjx_preload: no element is added; native MathJax in this browser (diagnostic)', { skip, timeout: 240000 }, async (t) => {
      const r = await run(engine, 'control', { startupTimeout: 25000, tolerateStall: true });
      native = !r.stalled && r.renderer && r.renderer.svg === true && r.renderer.speech === EXPECTED_SPEECH && r.renderer.braille === EXPECTED_BRAILLE;
      t.diagnostic(JSON.stringify({ engine, nativeWorks: native, stalled: r.stalled || false, renderer: r.renderer || null,
        errors: r.errors, consoleErrors: r.consoleErrors, failedRequests: r.failedRequests }));
      assert.equal(r.dom.scriptsBeforeMathJax, 0, 'no pre-loader element when the option is not set');
      assert.deepEqual(r.dom.mathjaxAttributes, ['async', 'id', 'src']);
      assert.equal(r.topIsolated, true);
      assert.equal(r.state.origin, 'null');
      assert.equal(r.state.preload, null);
    });

    for (const name of ['embedded', 'linked']) {
      test(engine + ': pre-loader from ' + (name === 'embedded' ? 'a local file (embedded)' : 'a URL (linked)') + ' runs before MathJax and configures it; SVG output, no worker', { skip, timeout: 240000 }, async () => {
        const r = await run(engine, name);
        common(r);
        assertPreloaderPlaced(r, name === 'embedded' ? 'data:' : 'http:');
        assertNativeLoader(r);
        const p = r.state.preload;
        assert.ok(p, 'the pre-loader ran');
        assert.equal(p.typeofMathJax, 'undefined', 'MathJax did not exist yet when the pre-loader ran');
        assert.ok(p.at < r.state.nativeLoader.at, 'pre-loader ran before the MathJax script finished loading');
        assert.ok(p.readyAt > p.at, 'startup.ready from the pre-loader\'s configuration ran, after the pre-loader');
        assert.equal(p.readyVersion, EXPECTED_MATHJAX_VERSION);
        assert.equal(r.state.marker, 'configured', 'MathJax uses the configuration set by the pre-loader');
        assert.deepEqual(r.state.speechOptions, { enableSpeech: false, enableBraille: false }, 'speech and braille options from the pre-loader are in effect');
        assert.deepEqual(r.state.workers, [], 'no speech worker is started');
        assert.ok(!r.renderer.speech && !r.renderer.braille, 'no speech or braille attached');
        assert.equal(r.boardMath, true, 'the board\'s own MathJax text is typeset');
      });
    }

    test(engine + ': pre-loader that leaves speech and braille on: strings are produced where native MathJax works in an opaque frame', { skip, timeout: 240000 }, async (t) => {
      if (native === null) { t.skip('control case did not run'); return; }
      if (!native) { t.skip('native MathJax speech did not work in ' + engine + ' in this setup (opaque frame in a cross-origin-isolated parent; see the control case); the adaptor case covers this browser'); return; }
      const r = await run(engine, 'embedded-speech');
      common(r);
      assertPreloaderPlaced(r, 'data:');
      assertNativeLoader(r);
      assert.equal(r.state.marker, 'configured');
      assert.equal(r.renderer.speech, EXPECTED_SPEECH);
      assert.equal(r.renderer.braille, EXPECTED_BRAILLE);
      assert.equal(r.boardMath, true);
    });

    test(engine + ': CTM adaptor as pre-loader (external fixture): worker transport, speech and braille in the opaque frame', { skip: skip || (ctm.error ? 'CTM adaptor not available: ' + ctm.error : false), timeout: 240000 }, async () => {
      const r = await run(engine, 'ctm-adaptor');
      common(r);
      assertPreloaderPlaced(r, 'data:');
      assertNativeLoader(r);
      assert.equal(r.renderer.speech, EXPECTED_SPEECH);
      assert.equal(r.renderer.braille, EXPECTED_BRAILLE);
      assert.equal(r.boardMath, true);
      assert.ok(r.state.workers.length >= 1 && r.state.workers.every((w) => w.scheme === 'data:'), 'speech worker created from a data: URL: ' + JSON.stringify(r.state.workers));
    });
  }

  test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    cleanup(...rendered);
  });
}

if (missing) {
  test('browser tests of src_mjx_preload', { skip: missing }, () => {});
} else if (mathjax.version !== EXPECTED_MATHJAX_VERSION) {
  test('MathJax version', () => {
    assert.fail('MATHJAX_DIR holds MathJax ' + mathjax.version + '; these tests are written for ' + EXPECTED_MATHJAX_VERSION + ' (npm install mathjax@' + EXPECTED_MATHJAX_VERSION + ')');
  });
} else {
  await defineTests();
}
