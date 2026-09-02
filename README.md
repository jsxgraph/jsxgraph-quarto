

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
| `src_css`      | URL or local path to `jsxgraph.css`.                                          | jsDelivr |
| `src_jxg`      | URL or local path to `jsxgraphcore.js`.                                       | jsDelivr |
| `src_mjx`      | Path to the MathJax file.                                                      | —        |
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

The same protocol accepts a `layout` notification from the parent. This
refreshes all boards after a hidden or collapsed iframe becomes visible, so
JSXGraph can recompute its canvas dimensions. See the complete request,
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
default. A project can set `src_jxg` and `src_css` to other HTTP(S) URLs, which
are preserved as supplied, or to local paths, which are embedded as data URLs.
The bundled resources therefore remain available for self-contained or offline
projects when selected explicitly.

## Demo

Check out a working example: [example.qmd](example.qmd).

---

## Notes

- **SVG export** works for `pdf` and `docx`.  
- **Interactive export** works for `html` and `revealjs`.  
- Use `echo=true` to display the JSXGraph source code below the board.  
- Customize layout via `width`, `height`, `style`, and `class`.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
