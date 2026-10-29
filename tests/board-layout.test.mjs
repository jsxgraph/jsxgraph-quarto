// The generated iframe runs the board code inline and unchanged, sets
// window.BOARDID in the bridge script before it, and leaves resizing to
// JSXGraph's own resize observer (JSXGraph 1.14.2 or later, which also gives a
// board created while hidden its intended view). The bridge adds one thing,
// tested here with a small stand-in for JSXGraph's Board: a keepaspectratio
// board shows its whole view at any width (axis directions and zoom factors
// kept). It also warns when JSXGraph is older than 1.14.2. The real runtime
// is tested in upstream-runtime.browser.test.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const lua = await readFile(new URL('../_extensions/jsxgraph/lua/jsxgraph.lua', import.meta.url), 'utf8');

// The bridge script as the Lua filter writes it into the iframe.
function bridgeSource(assessmentId = 'a1', boardId = 'JXGbox') {
  const start = lua.indexOf('local assessment_bridge = string.format([[\n');
  const end = lua.indexOf('\n]], assessment_id, id)', start);
  assert.ok(start > 0 && end > start, 'bridge found in the Lua filter');
  let i = 0;
  return lua.slice(start + 'local assessment_bridge = string.format([[\n'.length, end)
    .replace(/%q/g, () => JSON.stringify([assessmentId, boardId][i++]))
    .replace(/%%/g, '%');
}

// Stand-in for JSXGraph's Board: initBoard fits a keepaspectratio box, as
// JSXGraph does; setBoundingBox with keepaspectratio keeps the vertical
// extent (JSXGraph's rule for a landscape container) and resets the zoom
// factors unless told 'keep'; resizeContainer re-applies the current box.
function setup(version = '1.14.2') {
  const warnings = [];
  class Board {
    constructor(w, h, attr) {
      Object.assign(this, {canvasWidth: w, canvasHeight: h, attr, keepaspectratio: !!attr.keepaspectratio,
        zoomX: 1, zoomY: 1, origin: {scrCoords: [1, attr.originx || 0, attr.originy || 0]}});
      if (attr.unitx) this.box = w > 0 ? [-attr.originx / attr.unitx, attr.originy / attr.unity, (w - attr.originx) / attr.unitx, (attr.originy - h) / attr.unity] : [NaN, NaN, NaN, NaN];
      else if (!(w > 0)) this.box = [NaN, NaN, NaN, NaN];
      else this.box = this.keepaspectratio ? initFit(attr.boundingbox, w, h) : attr.boundingbox.slice();
    }
  }
  Object.assign(Board.prototype, {
    setBoundingBox(box, keep, setZoom = 'reset') {
      if (setZoom === 'reset') this.zoomX = this.zoomY = 1;
      if (keep) {
        const uy = this.canvasHeight / (box[1] - box[3]), cx = (box[0] + box[2]) / 2, hw = this.canvasWidth / Math.abs(uy) / 2 * Math.sign(box[2] - box[0]);
        this.box = [cx - hw, box[1], cx + hw, box[3]];
      } else this.box = box.slice();
      this.keepaspectratio = !!keep;
      return this;
    },
    getBoundingBox() { return this.box.slice(); },
    resizeContainer(w, h, dontset, dontSetBoundingBox) {
      const box = this.getBoundingBox();
      this.canvasWidth = w; this.canvasHeight = h;
      if (!dontSetBoundingBox) this.setBoundingBox(box, this.keepaspectratio, 'keep');
      return this;
    },
    moveOrigin(x, y) { this.origin.scrCoords = [1, x, y]; return this; },
    // A board created hidden has no valid view; at the first size it is
    // initialised from the boundingbox attribute, then resized.
    updateContainerDims(w, h) {
      if (w === undefined) { w = this.containerObj.clientWidth; h = this.containerObj.clientHeight; }
      if (!(w > 0 && h > 0)) return this;
      if (Number.isNaN(this.box[0])) {
        const bb = this.attr.boundingbox;
        this.canvasWidth = w; this.canvasHeight = h;
        this.box = this.keepaspectratio ? initFit(bb, w, h) : bb.slice();
        this.origin.scrCoords = [1, w / 2, h / 2];
      }
      this.resizeContainer(w, h, true);
      return this;
    },
  });
  function initFit(box, w, h) {
    const s = Math.min(w / Math.abs(box[2] - box[0]), h / Math.abs(box[1] - box[3]));
    const hx = Math.sign(box[2] - box[0]) * w / (2 * s), hy = Math.sign(box[1] - box[3]) * h / (2 * s);
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    return [cx - hx, cy + hy, cx + hx, cy - hy];
  }
  const JXG = {boards: {}, Board, JSXGraph: {}, version};
  let n = 0;
  JXG.JSXGraph.initBoard = (id, attr) => {
    const container = context.__container;
    const lower = Object.fromEntries(Object.entries(attr).map(([k, v]) => [k.toLowerCase(), v]));  // as JSXGraph stores them
    const board = new Board(container.clientWidth, container.clientHeight, {resize: {enabled: true}, boundingbox: [-5, 5, 5, -5], ...lower});
    board.id = 'b' + n++; board.containerObj = container;
    JXG.boards[board.id] = board;
    return board;
  };
  const context = {
    JXG, console: {warn: (...a) => warnings.push(a)},
    document: {readyState: 'complete'},
    addEventListener() {},
    __container: {clientWidth: 0, clientHeight: 0},
  };
  context.window = context;
  context.parent = context;
  vm.createContext(context);
  vm.runInContext(bridgeSource(), context);
  return {
    context,
    warnings,
    board(code) { return vm.runInContext(code, context); },
    // The iframe gets a new size: JSXGraph's resize observer runs.
    resize(w, h) {
      context.__container.clientWidth = w; context.__container.clientHeight = h;
      for (const b of Object.values(JXG.boards)) b.updateContainerDims(w, h);
    },
  };
}
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const contains = (o, i) => o[0] <= i[0] + 1e-9 && o[1] >= i[1] - 1e-9 && o[2] >= i[2] - 1e-9 && o[3] <= i[3] + 1e-9;

test('the board code is inserted unchanged; BOARDID comes from the bridge script', () => {
  assert.doesNotMatch(lua, /use strict%2/, 'no rewriting around a use strict directive');
  assert.match(lua, /window\.BOARDID = %q;/);
  assert.match(lua, /<script>%s<\/script>\n<script>%s<\/script>\n<script>%s<\/script>\n<\/body>/, 'bridge, editor, board code: separate scripts');
  const page = setup();
  page.context.__container.clientWidth = 600; page.context.__container.clientHeight = 300;
  page.board("// a comment first\n'use strict';\nwindow.strict = (function () { return this === undefined; })();\nwindow.id = BOARDID;");
  assert.equal(page.context.strict, true, 'strict mode kept after a leading comment');
  assert.equal(page.context.id, 'JXGbox');
});

test("JSXGraph's resize observer stays on; no fixed pixel size, no own resize refresh", () => {
  assert.doesNotMatch(lua, /resize\.enabled = false/);
  assert.doesNotMatch(lua, /resizeContainer\(width, height\)/);
  assert.doesNotMatch(lua, /refreshBoards/);
  assert.doesNotMatch(lua, /board\.updateContainerDims = /);
});

test('the default script and CSS are exactly the bundled release, JSXGraph 1.14.2', () => {
  assert.match(lua, /src_jxg = 'https:\/\/cdn\.jsdelivr\.net\/npm\/jsxgraph@1\.14\.2\/distrib\/jsxgraphcore\.js'/);
  assert.match(lua, /src_css = 'https:\/\/cdn\.jsdelivr\.net\/npm\/jsxgraph@1\.14\.2\/distrib\/jsxgraph\.css'/);
});

test('a JSXGraph older than 1.14.2 gets one console warning; 1.14.2 and later get none', () => {
  for (const old of ['1.14.1', '1.14.0', '1.13.3', '1.2.3']) {
    const page = setup(old);
    assert.equal(page.warnings.length, 1, old);
    assert.match(page.warnings[0][0], /requires JSXGraph 1\.14\.2 or later; this page loads /);
  }
  for (const ok of ['1.14.2', '1.14.2-dev', '1.15.0', '2.0.0']) assert.equal(setup(ok).warnings.length, 0, ok);
});

test('a keepaspectratio board shows its whole box when narrowed, and the same view when widened', () => {
  const page = setup();
  page.context.__container.clientWidth = 600; page.context.__container.clientHeight = 150;
  const b = page.board("JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [0, 6, 14, 0], keepaspectratio: true})");
  const wide = b.getBoundingBox();
  page.resize(273, 150);
  assert.ok(contains(b.getBoundingBox(), [0, 6, 14, 0]), 'whole box at 273 px: ' + b.getBoundingBox());
  page.resize(600, 150);
  assert.ok(near(b.getBoundingBox(), wide));
});

test('fit keeps the direction of an inverted axis', () => {
  const page = setup();
  page.context.__container.clientWidth = 600; page.context.__container.clientHeight = 150;
  const b = page.board("JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [0, -3, 14, 3], keepaspectratio: true})");
  page.resize(390, 150);
  const box = b.getBoundingBox();
  assert.ok(box[0] < box[2], 'x not mirrored: ' + box);
  assert.ok(box[1] < box[3], 'y still points down: ' + box);
  assert.ok(box[0] <= 0 && box[2] >= 14 && box[1] <= -3 && box[3] >= 3, 'whole box: ' + box);
});

test("a user's zoom survives narrowing and widening, zoom factors included", () => {
  const page = setup();
  page.context.__container.clientWidth = 600; page.context.__container.clientHeight = 150;
  const b = page.board("JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [0, 6, 14, 0], keepaspectratio: true})");
  b.zoomX = b.zoomY = 1.5625;                          // as JSXGraph's zoomIn does
  b.setBoundingBox([4, 4, 12, 2], true, 'update');
  const zoomed = b.getBoundingBox();
  page.resize(273, 150);
  assert.ok(contains(b.getBoundingBox(), [4, 4, 12, 2]));
  page.resize(600, 150);
  assert.ok(near(b.getBoundingBox(), zoomed), 'view after the round trip: ' + b.getBoundingBox());
  assert.equal(b.zoomX, 1.5625);
  assert.equal(b.zoomY, 1.5625);
});

test('a keepaspectratio board created while hidden shows its whole box when shown and when narrowed', () => {
  const page = setup();
  const keep = page.board("JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [0, 6, 14, 0], keepaspectratio: true})");
  page.resize(600, 300);
  assert.ok(contains(keep.getBoundingBox(), [0, 6, 14, 0]));
  page.resize(273, 150);
  assert.ok(contains(keep.getBoundingBox(), [0, 6, 14, 0]), 'whole box when narrow');
});

test("the home button (zoom100's call) shows the whole initial box on a narrow board", () => {
  const page = setup();
  page.context.__container.clientWidth = 600; page.context.__container.clientHeight = 150;
  const b = page.board("JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [0, 6, 14, 0], keepaspectratio: true})");
  page.resize(273, 150);
  b.zoomX = b.zoomY = 1.5625;
  b.setBoundingBox([4, 4, 12, 2], true, 'update');
  b.setBoundingBox(b.attr.boundingbox, b.keepaspectratio, 'reset');  // what JSXGraph's zoom100 calls
  assert.ok(contains(b.getBoundingBox(), [0, 6, 14, 0]), 'whole box: ' + b.getBoundingBox());
  assert.equal(b.zoomX, 1);
  assert.equal(b.keepaspectratio, true);
  b.setBoundingBox([0, 6, 14, 0], true, 'reset');  // a copy from board code keeps JSXGraph's rule
  assert.ok(!contains(b.getBoundingBox(), [0, 6, 14, 0]), 'board code decides: ' + b.getBoundingBox());
});

test('boards without keepaspectratio, or set up with units, are left to JSXGraph', () => {
  const page = setup();
  page.context.__container.clientWidth = 600; page.context.__container.clientHeight = 300;
  const proto = page.context.JXG.Board.prototype;
  const plain = page.board("JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [0, 4, 4, 0]})");
  const units = page.board("JXG.JSXGraph.initBoard(BOARDID, {originX: 50, originY: 120, unitX: 30, unitY: 20, keepaspectratio: true})");
  for (const board of [plain, units]) {
    assert.equal(board.setBoundingBox, proto.setBoundingBox);
    assert.equal(board.resizeContainer, proto.resizeContainer);
  }
});
