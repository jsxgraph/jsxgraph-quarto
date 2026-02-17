    });

    const svgElement = await page.$eval("#jxg_box svg", el => el.outerHTML);

    createSvg({
        svgElement: svgElement,
        width: width,
        height: height,
        svgFilename: svgFilename,
        backgroundColor: '#faf'
    });

    await browser.close();
}

main().catch(console.error);