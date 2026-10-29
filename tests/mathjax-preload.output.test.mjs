// The src_mjx_preload option: what the filter writes into the board frame.
//
// Renders small Quarto projects with the filter and inspects the generated
// <iframe> (its data: URL, decoded). Needs Quarto 1.3 or later: set QUARTO to
// the quarto executable, or have `quarto` on the PATH; without it the tests are
// skipped. The baseline comparison also needs the reviewed release-runtime
// commit in this git clone (`git fetch` the branch history if missing).
// Run with `node --test tests/mathjax-preload.output.test.mjs` (or `node --test`).
import assert from 'node:assert/strict';
import test from 'node:test';
import { BASE_COMMIT, cleanup, extensionAtRevision, findQuarto, normalizeIds, normalizePage, renderProject } from './support/render.mjs';

const quarto = findQuarto();
const skip = quarto ? false : 'Quarto not found (set QUARTO or put quarto on the PATH)';

const BOARD = 'var board = JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [-5, 5, 5, -5]});';
const MATHJAX_LINE = '<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-svg.js"></script>';
const GROUP = '<script id="MathJax-script"';

function qmd(meta, blocks = [{ attrs: '', code: BOARD }]) {
  const yaml = ['---', 'title: t', 'filters: [jsxgraph]'];
  if (meta) yaml.push('jsxgraph:', ...meta.map((line) => '  ' + line));
  yaml.push('---', '');
  return yaml.join('\n') + '\n' + blocks.map((b) => '```{.jsxgraph' + (b.attrs ? ' ' + b.attrs : '') + '}\n' + b.code + '\n```\n').join('\n');
}

function headOf(frameHtml) { return frameHtml.slice(0, frameHtml.indexOf('</head>')); }

// Pre-loader elements: every <script> of the head that comes before the MathJax script
function scriptsBeforeMathJax(frameHtml) {
  const head = headOf(frameHtml);
  const before = head.slice(0, head.indexOf(GROUP));
  return before.match(/<script\b[^>]*>[\s\S]*?<\/script>/g) || [];
}

const render = (files, doc = 'a.qmd', options = {}) => renderProject({ quarto, files, doc, ...options });

test('without the option the frame is unchanged: no pre-loader element', { skip }, () => {
  const r = render({ 'a.qmd': qmd(null) });
  try {
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.frames.length, 1);
    assert.deepEqual(scriptsBeforeMathJax(r.frames[0].html), []);
    assert.ok(r.frames[0].html.includes('<meta charset="UTF-8">\n' + MATHJAX_LINE + '\n<script src='), 'MathJax script directly after the meta tag');
  } finally { cleanup(r.dir); }
});

test('an unset, empty or blank option gives the same frame as no option', { skip }, () => {
  const none = render({ 'a.qmd': qmd(null) });
  const variants = [['src_mjx_preload: ""'], ['src_mjx_preload: "   "']].map((meta) => render({ 'a.qmd': qmd(meta) }));
  const perBlock = render({ 'a.qmd': qmd(['src_mjx_preload: pre.js'], [{ attrs: 'src_mjx_preload=""', code: BOARD }]), 'pre.js': 'window.x=1;' });
  try {
    for (const r of [none, ...variants, perBlock]) assert.equal(r.status, 0, r.stderr);
    for (const r of [...variants, perBlock]) {
      assert.equal(normalizeIds(r.frames[0].html), normalizeIds(none.frames[0].html));
    }
  } finally { cleanup(none.dir, ...variants.map((r) => r.dir), perBlock.dir); }
});

// Needs BASE_COMMIT (see tests/support/render.mjs) in the git clone; skipped without it.
test('unconfigured output differs from the release-runtime baseline only by iframe overflow CSS', { skip: skip || false }, (t) => {
  const baseRev = extensionAtRevision(BASE_COMMIT);
  if (!baseRev) { t.skip('commit ' + BASE_COMMIT + ' is not in this git clone'); return; }
  const docs = {
    'plain.qmd': qmd(null),
    'options.qmd': qmd(['width: 321', 'height: 222', 'class: boardclass', 'src_mjx: https://example.test/mj.js?a=1&b=2',
      'src_jxg: https://example.test/jxg.js', 'src_css: https://example.test/jxg.css', 'reload: true', 'assessment_id: fixed-id'],
    [{ attrs: 'echo=true', code: BOARD }, { attrs: 'unit="%" width=50', code: 'var b = JXG.JSXGraph.initBoard("x", {axis: true});' }]),
    'bundled.qmd': qmd(['src_jxg: bundled', 'src_css: bundled'], [{ attrs: '', code: BOARD }, { attrs: 'out=js', code: BOARD }]),
    'format-html.qmd': qmd(null).replace('filters: [jsxgraph]', 'filters: [jsxgraph]\nformat: html')
  };
  const heads = [], bases = [];
  try {
    for (const [doc, text] of Object.entries(docs)) {
      const head = render({ [doc]: text }, doc);
      const old = render({ [doc]: text }, doc, { extension: baseRev.extension });
      heads.push(head.dir); bases.push(old.dir);
      assert.equal(head.status, 0, doc + ': ' + head.stderr);
      assert.equal(old.status, 0, doc + ' (base): ' + old.stderr);
      assert.ok(head.frames.length >= 1, doc + ': has frames');
      assert.equal(head.frames.length, old.frames.length);
      // Carry over upstream's scrollbar suppression, with no other renderer
      // changes. Assert the old CSS exists before applying this exact delta.
      const before = 'html,body{margin:0;padding:0;width:100%;height:100%;}';
      const after = 'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}';
      for (const frame of old.frames) {
        assert.ok(frame.html.includes(before), 'baseline iframe CSS found');
        const expected = frame.html.replace(before, after);
        old.html = old.html.replace(Buffer.from(frame.html).toString('base64'), Buffer.from(expected).toString('base64'));
        frame.html = expected;
      }
      head.frames.forEach((f, i) => {
        assert.equal(Buffer.from(normalizeIds(f.html)).equals(Buffer.from(normalizeIds(old.frames[i].html))), true, doc + ' frame ' + i + ' identical');
      });
      assert.equal(normalizePage(head.html), normalizePage(old.html), doc + ': whole page identical');
    }
  } finally { cleanup(...heads, ...bases, baseRev.root); }
});

test('a local file is embedded as a data URL with its exact bytes, directly before the unchanged MathJax script', { skip }, () => {
  // Non-ASCII text, CRLF line ends, a NUL byte and a byte that is not valid UTF-8
  const bytes = Buffer.concat([Buffer.from('window.PRE = "ü€";\r\n// '), Buffer.from([0x00, 0xff, 0xfe]), Buffer.from('\r\n')]);
  const none = render({ 'a.qmd': qmd(null) });
  const r = render({ 'a.qmd': qmd(['src_mjx_preload: pre.js']), 'pre.js': bytes });
  try {
    assert.equal(r.status, 0, r.stderr);
    const html = r.frames[0].html;
    const tags = scriptsBeforeMathJax(html);
    assert.equal(tags.length, 1, 'exactly one pre-loader element');
    const m = tags[0].match(/^<script src="data:text\/javascript;base64,([A-Za-z0-9+/=]*)"><\/script>$/);
    assert.ok(m, 'plain <script src> without other attributes: ' + tags[0].slice(0, 80));
    assert.equal(Buffer.from(m[1], 'base64').equals(bytes), true, 'exact bytes');
    // Directly before the MathJax script, nothing between, and the script itself is unchanged
    assert.ok(html.includes(tags[0] + '\n' + MATHJAX_LINE + '\n'), 'directly before the original MathJax script');
    assert.equal(html.split(GROUP).length, 2, 'one MathJax script');
    // Removing the element gives the unconfigured frame
    assert.equal(normalizeIds(html.replace(tags[0] + '\n', '')), normalizeIds(none.frames[0].html));
    assert.ok(!/<script[^>]*\b(async|defer|type)=?[^>]*src="data:text\/javascript[^"]*"/.test(tags[0]));
    // The element is in the head, which still holds the other scripts after it
    assert.ok(html.indexOf(tags[0]) < html.indexOf('</head>'));
  } finally { cleanup(none.dir, r.dir); }
});

test('a linked URL is kept as given and its & and " are escaped for the attribute', { skip }, () => {
  const url = 'https://example.test/a.js?x=1&y="2"&z=<3>';
  const expected = '<script src="https://example.test/a.js?x=1&amp;y=&quot;2&quot;&amp;z=&lt;3&gt;"></script>';
  // Document metadata is parsed as Markdown (as for every option), so a double quote
  // is written \" there; a block attribute takes the value as written, with \" in quotes.
  const viaMeta = render({ 'a.qmd': qmd(["src_mjx_preload: 'https://example.test/a.js?x=1&y=\\\"2\\\"&z=<3>'"]) });
  const viaBlock = render({ 'a.qmd': qmd(null, [{ attrs: 'src_mjx_preload="https://example.test/a.js?x=1&y=\\"2\\"&z=<3>"', code: BOARD }]) });
  try {
    for (const r of [viaMeta, viaBlock]) {
      assert.equal(r.status, 0, r.stderr);
      const html = r.frames[0].html;
      const tags = scriptsBeforeMathJax(html);
      assert.equal(tags.length, 1);
      assert.equal(tags[0], expected);
      const value = tags[0].match(/^<script src="([^"]*)">/)[1]
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      assert.equal(value, url, 'unescapes to the given URL');
      assert.ok(html.includes(tags[0] + '\n' + MATHJAX_LINE));
    }
  } finally { cleanup(viaMeta.dir, viaBlock.dir); }
});

test('a plain http(s) URL and a data: URL are linked unchanged', { skip }, () => {
  const dataUrl = 'data:text/javascript;base64,d2luZG93LkE9MTs=';
  for (const url of ['https://example.test/pre.js', 'http://localhost:8123/pre.js', dataUrl]) {
    const r = render({ 'a.qmd': qmd(['src_mjx_preload: ' + url]) });
    try {
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(scriptsBeforeMathJax(r.frames[0].html), ['<script src="' + url + '"></script>']);
    } finally { cleanup(r.dir); }
  }
});

test('a per-block attribute overrides the document option, an empty one switches it off', { skip }, () => {
  const r = render({
    'a.qmd': qmd(['src_mjx_preload: doc.js'], [
      { attrs: '', code: BOARD },
      { attrs: 'src_mjx_preload="block.js"', code: BOARD },
      { attrs: 'src_mjx_preload=""', code: BOARD },
      { attrs: 'src_mjx_preload="https://example.test/b.js"', code: BOARD }]),
    'doc.js': 'window.D=1;', 'block.js': 'window.B=1;'
  });
  try {
    assert.equal(r.status, 0, r.stderr);
    const src = (frame) => scriptsBeforeMathJax(frame.html).map((t) => t.match(/src="([^"]*)"/)[1]);
    const decode = (u) => Buffer.from(u.split(',')[1], 'base64').toString();
    const s = r.frames.map(src);
    assert.equal(s[0].length, 1); assert.equal(decode(s[0][0]), 'window.D=1;');
    assert.equal(s[1].length, 1); assert.equal(decode(s[1][0]), 'window.B=1;');
    assert.deepEqual(s[2], []);
    assert.deepEqual(s[3], ['https://example.test/b.js']);
  } finally { cleanup(r.dir); }
});

test('relative paths: the document folder first, then the project folder; absolute paths as they are', { skip }, () => {
  const absolute = render({ 'abs/pre.js': 'window.ABS=1;', 'a.qmd': qmd(null) });
  const files = {
    '_quarto.yml': 'project:\n  type: default\n',
    'both.js': 'window.WHERE="project";', 'sub/both.js': 'window.WHERE="sub";',
    'rootonly.js': 'window.WHERE="root-only";'
  };
  const r = render({
    ...files,
    'sub/b.qmd': qmd(null, [{ attrs: 'src_mjx_preload="both.js"', code: BOARD }, { attrs: 'src_mjx_preload="rootonly.js"', code: BOARD },
      { attrs: 'src_mjx_preload="../rootonly.js"', code: BOARD }, { attrs: 'src_mjx_preload="' + absolute.dir + '/abs/pre.js"', code: BOARD }])
  }, 'sub/b.qmd', { project: true });
  try {
    assert.equal(r.status, 0, r.stderr);
    const text = (f) => Buffer.from(scriptsBeforeMathJax(f.html)[0].match(/base64,([^"]*)"/)[1], 'base64').toString();
    assert.equal(text(r.frames[0]), 'window.WHERE="sub";', 'document folder wins over project folder');
    assert.equal(text(r.frames[1]), 'window.WHERE="root-only";', 'falls back to the project folder');
    assert.equal(text(r.frames[2]), 'window.WHERE="root-only";', 'path relative to the document folder');
    assert.equal(text(r.frames[3]), 'window.ABS=1;', 'absolute path');
  } finally { cleanup(absolute.dir, r.dir); }
});

test('a missing local file fails the render and names the option and the path', { skip }, () => {
  const r = render({ 'a.qmd': qmd(['src_mjx_preload: no-such-file.js']) });
  try {
    assert.notEqual(r.status, 0, 'render fails');
    assert.equal(r.html, null, 'no output is written');
    assert.match(r.stderr, /src_mjx_preload/);
    assert.match(r.stderr, /no-such-file\.js/);
  } finally { cleanup(r.dir); }
  const block = render({ 'a.qmd': qmd(null, [{ attrs: 'src_mjx_preload="missing-block.js"', code: BOARD }]) });
  try {
    assert.notEqual(block.status, 0);
    assert.match(block.stderr, /src_mjx_preload/);
    assert.match(block.stderr, /missing-block\.js/);
  } finally { cleanup(block.dir); }
});

test('a directory, or a URL scheme other than http(s) and data, fails the render', { skip }, () => {
  for (const value of ['somedir', 'file:///tmp/x.js', 'blob:https://x/1', 'javascript:alert(1)']) {
    const r = render({ 'a.qmd': qmd(['src_mjx_preload: ' + value]), 'somedir/x.txt': 'x' });
    try {
      assert.notEqual(r.status, 0, value);
      assert.match(r.stderr, /src_mjx_preload/, value);
    } finally { cleanup(r.dir); }
  }
});
