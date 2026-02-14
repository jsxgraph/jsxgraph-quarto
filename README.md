

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

To export JSXGraph boards as SVG (for PDF or Word outputs), you need:

1. Install [Node.js](https://nodejs.org/) if not already installed.
2. Install `jsdom` and `jsxgraph` via npm:

```bash
npm install jsdom
npm install jsxgraph
```

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

| Attribute   | Description                                                                                                           | Default  |
|-------------|-----------------------------------------------------------------------------------------------------------------------|----------|
| `iframe_id` | Adds `id="frame_id"` to the `<iframe>` containing the JSXGraph illustration.                                          | _nil_    |
| `width`     | Width in pixels (e.g., `500`) or percent (e.g., `50%`). For CSS units, use `style`.                                   | `500`    |
| `height`    | Height in pixels (e.g., `500`) or percent (e.g., `50%`). For CSS units, use `style`.                                  | `500`    |
| `style`     | Custom CSS (e.g., `border: 5px solid red; border-radius: 10px;`).                                                     | `none`   |
| `class`     | Add a CSS class to the `<iframe>`.                                                                                    | `none`   |
| `echo`      | Show JSXGraph source code.                                                                                            | `false`  |
| `src_jxg`   | Path to `jsxgraphcore.js`.                                                                                            |          |
| `src_css`   | Path to `jsxgraph.css`.                                                                                               |          |
| `src_mjx`   | Path to MathJax file.                                                                                                 |          |
| `render`    | `svg` for static and `iframe` (recommended) or `div` for interactive HTML export.                                     | `iframe` |
| `reload`    | shows reload button for `render='iframe'` | `false`  |

---

## Example


````
```{.jsxgraph width="400" style="border:1px solid #ccc; border-radius:5px" show_source=true}
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
- Use `show_source=true` to display the JSXGraph source code below the board.  
- Customize layout via `width`, `height`, `style`, and `class`.

---

## License

MIT License. See [LICENSE](LICENSE) for details.