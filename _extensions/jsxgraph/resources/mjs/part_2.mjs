import path from 'path';
import fs from "fs";

const svgFilename = process.argv[2] || 'board.svg';
const args = process.argv.slice(2);
const options = {};
for (let i = 1; i < args.length; i++) {
    const [key, value] = args[i].split("=");
    if (key && value !== undefined) {
        const numValue = Number(value);
        options[key] = isNaN(numValue) ? value : numValue;
    }
}

let width = options.width || 800;
let height = options.height || 600;
let style = options.style || "";
let src_jxg = options.src_jxg || "https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js";
let dom = options.dom || 'chrome';
let src_mjx = options.src_mjx || '';
let src_css = options.src_css || 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css';
let uuid = options.uuid || 'jxg_box';
let unit = options.unit || "px";
let textwidth = options.textwidth || "14cm";

// Hilfsfunktionen
function getUnit(value) {
    const match = value.toString().match(/[a-z%]+$/i);
    return match ? match[0] : '';
}
function getNumber(value) {
    const match = value.toString().match(/^[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
}

let textUnit = getUnit(textwidth);
let textNum = getNumber(textwidth);
let widthNum = getNumber(width);
let heightNum = getNumber(height);

if (unit === "%") {
    width = ((widthNum / 100) * textNum).toFixed(4);
    height = ((heightNum / 100) * textNum).toFixed(4);
    unit = textUnit;
}
