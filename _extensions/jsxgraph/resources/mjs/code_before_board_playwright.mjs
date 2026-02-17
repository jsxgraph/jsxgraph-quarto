import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.setContent(`
<html>
<body><div id="jxg_box" style="width:800px; height:600px;"></div>
</body>
</html>
`);

await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js" });

await page.evaluate(() => {
    const board = JXG.JSXGraph.initBoard("jxg_box", { boundingbox: [-5,5,5,-5], axis:true });
});

const svg = await page.$eval("#jxg_box", el => el.innerHTML);

fs.writeFileSync("board.svg", svg);

await browser.close();