// Exercise the actual Quarto-generated opaque iframe, including its CSS and
// bridge, rather than copying the runtime or refresh logic into a test page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPlaywright } from './support/browser.mjs';
import { cleanup, findQuarto, renderProject } from './support/render.mjs';

const quarto = findQuarto();
const playwright = await loadPlaywright();
const missing = !quarto ? 'Quarto unavailable' : !playwright ? 'Playwright unavailable' : false;
for (const engine of (process.env.JXG_TEST_BROWSERS || 'chromium').split(',')) {
  test('rendered iframe follows repeated narrowing, widening and hiding in ' + engine, { skip: missing }, async () => {
    const rendered = renderProject({ quarto, doc: 'a.qmd', files: { 'a.qmd': `---
filters: [jsxgraph]
jsxgraph:
  src_jxg: bundled
  src_css: bundled
  src_mjx: data:text/javascript,
---

~~~{.jsxgraph unit="%" width="100" height="33.3333333333333"}
window.board = JXG.JSXGraph.initBoard(BOARDID, {
  boundingbox: [0, 6, 14, 0], keepaspectratio: true,
  axis: true, showCopyright: false, showNavigation: true
});
board.create('point', [7, 3]);
~~~
` } });
    let browser;
    try {
      assert.equal(rendered.status, 0, rendered.stderr);
      assert.equal(rendered.frames.length, 1);
      browser = await playwright[engine].launch({ headless: true,
        ...(engine === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<div id="holder" style="width:600px">' + rendered.frames[0].element + '</div>');
      // The extension's percentage-width frame uses an aspect ratio. Fix its
      // height here to also catch stale canvas heights when the parent resizes.
      await page.locator('iframe').evaluate(frame => { frame.style.height = '200px'; });
      assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
      const frame = page.frames().find(f => f.parentFrame() === page.mainFrame());
      await frame.waitForFunction(() => window.board && board.canvasWidth === 600);
      for (const width of [273, 800, 190, 600, 273, 800, 600]) {
        await page.locator('#holder').evaluate((holder, w) => { holder.style.width = w + 'px'; }, width);
        await frame.waitForFunction(w => board.canvasWidth === w && board.canvasHeight === 200, width);
        const state = await frame.evaluate(() => ({
          box: board.getBoundingBox(), size: [board.containerObj.clientWidth, board.containerObj.clientHeight],
          style: [board.containerObj.style.width, board.containerObj.style.height],
          overflow: [getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow],
          scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
          svg: [board.renderer.svgRoot.getAttribute('width'), board.renderer.svgRoot.getAttribute('height')]
        }));
        assert.deepEqual(state.size, [width, 200]);
        assert.deepEqual(state.style, ['100%', '100%'], 'no stale fixed container dimensions');
        assert.deepEqual(state.overflow, ['hidden', 'hidden']);
        assert.deepEqual(state.scroll, [width, 200], 'no iframe scrollbar overflow');
        assert.deepEqual(state.svg.map(Number), [width, 200]);
        assert.ok(state.box[0] <= 1e-8 && state.box[1] >= 6 - 1e-8 && state.box[2] >= 14 - 1e-8 && state.box[3] <= 1e-8, 'whole requested box: ' + state.box);
      }
      await page.locator('#holder').evaluate(holder => { holder.style.display = 'none'; holder.style.width = '273px'; });
      // Leave enough time for an observer delivery while hidden before showing.
      await page.waitForTimeout(100);
      await page.locator('#holder').evaluate(holder => { holder.style.display = ''; });
      await frame.waitForFunction(() => board.canvasWidth === 273 && board.canvasHeight === 200);
      await frame.evaluate(() => { board.zoomIn(); board.zoomIn(); });
      await frame.locator('[id$="_navigation_100"]').click();
      const box = await frame.evaluate(() => board.getBoundingBox());
      assert.ok(box[0] <= 1e-8 && box[1] >= 6 - 1e-8 && box[2] >= 14 - 1e-8 && box[3] <= 1e-8, 'home fits the whole box');
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      cleanup(rendered.dir);
    }
  });
}
