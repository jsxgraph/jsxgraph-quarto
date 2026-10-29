# Bundled JSXGraph runtime: release 1.14.2

The default URLs and the bundled offline copy are the released JSXGraph
1.14.2 from npm (`jsxgraph@1.14.2`, tag `v1.14.2`, commit
`ecc97f951ad0ed2acfffbad68706e40683635721`). The bundled
`jsxgraphcore.js`, `jsxgraph.css` and the upstream licence texts are the
package's files, unchanged. Their npm integrity and SHA-256 hashes are in
`_extensions/jsxgraph/upstream-runtime.json`.
`python scripts/fetch-upstream-runtime.py --check` downloads the package,
verifies its integrity and compares every bundled byte; the GitHub workflow
runs the same check. Without `--check` the script writes the files, which is
how the next release is brought in after its record is updated.

1.14.2 contains the three upstream resize fixes of 22–24 October
(afe77cfe, 3e5ea5ff, 1096eb30; on `develop` as 2c9118da, 8440645e, 64282a36).
A board created while hidden keeps a bounding box its code set meanwhile, and
a board set up with `unitX`/`unitY`/`originX`/`originY` gets those units and
that origin when shown. In Chromium, 1.14.1 loses both and 1.14.2 keeps both
without help from the extension, so the extension no longer carries its own
code for boards created while hidden. The earlier pin, a build of the
unreleased 1.15.0-dev (`a3867ae`), is no longer needed: the rest of
1.15.0-dev is accessibility, keyboard and VML-removal work.

Still open in 1.14.2: when a `keepaspectratio` board's container gets
narrower than the box, JSXGraph keeps the vertical extent and crops the
sides. For example, `boundingbox: [0, 6, 14, 0]` at 600×150 px, narrowed to
273×150 px, shows x 1.54…12.46 instead of 0…14, and the navigation bar's
home button (`zoom100`) crops it the same way. The extension still fits such
a board's whole view on resize and on the home button; the browser tests
check both sides of this.

The integration of upstream `main` at `a95610d` retains its `overflow:hidden`
on the iframe's `html,body`, suppressing frame scrollbars without replacing
the board's percentage container dimensions. Its old refresh loop is not
restored: JSXGraph's own ResizeObserver follows the container on every resize.
`tests/iframe-resize.browser.test.mjs` renders the actual sandboxed data iframe
with Quarto, repeatedly narrows and widens it, hides and shows it, and checks
canvas/SVG dimensions, percentage container styles, the whole box and home.
The bundled core and CSS are byte-identical to upstream `main` at that commit.

A truly hidden percentage-width board still has zero width until shown and
has no drawable hidden image. View recovery and hidden-image capture are
separate capabilities; a blank PNG must not be described as useful context.
