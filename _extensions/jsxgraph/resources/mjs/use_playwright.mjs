import { chromium } from "playwright";
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
#${uuid} { width:${width}px; height:${height}px; ${style} }
</style>
</head>
<body>
<div id="${uuid}"></div>
</body>
</html>
    `);


    if (fs.existsSync(src_jxg)) {
        await page.addScriptTag({ path: path.resolve(src_jxg) });
    } else if (src_jxg.startsWith('http://') || src_jxg.startsWith('https://') || src_jxg.startsWith('file://')) {
        await page.addScriptTag({url: src_jxg});
    }

    await page.evaluate((uuid) => {