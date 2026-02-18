import puppeteer from "puppeteer";


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
const dom = options.dom || "chrome";
const src_jxg = options.src_jxg || "https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js";

async function main() {
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    await page.setViewport({width: parseInt(width), height: parseInt(height)});

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

    await page.addScriptTag({ url: src_jxg });

    await page.evaluate(() => {