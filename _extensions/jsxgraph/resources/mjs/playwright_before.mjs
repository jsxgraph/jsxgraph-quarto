import { chromium } from "playwright";
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

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: parseInt(width), height: parseInt(height) }
    });
    const page = await context.newPage();

    await page.setContent(`
<!DOCTYPE html>
<html>
<head>
<style>
body { margin:0; }
#jxg_box { width:${width}px; height:${height}px; ${style} }
</style>
</head>
<body>
<div id="jxg_box"></div>
</body>
</html>
    `);

    // JSXGraph laden
    await page.addScriptTag({ url: src_jxg });

    // Board erstellen
    await page.evaluate(() => {