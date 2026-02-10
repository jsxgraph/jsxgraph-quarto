# JSXGraph Extension For Quarto

Display [JSXGraph](https://jsxgraph.org) constructions with the scientific and technical publishing system [Quarto](https://quarto.org/).

## Installing

### Install from github

```
cd myProject
quarto add jsxgraph/jsxgraph-quarto
```

### Install manually

- Create the subfolder `jsxgraph` in your project's folder `_extensions`
- Copy files `_extension.yml`, `jsxgraph.lua` to the subdirectory `_extensions/jsxgraph`

## Using

Either:

- In the main config file `_quarto.yml` of your project add `jsxgraph` like this

```yml
project:
  type: website

filters:
  - jsxgraph

website:
  title: "Mathematics"
  sidebar:
    style: "docked"
    contents:
      - section: "JSXGraph"
        contents:
          - pages/test.qmd

format:
  html:
    theme: cosmo
    css: styles.css

```

- or add `jsxgraph` to yml part of an individual page

```yml
---
title: "JSXGraph Test"
filters:
  - jsxgraph
---
```

## Attributes

JSXGraph `<iframe>` Attributes

| Attribute    | Description                                                                                  | Default |
|--------------|----------------------------------------------------------------------------------------------|---------|
| `iframe_id`  | Adds `id="frame_id"` to the `<iframe>` containing the JSXGraph illustration.                 | _nil_   |
| `width`      | Sets the width in pixels (e.g., `500`) or percent (e.g., `50%`). For CSS units, use `style`. | `500`   |
| `height`     | Sets the height in pixels (e.g., `500`) or percent (e.g., `50%`). For CSS units, use `style`. | `500`   |
| `style`      | Apply custom CSS (e.g., `border: 5px solid red; border-radius: 10px;`).                      | none    |
| `class`      | Adds a CSS class to the `<iframe>`.                                                          | none    |
| `echo`       | Display JSXGraph source code                                                                 | false   |
| `src_jxg`    | Path to `jsxgraphcore.js`.                                                                   |  |
| `src_css`    | Path to `jsxgraph.css`.                                                                      |  |
| `src_mjx`    | Path to MathJax file.                                                                        |  |

### Example

~~~markdown
```{.jsxgraph width="300" style="border:none" show_source=true}
var board = JXG.JSXGraph.initBoard(BOARDID, {boundingbox: [-5, 2, 5, -2], axis: true, keepAspectRatio: true});
var f = board.create('functiongraph',['x^2']);
```
~~~

## Demo

Here is the source code for a small example: [example.qmd](example.qmd).


