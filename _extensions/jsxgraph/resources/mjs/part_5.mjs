}, uuid);

const dataURI = await page.evaluate((uuid) => {
    const board = Object.values(JXG.boards)
        .find(b => b.container === uuid);
    if (!board) return null;
    board.setAttribute({showNavigation: false})
    return board.renderer.dumpToDataURI(false); // SVG Data-URI
}, uuid);

const boardOptions = await page.evaluate((uuid) => {
    const board = Object.values(JXG.boards)
        .find(b => b.container === uuid);
    if (!board) return null;
    return {
        borderWidth: getComputedStyle(board.containerObj).borderWidth,
        borderRadius: getComputedStyle(board.containerObj).borderRadius
    }
}, uuid);

createSvg({
    dataURI: dataURI,
    width: parseFloat(width),
    height: parseFloat(height),
    unit: unit,
    svgFilename: svgFilename,
    backgroundColor: "none", //(dom == 'chrome') ? '#afa' : '#faa',
    borderWidth: parseFloat(boardOptions['borderWidth']),
    borderRadius: parseFloat(boardOptions['borderRadius'])
});
//*/
await browser.close();
}

main().catch(console.error);


function createSvg({
                       dataURI,
                       width,
                       height,
                       unit,            // "px", "em", "rem", "cm", "mm", "in", "pt"
                       svgFilename,
                       backgroundColor,
                       borderWidth,     // in px
                       borderRadius,    // in px
                       padding = 0      // in px
                   }) {
    const wNum = parseFloat(width);
    const hNum = parseFloat(height);
    const bw = parseFloat(borderWidth);
    const br = parseFloat(borderRadius);
    const p = parseFloat(padding);

    let factor = 1;
    switch(unit) {
        case "px": factor = 1; break;
        case "em": factor = 16; break;
        case "rem": factor = 16; break;
        case "cm": factor = 37.7952755906; break;
        case "mm": factor = 3.7795275591; break;
        case "in": factor = 96; break;
        case "pt": factor = 96/72; break;
        default: factor = 1; break;
    }

    const svgWidthPx = wNum * factor + 2 * bw + 2 * p;
    const svgHeightPx = hNum * factor + 2 * bw + 2 * p;

    const svgContent = `
<svg 
    width="${wNum}${unit}" 
    height="${hNum}${unit}" 
    viewBox="0 0 ${svgWidthPx} ${svgHeightPx}" 
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <clipPath id="rounded-clip">
            <rect 
                x="${bw/2}" 
                y="${bw/2}" 
                width="${svgWidthPx - bw}" 
                height="${svgHeightPx - bw}" 
                rx="${br}" 
                ry="${br}"
            />
        </clipPath>
    </defs>

    <!-- Background -->
    <rect 
        x="${bw/2}" 
        y="${bw/2}" 
        width="${svgWidthPx - bw}" 
        height="${svgHeightPx - bw}" 
        rx="${br}" 
        ry="${br}"
        fill="${backgroundColor}"
    />

    <!-- Embedded SVG as Image -->
    <g clip-path="url(#rounded-clip)">
        <g transform="translate(${bw + p}, ${bw + p})">
            <image href="${dataURI}" width="${wNum * factor}" height="${hNum * factor}" />
        </g>
    </g>

    <!-- Border -->
    <rect 
        x="${bw/2}" 
        y="${bw/2}" 
        width="${svgWidthPx - bw}" 
        height="${svgHeightPx - bw}" 
        rx="${br}" 
        ry="${br}"
        fill="none" 
        stroke="#000000" 
        stroke-width="${bw}"
    />
</svg>
`;

    fs.writeFileSync(svgFilename, `<?xml version="1.0" encoding="UTF-8"?>\n${svgContent}`);
}