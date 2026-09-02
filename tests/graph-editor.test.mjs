import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const [editorSource, lua, readme, docs, example] = await Promise.all([
  readFile(new URL('../_extensions/jsxgraph/graph-editor.js', import.meta.url), 'utf8'),
  readFile(new URL('../_extensions/jsxgraph/lua/jsxgraph.lua', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../docs/graph-editor.md', import.meta.url), 'utf8'),
  readFile(new URL('../example.qmd', import.meta.url), 'utf8'),
]);

function fixture() {
  const container = {
    id: 'board',
    style: {},
    children: [],
    attributes: {},
    clientWidth: 800,
    clientHeight: 520,
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const events = {};
  const registrations = [];
  const board = {
    containerObj: container,
    canvasWidth: 800,
    canvasHeight: 520,
    getBoundingBox: () => [-5, 4, 5, -4],
    getMousePosition: (event) => [event.x, event.y],
    create(type, args, attributes) {
      if (type === 'point') {
        return {
          x: args[0],
          y: args[1],
          attributes,
          X() { return this.x; },
          Y() { return this.y; },
          setAttribute(next) { Object.assign(this.attributes, next); },
          hasPoint(x, y) {
            const ownX = (this.x + 5) / 10 * container.clientWidth;
            const ownY = (4 - this.y) / 8 * container.clientHeight;
            return (x - ownX) ** 2 + (y - ownY) ** 2 <= 100;
          },
        };
      }
      return {type, args, attributes};
    },
    on(name, handler) { events[name] = handler; },
    update() {},
    fullUpdate() {},
    resizeContainer(width, height) {
      this.canvasWidth = width;
      this.canvasHeight = height;
    },
    removeObject() {},
  };
  const element = () => ({
    style: {},
    children: [],
    textContent: '',
    setAttribute() {},
    appendChild(child) { this.children.push(child); },
    addEventListener() {},
  });
  const context = {
    document: {
      createElement: element,
      querySelector: () => container,
    },
    JXG: {
      JSXGraph: {initBoard: () => board},
      QuartoAssessment: {register: (spec) => registrations.push(spec)},
      Coords: function (_mode, screen) {
        this.usrCoords = [1, screen[0] / 10, screen[1] / 10];
      },
      COORDS_BY_SCREEN: 0,
    },
  };
  vm.createContext(context);
  vm.runInContext(editorSource, context);
  return {context, container, events, registrations};
}

test('graph editor creates, toggles, summarizes, and registers a graph', () => {
  const {context, container, events, registrations} = fixture();
  const editor = context.JXG.QuartoGraphEditor.createBoard();
  const first = editor.addVertex(-1.25, 0.5);
  const second = editor.addVertex(1.25, -0.5);

  assert.equal(editor.toggleEdge(first, second), true);
  assert.equal(editor.toggleEdge(first, second), false);
  assert.equal(editor.toggleEdge(first, second), true);

  const response = JSON.parse(JSON.stringify(editor.response()));
  assert.deepEqual(response, {
    representation: 'undirected-graph',
    nodes: [
      {id: 1, x: -1.25, y: 0.5},
      {id: 2, x: 1.25, y: -0.5},
    ],
    edges: [[1, 2]],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(editor.summarize())), {
    representation: 'undirected-graph',
    vertexCount: 2,
    edgeCount: 1,
    vertexIds: [1, 2],
    edges: [[1, 2]],
    degrees: [{vertex: 1, degree: 1}, {vertex: 2, degree: 1}],
    connected: true,
    componentCount: 1,
    components: [[1, 2]],
    isolatedVertices: [],
    cycleRank: 0,
  });

  editor.register();
  assert.equal(registrations.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(registrations[0].response())), response);
  assert.equal(container.attributes['data-graph-editor-ready'], 'true');
  assert.equal(typeof events.down, 'function');
  assert.equal(typeof events.up, 'function');
});

test('Lua embeds the editor and handles assessment and layout messages', () => {
  assert.match(lua, /GRAPH_EDITOR_JS = ioRead/);
  assert.match(lua, /assessment_bridge, GRAPH_EDITOR_JS, jsxgraph/);
  assert.match(lua, /message\.type !== 'request'/);
  assert.match(lua, /message\.type === 'layout'/);
  assert.match(lua, /board\.resizeContainer\(width, height\)/);
  assert.match(lua, /window\.addEventListener\('resize', scheduleBoardRefresh\)/);
  assert.match(lua, /src_jxg = 'https:\/\/cdn\.jsdelivr\.net/);
  assert.match(lua, /not options\.src_css:match\("\^http"\)/);
});

test('public APIs, protocol, asset behavior, and example are documented', () => {
  assert.match(readme, /JXG\.QuartoGraphEditor/);
  assert.match(readme, /## Asset loading/);
  assert.match(docs, /## Parent message protocol/);
  assert.match(docs, /### Layout notification/);
  assert.match(docs, /## Host responsibilities/);
  assert.match(docs, /## Graph response/);
  assert.match(example, /assessment_id="graph-assessment"/);
});
