# Graph editor and assessment API

This extension exposes two browser APIs inside every interactive JSXGraph
iframe:

- `JXG.QuartoAssessment` transports an arbitrary JSON-serializable response
  to a parent exercise or learning-management page.
- `JXG.QuartoGraphEditor` supplies a reusable free-placement editor for a
  simple undirected graph.

The APIs are independent of any particular grading system. A parent application
decides how responses are validated, scored, stored, or sent elsewhere.

## Minimal graph editor

```javascript
var editor = JXG.QuartoGraphEditor.createBoard();
editor.register();
```

`createBoard()` initializes the current `.jxgbox` as an empty graph board.
`register()` exposes `editor.response()` through the assessment bridge.

The default interactions are:

| Action | Result |
|---|---|
| Click empty canvas | Add a vertex at that position. |
| Click two vertices | Add an edge between them. |
| Click an existing pair again | Remove their edge. |
| Drag a vertex | Move it without changing adjacency. |
| Select a vertex, then choose **Delete selected** | Remove the vertex and its incident edges. |
| Choose **Clear graph** | Remove all vertices and edges. |
| Choose **Show controls** | Show or hide the on-board instructions. |

Self-loops and parallel edges cannot be created. Vertex identifiers remain
stable until the graph is cleared; deleting a vertex does not renumber the
others.

## Creating an editor

`JXG.QuartoGraphEditor.createBoard(options)` initializes a standard board and
returns an editor. In addition to the editor options below, it accepts:

| Option | Meaning |
|---|---|
| `container` | JSXGraph container element; defaults to the current iframe's `.jxgbox`. |
| `boardAttributes` | Attributes passed to `JXG.JSXGraph.initBoard`. The default is a fixed `[-5, 4, 5, -4]` board without axes, pan, zoom, navigation, or copyright text. |

To attach the editor to an existing board:

```javascript
var board = JXG.JSXGraph.initBoard(BOARDID, {
  boundingbox: [-6, 5, 6, -5],
  axis: false
});
var editor = JXG.QuartoGraphEditor.create({board: board});
```

### Editor options

| Option | Default | Meaning |
|---|---|---|
| `controlsInitiallyVisible` | `false` | Show the instruction panel initially. |
| `instructions` | Four standard interaction steps | Strings shown in the instruction panel. |
| `labels` | English labels | Overrides `deleteSelected`, `clearGraph`, `showControls`, or `hideControls`. |
| `editableBottom` | board bottom + `0.9` | Lowest y-coordinate where a blank click can add a vertex, reserving room for controls. |
| `pointAttributes` | draggable blue point | Additional JSXGraph point attributes. |
| `edgeAttributes` | fixed grey segment | Additional JSXGraph segment attributes. |
| `normalStyle` | blue fill and border | Normal vertex colors. |
| `selectedStyle` | orange fill and dark border | Selected vertex colors. |

### Editor methods

| Method | Result |
|---|---|
| `addVertex(x, y)` | Adds a vertex and returns its numeric identifier. |
| `toggleEdge(sourceId, targetId)` | Adds the edge, or removes it if present; returns `true` when added. |
| `deleteSelected()` | Deletes the selected vertex and reports whether anything changed. |
| `clear()` | Restores the empty editor and resets the next identifier to 1. |
| `showControls(show)` | Shows or hides instructions; with no argument, toggles them. |
| `response()` | Returns the graph response described below. |
| `summarize(options)` | Returns a deterministic topology summary. |
| `register(spec)` | Registers the response with `JXG.QuartoAssessment`. |

Editors made by `createBoard()` also expose `resize()`, which synchronizes
JSXGraph with the visible container. A `ResizeObserver`, initial animation
frames, iframe resize events, and the parent layout notification normally call
this automatically.

## Graph response

```json
{
  "representation": "undirected-graph",
  "nodes": [
    {"id": 1, "x": -2.25, "y": 1.5},
    {"id": 2, "x": 0.75, "y": -0.5}
  ],
  "edges": [[1, 2]]
}
```

Coordinates describe the drawing only. Mathematical properties should be
computed from the vertex IDs and edges. Consumers should validate the
representation, unique IDs, finite coordinates, known endpoints, and absence
of duplicate edges and self-loops before using untrusted responses.

## Topology summaries

`JXG.QuartoGraphEditor.summarize(data, options)` summarizes any graph response.
`editor.summarize(options)` summarizes the current drawing. The result
contains vertex and edge counts, sorted IDs and edges, every vertex degree,
connected components, isolated vertices, connectedness, and the undirected
cycle rank `|E| - |V| + componentCount`. Coordinates are omitted.

`options.feedbackPolicy` adds an author-controlled instruction string, and
`options.extra` adds JSON metadata:

```javascript
editor.register({
  ai: {
    render: true,
    summary: function (data) {
      return JXG.QuartoGraphEditor.summarize(data, {
        feedbackPolicy: 'Discuss degrees and connectedness without completing the graph.',
        extra: {topic: 'trees'}
      });
    }
  }
});
```

The bridge returns a PNG only when `ai.render` is true and the parent explicitly
requests AI data.

## Generic assessment registration

```javascript
JXG.QuartoAssessment.register({
  board: board,
  response: function () {
    return {point: [point.X(), point.Y()]};
  },
  ai: {
    summary: function (response) {
      return {point: response.point};
    },
    render: true
  }
});
```

`register` also accepts a response function directly. A response or summary
may be asynchronous. Before returning it, the bridge round-trips the response
through JSON serialization.

## Parent message protocol

Messages use `protocol: "jsxgraph-quarto-assessment"`, `version: 1`, and the
block's `assessment_id` (or generated iframe ID). The sandboxed iframe accepts
messages only when `event.source === window.parent`.

### Request

```json
{
  "protocol": "jsxgraph-quarto-assessment",
  "version": 1,
  "type": "request",
  "assessmentId": "graph-answer",
  "requestId": "host-generated-unique-id",
  "includeAI": true
}
```

`includeAI` defaults to false from the consumer's perspective: omit it when
only the grading response is needed.

### Successful response

```json
{
  "protocol": "jsxgraph-quarto-assessment",
  "version": 1,
  "type": "response",
  "assessmentId": "graph-answer",
  "requestId": "host-generated-unique-id",
  "payload": {},
  "ai": {
    "summary": {},
    "image": "data:image/png;base64,..."
  }
}
```

`ai` is omitted unless requested and configured. Its `summary` and `image`
members are each optional.

### Error response

Errors keep the same response envelope and set `error` instead of `payload`:

```json
{
  "protocol": "jsxgraph-quarto-assessment",
  "version": 1,
  "type": "response",
  "assessmentId": "graph-answer",
  "requestId": "host-generated-unique-id",
  "error": "No JSXGraph assessment response is registered"
}
```

### Layout notification

A parent that reveals, expands, or resizes an iframe should send:

```json
{
  "protocol": "jsxgraph-quarto-assessment",
  "version": 1,
  "type": "layout",
  "assessmentId": "graph-answer"
}
```

The iframe immediately refreshes every JSXGraph board, then repeats the refresh
across animation frames. This is important when the iframe was initially laid
out in a collapsed container. It does not produce a response message.

## Host responsibilities

The parent integration should:

- match responses by iframe window, `assessmentId`, and `requestId`;
- enforce timeouts and payload or image size limits;
- validate response schemas before grading or storage;
- send `layout` whenever hidden content becomes visible;
- request AI data only when needed; and
- obtain appropriate consent and apply its own policy before response,
  summary, or image data leaves the browser.

The protocol is an integration mechanism, not a secure examination boundary.
Author JavaScript and any client-side checker remain visible to students.
