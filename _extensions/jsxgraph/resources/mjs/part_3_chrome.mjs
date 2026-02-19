async function main() {
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    await page.setViewport({width: parseInt(width), height: parseInt(height)});
