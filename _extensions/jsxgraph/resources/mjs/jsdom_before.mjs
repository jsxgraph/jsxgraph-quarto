import { JSDOM } from 'jsdom';
import fs from 'fs';

const svgFilename = process.argv[2] || 'board.svg';
const args = process.argv.slice(2);
const options = {};
for (let i = 1; i < args.length; i++) {
    const [key, value] = args[i].split("=");
    //if (key && value) options[key] = value;
    if (key && value !== undefined) {
        const numValue = Number(value);
        options[key] = isNaN(numValue) ? value : numValue;
    }
}

var width = options.width || null;
var height = options.height || null;
var style = options.style || '';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="jxg_box" style="width:' + width + 'px; height:' + height + 'px;"></div></body></html>');

global.window = dom.window;
global.document = dom.window.document;

Object.defineProperty(global, 'navigator', {
    value: {
        userAgent: 'Node.js',
        appVersion: '5.0',
        platform: 'Node',
        ...dom.window.navigator
    },
    writable: true,
    configurable: true
});

global.window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
});

global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords() { return []; }
};

global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
};

const JXG = await import('jsxgraph');
JXG.Options.text.display = 'inline';
