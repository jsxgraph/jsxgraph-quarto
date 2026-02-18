

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
2. Copy `_extension.yml` and folder `lua` and `resources` into `_extensions/jsxgraph`.

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

| Attribute   | Description                                                                              | Default  |
|-------------|------------------------------------------------------------------------------------------|----------|
| `class`     | Adds a CSS class to the `<iframe>`.                                                      | `none`   |
| `dom`       | DOM generator for `svg`: `chrome` or`playwright`.                                        | `chrome` |
| `echo`      | Displays the JSXGraph source code.                                                       | `false`  |
| `height`    | Height in pixels (e.g. `500`) or percent (e.g. `50%`). For other CSS units, use `style`. | `500`    |
| `iframe_id` | Adds `id="frame_id"` to the `<iframe>` containing the JSXGraph illustration.             | —        |
| `reload`    | Shows a reload button when `render="iframe"`.                                            | `false`  |
| `render`    | Static export with `svg`; interactive html export with `iframe` (recommended) or `div`.  | `iframe` |
| `src_css`   | Path to `jsxgraph.css`.                                                                  | —        |
| `src_jxg`   | Path to `jsxgraphcore.js`.                                                               | —        |
| `src_mjx`   | Path to the MathJax file.                                                                | —        |
| `style`     | Custom CSS (e.g. `border: 5px solid red; border-radius: 10px;`).                         | `none`   |
| `width`     | Width in pixels (e.g. `500`) or percent (e.g. `50%`). For other CSS units, use `style`.  | `500`    |

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
