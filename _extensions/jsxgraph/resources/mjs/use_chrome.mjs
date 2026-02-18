import puppeteer from "puppeteer";
import path from 'path';
import fs from "fs";

const svgFilename = process.argv[2] || 'board.svg';
const args = process.argv.slice(2);
const options = {};
for (let i = 1; i < args.length; i++) {
    const [key, value] = args[i].split("=");
    if (key && value !== undefined) {
        const numValue = Number(value);
        options[key] = isNaN(numValue) ? value : numValue;
    }
}

const width = options.width || 800;
const height = options.height || 600;
const style = options.style || "";
const src_jxg = options.src_jxg || "https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js";
const dom = options.dom || 'chrome';
const src_mjx = options.src_mjx || '';
const src_css = options.src_css || 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css';
const uuid = options.uuid || 'jxg_box';
const unit = options.unit || "px";

async function main() {
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    await page.setViewport({width: parseInt(width), height: parseInt(height)});

    await page.setContent(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <!-- Include MathJax -->
    <script id="MathJax-script" defer src="${src_mjx}"></script>
    <!-- Include JSXGraph -->
    <!--<script src="${src_jxg}"></script>-->
    <!-- Include CSS -->
    <style>
        @import url("${src_css}");
    </style>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
      .jxgbox { border: none; }
    </style>
  </head>
  <body>
    <div id="${uuid}" class="jxgbox" style="width: ${width}${unit}; height: ${height}${unit}; display: block; object-fit: fill; box-sizing: border-box; ${style};"></div>
  </body>
</html>
`);


    if (fs.existsSync(src_jxg)) {
        await page.addScriptTag({ path: path.resolve(src_jxg) });
    } else if (src_jxg.startsWith('http://') || src_jxg.startsWith('https://') || src_jxg.startsWith('file://')) {
        await page.addScriptTag({url: src_jxg});
    }

    await page.evaluate((uuid) => {