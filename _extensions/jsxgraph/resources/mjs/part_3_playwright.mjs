
async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: parseInt(width), height: parseInt(height) }
    });
    const page = await context.newPage();
