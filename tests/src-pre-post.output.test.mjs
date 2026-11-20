// The options src_jxg_pre, src_jxg_post, src_css_pre and src_css_post: what the
// filter writes into the board frame. Needs Quarto (see tests/support/render.mjs);
// skipped without it. Run with `node --test tests/src-pre-post.output.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanup, findQuarto, normalizeIds, renderProject } from './support/render.mjs';

const quarto = findQuarto();
const skip = quarto ? false : 'Quarto not found (set QUARTO or put quarto on the PATH)';

const BOARD = 'var board = JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [-5, 5, 5, -5]});';
const FILES = { 'pre.js': 'window.PRE = 1;', 'js/options.js': 'JXG.Options.text.fontSize = 33;', 'css/pre.css': '.pre{color:red}', 'post.css': '.post{color:blue}' };
const URLS = ['src_jxg: https://example.test/jxg.js', 'src_css: https://example.test/jxg.css'];

function qmd(meta, attrs = '') {
  return ['---', 'title: t', 'filters: [jsxgraph]', 'jsxgraph:', ...meta.map((line) => '  ' + line), '---', '',
    '```{.jsxgraph' + (attrs ? ' ' + attrs : '') + '}', BOARD, '```', ''].join('\n');
}
function render(meta, attrs) { return renderProject({ quarto, files: { ...FILES, 'a.qmd': qmd(meta, attrs) }, doc: 'a.qmd' }); }
const dataUrl = (mime, text) => 'data:' + mime + ';base64,' + Buffer.from(text).toString('base64');

test('files are embedded or linked in the documented order', { skip }, () => {
  const r = render([...URLS, 'src_jxg_pre: "pre.js https://example.test/p.js?a=1&b=2"', 'src_jxg_post: js/options.js',
    'src_css_pre: css/pre.css', 'src_css_post: post.css']);
  try {
    assert.equal(r.status, 0, r.stderr);
    const head = r.frames[0].html.slice(0, r.frames[0].html.indexOf('</head>'));
    const expected = [
      '<script id="MathJax-script"',
      '<script src="' + dataUrl('text/javascript', FILES['pre.js']) + '"></script>',
      '<script src="https://example.test/p.js?a=1&amp;b=2"></script>',
      '<script src="https://example.test/jxg.js"></script>',
      '<script src="' + dataUrl('text/javascript', FILES['js/options.js']) + '"></script>',
      '<link rel="stylesheet" href="' + dataUrl('text/css', FILES['css/pre.css']) + '">',
      '<style>@import url("https://example.test/jxg.css");</style>',
      '.jxgbox{border:none;',
      '<link rel="stylesheet" href="' + dataUrl('text/css', FILES['post.css']) + '">'
    ];
    let at = -1;
    for (const part of expected) {
      const next = head.indexOf(part, at + 1);
      assert.ok(next > at, 'in order: ' + part.slice(0, 60));
      at = next;
    }
  } finally { cleanup(r.dir); }
});

test('unset and empty options leave the frame unchanged; a block attribute replaces the document option', { skip }, () => {
  const none = render(URLS), empty = render([...URLS, 'src_jxg_pre: ""', 'src_css_post: "  "']);
  const off = render([...URLS, 'src_jxg_post: js/options.js'], 'src_jxg_post=""');
  const replaced = render([...URLS, 'src_jxg_post: js/options.js'], 'src_jxg_post="pre.js"');
  try {
    for (const r of [none, empty, off, replaced]) assert.equal(r.status, 0, r.stderr);
    assert.ok(!none.frames[0].html.includes('<link rel="stylesheet"'));
    assert.equal(normalizeIds(empty.frames[0].html), normalizeIds(none.frames[0].html));
    assert.equal(normalizeIds(off.frames[0].html), normalizeIds(none.frames[0].html));
    assert.ok(replaced.frames[0].html.includes(dataUrl('text/javascript', FILES['pre.js'])));
    assert.ok(!replaced.frames[0].html.includes(dataUrl('text/javascript', FILES['js/options.js'])));
  } finally { cleanup(none.dir, empty.dir, off.dir, replaced.dir); }
});

test('a missing local file or another URL scheme fails the render and names the option', { skip }, () => {
  const missing = render(['src_css_post: "post.css missing.css"']), scheme = render(['src_jxg_pre: ftp://example.test/a.js']);
  try {
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /option src_css_post: cannot read the local file 'missing\.css'/);
    assert.notEqual(scheme.status, 0);
    assert.match(scheme.stderr, /option src_jxg_pre must be an http\(s\) or data URL or a local file path/);
  } finally { cleanup(missing.dir, scheme.dir); }
});
