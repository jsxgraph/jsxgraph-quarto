import puppeteer from "puppeteer";
import fs from "fs";

const args = process.argv.slice(2);
const filename = args[0];
const options = {};

for (let i = 1; i < args.length; i++) {
    const [key, value] = args[i].split("=");
    if (key && value) {
        options[key] = value;
    }
}

const width = options.width || 800;
const height = options.height || 600;
const style = options.style || "";

const browser = await puppeteer.launch({
    headless: "new" // aktueller Modus
});

const page = await browser.newPage();

await page.setViewport({ width: parseInt(width), height: parseInt(height) });

// HTML Grundgerüst
await page.setContent(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; }
        #jxg_box { width: ${width}px; height: ${height}px; ${style} }
    </style>
</head>
<body>
    <div id="jxg_box"></div>
</body>
</html>
`);

// JSXGraph im Browser laden
await page.addScriptTag({
    url: "https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js"
});

// Jetzt läuft alles im echten Browser-Kontext
await page.evaluate(() => {
    const board = JXG.JSXGraph.initBoard("jxg_box", {
        boundingbox: [-5, 5, 5, -5],
        axis: true
    });

    board.create("point", [0, 0]);
});

// SVG extrahieren
const svg = await page.$eval("#jxg_box", el => el.innerHTML);

fs.writeFileSync("board.svg", svg);

await browser.close();