    }, uuid);

    const dataURI = await page.evaluate((uuid) => {
        const board = Object.values(JXG.boards)
            .find(b => b.container === uuid);
        if (!board) return null;

        return board.renderer.dumpToDataURI(false); // SVG Data-URI
    }, uuid);

    createSvg({
        dataURI: dataURI,
        width: width,
        height: height,
        svgFilename: svgFilename,
        backgroundColor: (dom == 'chrome') ? '#afa' : '#faa'
    });
    //*/
    await browser.close();
}

main().catch(console.error);

function createSvg({
                       dataURI,
                       width,
                       height,
                       svgFilename,
                       backgroundColor = '#ff0',
                       borderWidth = 1,
                       borderRadius = 12,
                       padding = 0
                   }) {
    const newWidth = width + 2 * borderWidth + 2 * padding;
    const newHeight = height + 2 * borderWidth + 2 * padding;

    const svgWithBorder = `<svg 
    width="${newWidth}" 
    height="${newHeight}" 
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <clipPath id="rounded-clip">
            <rect 
                x="${borderWidth / 2}" 
                y="${borderWidth / 2}" 
                width="${newWidth - borderWidth}" 
                height="${newHeight - borderWidth}" 
                rx="${borderRadius}" 
                ry="${borderRadius}"
            />
        </clipPath>
    </defs>

    <!-- Background -->
    <rect 
        x="${borderWidth / 2}" 
        y="${borderWidth / 2}" 
        width="${newWidth - borderWidth}" 
        height="${newHeight - borderWidth}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="${backgroundColor}"
    />

    <!-- Embedded SVG as Image -->
    <g clip-path="url(#rounded-clip)">
        <g transform="translate(${padding + borderWidth}, ${padding + borderWidth})">
            <image href="${dataURI}" width="${width}" height="${height}" />
        </g>
    </g>

    <!-- Border -->
    <rect 
        x="${borderWidth / 2}" 
        y="${borderWidth / 2}" 
        width="${newWidth - borderWidth}" 
        height="${newHeight - borderWidth}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="none" 
        stroke="#000000" 
        stroke-width="${borderWidth}"
    />
</svg>`;

    fs.writeFileSync(svgFilename, `<?xml version="1.0" encoding="UTF-8"?>\n${svgWithBorder}`);
}