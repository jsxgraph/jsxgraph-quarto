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

## Example

Here is the source code for a small example: [example.qmd](example.qmd).


