});

const svgElement = await page.$eval("#jxg_box svg", el => el.outerHTML);

const borderWidth = 1;
const borderRadius = 12;
const padding = 10;
const backgroundColor = '#ff0';
const newWidth = width + 2*borderWidth + 2*padding;
const newHeight = height + 2*borderWidth + 2*padding;

function sanitizeSVGContent(content) {
    return content
        .replace(/xlink:href=/g, 'href=')   // xlink:href → href
        .trim();
}

const sanitizedInnerContent = sanitizeSVGContent(svgElement);

const svgWithBorder = `<svg 
    width="${newWidth}" 
    height="${newHeight}" 
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <clipPath id="rounded-clip">
            <rect 
                x="${borderWidth/2}" 
                y="${borderWidth/2}" 
                width="${newWidth - borderWidth}" 
                height="${newHeight - borderWidth}" 
                rx="${borderRadius}" 
                ry="${borderRadius}"
            />
        </clipPath>
    </defs>

    <!-- Background. -->
    <rect 
        x="${borderWidth/2}" 
        y="${borderWidth/2}" 
        width="${newWidth - borderWidth}" 
        height="${newHeight - borderWidth}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="${backgroundColor}"
    />

    <!-- Content within clips. -->
    <g clip-path="url(#rounded-clip)">
        <g transform="translate(${padding + borderWidth}, ${padding + borderWidth})">
            ${sanitizedInnerContent}
        </g>
    </g>

    <!-- Border. -->
    <rect 
        x="${borderWidth/2}" 
        y="${borderWidth/2}" 
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

console.log(`SVG erfolgreich erstellt: ${svgFilename}`);

await browser.close();
}

main().catch(console.error);