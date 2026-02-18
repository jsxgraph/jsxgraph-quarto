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
        backgroundColor: (dom == 'chrome') ? '#afa' : '#faa',
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

        // Umrechnung absolute Einheiten in px (SVG Standard: 96dpi)
        let factor = 1;
        switch(unit) {
            case "px": factor = 1; break;
            case "em": factor = 17; break;   // gewünschter Wert
            case "rem": factor = 17; break;
            case "cm": factor = 37.7952755906; break; // 1cm = 37.795px
            case "mm": factor = 3.7795275591; break;  // 1mm = 3.779px
            case "in": factor = 96; break;           // 1in = 96px
            case "pt": factor = 96/72; break;        // 1pt = 1/72in
            default: factor = 1; break;
        }

        // SVG-Gesamtgröße in px für Border & Padding
        const svgWidthPx = wNum * factor + 2 * bw + 2 * p;
        const svgHeightPx = hNum * factor + 2 * bw + 2 * p;

        const svgWithBorder = `<svg 
    width="${svgWidthPx}px" 
    height="${svgHeightPx}px" 
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <clipPath id="rounded-clip">
            <rect 
                x="${bw/2}px" 
                y="${bw/2}px" 
                width="${svgWidthPx - bw}px" 
                height="${svgHeightPx - bw}px" 
                rx="${br}px" 
                ry="${br}px"
            />
        </clipPath>
    </defs>

    <!-- Background -->
    <rect 
        x="${bw/2}px" 
        y="${bw/2}px" 
        width="${svgWidthPx - bw}px" 
        height="${svgHeightPx - bw}px" 
        rx="${br}px" 
        ry="${br}px" 
        fill="${backgroundColor}"
    />

    <!-- Embedded SVG as Image -->
    <g clip-path="url(#rounded-clip)">
        <g transform="translate(${p + bw}px, ${p + bw}px)">
            <image href="${dataURI}" width="${wNum}${unit}" height="${hNum}${unit}" />
        </g>
    </g>

    <!-- Border -->
    <rect 
        x="${bw/2}px" 
        y="${bw/2}px" 
        width="${svgWidthPx - bw}px" 
        height="${svgHeightPx - bw}px" 
        rx="${br}px" 
        ry="${br}px" 
        fill="none" 
        stroke="#000000" 
        stroke-width="${bw}px"
    />
</svg>`;

        fs.writeFileSync(svgFilename, `<?xml version="1.0" encoding="UTF-8"?>\n${svgWithBorder}`);
    }