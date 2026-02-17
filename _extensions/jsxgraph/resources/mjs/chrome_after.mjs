    });

    const svgElement = await page.$eval("#jxg_box svg", el => el.outerHTML);

    createSvg({
        svgElement: svgElement,
        width: width,
        height: height,
        svgFilename: svgFilename,
        backgroundColor: '#aaf'
    });

    await browser.close();
}

main().catch(console.error);