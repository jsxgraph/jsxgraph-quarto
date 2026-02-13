

const boxDiv = dom.window.document.getElementById('jxg_box');
const svgElement = boxDiv.querySelector('svg');

if (svgElement) {
    const originalWidth = parseFloat(svgElement.getAttribute('width')) || 100;
    const originalHeight = parseFloat(svgElement.getAttribute('height')) || 100;

    const borderWidth = 2;
    const borderRadius = 12;
    const padding = 0;
    const backgroundColor = '#f0f0f0';

    const newWidth = originalWidth + (2 * padding) + (2 * borderWidth);
    const newHeight = originalHeight + (2 * padding) + (2 * borderWidth);

    const clipX = borderWidth / 2;
    const clipY = borderWidth / 2;
    const clipWidth = newWidth - borderWidth;
    const clipHeight = newHeight - borderWidth;

    const innerContent = svgElement.innerHTML;

    const svgWithBorder = `<svg width="${newWidth}" height="${newHeight}" xmlns="http://www.w3.org/2000/svg"${svgElement.outerHTML.includes('xlink:href') ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''}>
    <defs>
        <clipPath id="rounded-clip">
            <rect x="${clipX}" y="${clipY}" 
                  width="${clipWidth}" 
                  height="${clipHeight}" 
                  rx="${borderRadius}" ry="${borderRadius}"/>
        </clipPath>
    </defs>
    <rect x="${clipX}" y="${clipY}" 
          width="${clipWidth}" 
          height="${clipHeight}" 
          rx="${borderRadius}" ry="${borderRadius}"
          fill="${backgroundColor}"/>
    <g clip-path="url(#rounded-clip)">
        <g transform="translate(${padding + borderWidth}, ${padding + borderWidth})">
            ${innerContent}
        </g>
    </g>
    <rect x="${clipX}" y="${clipY}" 
          width="${clipWidth}" 
          height="${clipHeight}" 
          rx="${borderRadius}" ry="${borderRadius}"
          fill="none" 
          stroke="#000000" 
          stroke-width="${borderWidth}"/>
</svg>`;

    const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${svgWithBorder}`;
    fs.writeFileSync(svgFilename, fullSvg);
}

// SVG without border, clipping, background

if (false) {

    let svgContent = svgElement.outerHTML;

    if (!svgContent.includes('xmlns=')) {
        svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (svgContent.includes('xlink:href') && !svgContent.includes('xmlns:xlink')) {
        svgContent = svgContent.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${svgContent}`;

    fs.writeFileSync(svgFilename, fullSvg);
}