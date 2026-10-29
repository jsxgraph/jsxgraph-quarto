

# JSXGraph Extension for Quarto

[![Quarto Version](https://img.shields.io/badge/Quarto-%3E%3D1.3-blue)](https://quarto.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/jsxgraph/jsxgraph-quarto)](https://github.com/jsxgraph/jsxgraph-quarto/releases)

> Render interactive JSXGraph boards in Quarto documents and export static SVG for PDF/Word outputs.

---

## Features

- Interactive **JSXGraph boards** for `html` and `revealjs`.
- **Static SVG export** for `pdf` and `docx`.
- Full control over `<iframe>` layout, style, and source code display.
- A generic JSON assessment bridge for exercise and LMS integrations.
- A reusable free-placement editor for simple undirected graphs.
- Works **globally** or **per page** in your Quarto project.

**Requires JSXGraph 1.14.2 or later.** The default URLs and the bundled offline copy are the
released JSXGraph 1.14.2; see [the runtime notes](docs/upstream-runtime.md). The
extension has no workarounds for older versions; if you load an older JSXGraph
through `src_jxg`, you do so at your own risk (the page then logs a warning to
the browser console).

---

## Getting Started

### 1. Install the Extension

**From GitHub**

```bash
cd myProject
quarto add jsxgraph/jsxgraph-quarto
```
**Manually**

1. Create `_extensions/jsxgraph` in your project folder.
2. Copy `_extension.yml`, `graph-editor.js`, and the `lua` and `resources`
   folders into `_extensions/jsxgraph`.

---

### 1b. Prerequisites for SVG Export

To export JSXGraph boards as SVG (for HTML, PDF, or Word outputs), the following prerequisites and setup steps are required:

---

#### 1. Install Node.js

Make sure [Node.js](https://nodejs.org/) is installed on your system. This is required to run the npm packages needed for SVG export.

---

#### 2. DOM Generator Options for SVG Export

JSXGraph Extention supports different DOM generators to render SVGs. You can choose from `chrome`, `jsdom`, or `playwright`. The table below shows the required npm packages and setup for each option:

| Generator    | npm / Setup Steps                                                                                                                            | Notes                                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `chrome`    | Install via npm: <br>```bash npm install puppeteer ```<br>Requires local Chrome installation.                                                 | Download Chrome from [Google Chrome](https://www.google.com/chrome/). Uses real browser environment.                               |
| `playwright`| Install via npm: <br>```bash npm install playwright ``` <br>Then install Chrome for Playwright: <br>```bash npx playwright install chrome ``` | Provides a controlled browser environment.                                                              |


**Note**

These steps are only required for SVG export. For interactive HTML or revealjs outputs, no additional installation is needed.

### 2. Enable the Extension

**Globally (`_quarto.yml`)**

```yaml
project:
  type: website

filters:
  - jsxgraph

format:
  html
```

**Per page**

```yaml
---
title: "JSXGraph Test"
filters:
  - jsxgraph
---
```

## Attributes

| Attribute      | Description                                                                    | Default  |
|----------------|--------------------------------------------------------------------------------|----------|
| `aspect_ratio` | Sets the `width`-to-`height` ratio.                                            | `1/1`    |
| `class`        | Adds a CSS class to the `<iframe>`.                                            | `none`   |
| `dom`          | DOM generator for `svg`: `chrome` or`playwright`.                              | `chrome` |
| `echo`         | Displays the JSXGraph source code.                                             | `false`  |
| `height`       | Height in pixels (e.g. `500`).                                                 | —        |
| `assessment_id`| Gives the iframe and assessment protocol a stable identifier.                  | generated |
| `iframe_id`    | Adds `id="frame_id"` to the `<iframe>` containing the JSXGraph illustration.   | —        |
| `out`          | Static export with `svg`; interactive html export with `js`.                   | `js`     |
| `reload`       | Shows a reload button.                                                         | `false`  |
| `src_css`      | URL of `jsxgraph.css`; any other value selects the bundled copy (interactive output). | jsDelivr, JSXGraph 1.14.2 (exact) |
| `src_jxg`      | URL of `jsxgraphcore.js`; any other value selects the bundled copy (interactive output). | jsDelivr, JSXGraph 1.14.2 (exact) |
| `src_mjx`      | Path to the MathJax file.                                                      | jsDelivr, latest MathJax 4.x |
| `src_mjx_preload` | URL or local path of a script that runs before the MathJax script (interactive output only; see [Configuring MathJax before it loads](#configuring-mathjax-before-it-loads)). | none |
| `style`        | Custom CSS (e.g. `border: 5px solid red; border-radius: 10px;`).               | `none`   |
| `textwidth`    | Absolute textwidth  (e.g. `15.5cm`, `5in`).                                    | `20cm`   |
| `unit`         | Unit for `width`and `height` (e.g. `px`, `em`, `rem`, `cm`, `mm`, `in`, `pt`). | `px`     |
| `width`        | Width in pixels (e.g. `500`).                                                  | —        |

---

## Example


````
```{.jsxgraph width="400" style="border:1px solid #ccc; border-radius:5px" echo=true}
var board = JXG.JSXGraph.initBoard('BOARDID', {
  boundingbox: [-5, 5, 5, -5],
  axis: true,
  keepAspectRatio: true
});
var f = board.create('functiongraph', ['x^2']);
```
````



## Assessment bridge

Interactive boards can expose any JSON-serializable response to a parent page
such as an exercise or learning-management extension. Give the block a stable
`assessment_id` and register a response provider:

````markdown
```{.jsxgraph assessment_id="my-board"}
var board = JXG.JSXGraph.initBoard(BOARDID, {axis: true});
var point = board.create('point', [0, 0]);

JXG.QuartoAssessment.register({
  board: board,
  response: function () {
    return {point: [point.X(), point.Y()]};
  },
  ai: {
    render: true,
    summary: function (data) {
      return {point: data.point};
    }
  }
});
```
````

`response` may return any JSON-serializable value or a Promise. The optional
`ai.summary` provides a smaller textual representation, while
`ai.render: true` returns a PNG of the current board for vision-capable
consumers.

The sandboxed iframe communicates with its parent through `postMessage` using
protocol `jsxgraph-quarto-assessment`, version 1. Requests and responses are
correlated by `assessmentId` and `requestId`; the iframe accepts requests only
from its parent window. The parent application remains responsible for
validating responses, enforcing timeouts and size limits, and deciding whether
AI-oriented data may leave the browser.

The same protocol still accepts a `layout` notification from the parent. It
needs no action any more: JSXGraph's own resize observer sizes the boards when
a hidden or collapsed iframe becomes visible. See the complete request,
response, error, AI-data, and layout protocol in
[the graph editor and assessment API reference](docs/graph-editor.md).

## Graph editor

`JXG.QuartoGraphEditor` builds an empty, free-placement editor for simple
undirected graphs:

````markdown
```{.jsxgraph assessment_id="graph-answer" width="800" height="520"}
var editor = JXG.QuartoGraphEditor.createBoard();
editor.register({
  ai: {
    render: true,
    summary: function (data) {
      return JXG.QuartoGraphEditor.summarize(data);
    }
  }
});
```
````

Students click empty space to add vertices, click two vertices to toggle their
edge, and drag vertices to reposition them. The editor serializes stable vertex
IDs, coordinates, and an edge list. It also provides deterministic topology
summaries for feedback systems. The full API, response schema, customization
options, and host integration contract are documented in
[docs/graph-editor.md](docs/graph-editor.md).

## Asset loading

Interactive output uses the jsDelivr JSXGraph JavaScript and CSS URLs by
default, pinned exactly to the released JSXGraph 1.14.2 (`jsxgraph@1.14.2`). A
project can set `src_jxg` and `src_css` to other HTTP(S) URLs, which are
preserved as supplied. Any other value (a local path, say) selects the bundled
copy of `jsxgraphcore.js` and `jsxgraph.css`, which is embedded as a data URL;
the path itself is not read. The bundled resources therefore remain available
for self-contained or offline projects when selected explicitly.

## Configuring MathJax before it loads

MathJax reads its configuration, `window.MathJax`, when its script runs, and
that script is loaded asynchronously in the head of each board's `<iframe>`;
board code and `src_jxg` are not guaranteed to run before it. To configure MathJax, set `src_mjx_preload`
to a script that sets `window.MathJax` (or does anything else that must happen
first). The script is added as an ordinary synchronous `<script>` in the head,
directly before the unchanged MathJax script, so it has run to completion when
MathJax starts. `src_mjx` is not wrapped or changed: MathJax keeps its URL,
`id="MathJax-script"`, `async` and its own load event.

For example, `mathjax-config.js`:

```javascript
window.MathJax = {
  options: { enableMenu: false }
};
```

set for the whole document:

```yaml
jsxgraph:
  src_mjx_preload: mathjax-config.js
```

or for one board (an empty value, `src_mjx_preload=""`, switches a global
setting off for that board):

````
```{.jsxgraph src_mjx_preload="mathjax-config.js"}
...
```
````

- **URLs.** A value starting with `http://` or `https://` (or a `data:` URL) is
  linked as given. Any other scheme is an error.
- **Local files.** Any other value is a path to a local file. A relative path
  is looked up in the directory of the document being rendered first, then in
  the project directory; an absolute path is used as it is. The file is read
  while rendering and embedded as a `data:text/javascript;base64,...` URL, so
  the output stays self-contained and works inside the sandboxed frame. If the
  file cannot be found, the render fails with a message naming the option and
  the paths tried.
- **Escaping.** The value is escaped for the HTML attribute (`&`, `"`, `<`,
  `>`); it is not otherwise changed. As for every option, a value in the
  document metadata is read as Markdown, so typography applies there: quotes
  become curly quotes, `--` an en dash, `...` an ellipsis, and apostrophes
  change. A double quote can be written `\"`; for a URL with such characters
  it is safer to use a block attribute, which takes the value as written.
- **Unset or empty.** Nothing is added; the generated frame is the same as
  without the option.
- **Scope.** The option applies to interactive output (`out: js`) only. The
  static `svg` export does not use it.

## Demo

Check out a working example: [example.qmd](example.qmd).

---

## Notes

- **SVG export** works for `pdf` and `docx`.  
- **Interactive export** works for `html` and `revealjs`.  
- Use `echo=true` to display the JSXGraph source code below the board.  
- Customize layout via `width`, `height`, `style`, and `class`.
- `BOARDID` is the id of the board's container everywhere in the code, not only
  in `initBoard(BOARDID, ...)`; for example `document.getElementById(BOARDID)`.
- **Hidden boards and resizing.** Board code runs while the page loads, also
  for a board in a Quarto tab that is not shown or in a collapsed callout, so
  `DOMContentLoaded`, `load` and `document.write` behave as always. JSXGraph's
  own resize observer then sizes the board when it is shown and follows its
  container on any later resize (window, tab, mobile width); the container
  keeps its CSS size, so the board narrows with the page. Since JSXGraph
  1.14.2 a board created while hidden gets, when first shown, the view its
  code asked for (`boundingbox`, `unitX`/`unitY` with `originX`/`originY`, or
  a view its code set meanwhile). The extension adds one thing JSXGraph does
  not do: a `keepaspectratio` board with a `boundingbox` shows its whole view
  at any width, also after the navigation bar's home button (JSXGraph's own
  rule keeps one side and may crop the other on a narrow screen). Boards need
  no resize code of their own.
- **Known limits.** A `keepaspectratio` board set up with
  `unitX`/`unitY` and `originX`/`originY` keeps its units and origin, so a
  narrow screen cuts its right side. An assessment request with `ai.render`
  for a board that has never been shown returns an empty picture (the
  board has no size yet). Board code with its own resize handling (e.g.
  `setBoundingBox(box, true)` on every resize) decides the view itself.
- **JSXGraph version.** The extension requires JSXGraph 1.14.2 or later;
  older versions get one console warning. 1.14.1 fixes the blank board after a
  hidden tab is shown, the view of a hidden `keepaspectratio` board, a possible
  endless loop in the SVG renderer and the resize observer that one error
  during a resize stopped for good. 1.14.2 also keeps a view requested while a
  board is hidden and restores explicit units and origins when it is shown, so
  the extension has no code of its own for boards created while hidden.
  Still open in 1.14.2, and covered by the extension: a `keepaspectratio`
  board whose container gets narrower than its box is cropped at the sides.
  A board that has zero width while hidden still has no drawable picture. The
  bundled offline copy (`jsxgraphcore.js` and `jsxgraph.css`) is JSXGraph
  1.14.2.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
