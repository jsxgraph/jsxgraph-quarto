-- JSXGraph filter
--[[
  MIT License, see file LICENSE
]]

local EXTENSION_NAME = "JSXGraph"
local svg_counter = 0

-- Set Paths
local script_path = debug.getinfo(1, "S").source:sub(2)
local lua_dir = pandoc.path.directory(script_path)
local extension_dir = pandoc.path.directory(lua_dir)

-- Helper function to copy a table
local function copyTable(obj, seen)
    if type(obj) ~= 'table' then return obj end
    if seen and seen[obj] then return seen[obj] end
    local s = seen or {}
    local res = {}
    s[obj] = res
    for k, v in pairs(obj) do
        res[copyTable(k, s)] = copyTable(v, s)
    end
    return setmetatable(res, getmetatable(obj))
end

local function is_nonempty_string(x)
    return x ~= nil and type(x) == "string"
end

local function ioRead(file)
    local ioFile, err = io.open(file, "r")
    if not ioFile then error("Cannot open file: " .. file .. "\n" .. (err or "unknown error")) end
    local content = ioFile:read("*a")
    ioFile:close()
    return content
end

local function ioWrite(file, content)
    local ioFile, err = io.open(file, "w")
    if not ioFile then error("Cannot open file for writing: " .. file .. "\n" .. (err or "unknown error")) end
    ioFile:write(content)
    ioFile:close()
end

-- Directory helpers
local function dir_exists(path)
    local ok, _, code = os.rename(path, path)
    if ok then return true else return code == 13 end
end

local function ensure_hidden_dir(path)
    if dir_exists(path) then return end
    if package.config:sub(1,1) == "\\" then
        os.execute('mkdir "' .. path .. '"')
        os.execute('attrib +h "' .. path .. '"')
    else
        os.execute('mkdir -p "' .. path .. '"')
    end
end

-- Temp directory, only once
local TEMP_DIR
local function get_temp_dir()
    if TEMP_DIR then return TEMP_DIR end
    if package.config:sub(1,1) == "\\" then
        TEMP_DIR = os.getenv("TEMP") or ".temp_jsxgraph"
        TEMP_DIR = TEMP_DIR:gsub("\\", "/")
    else
        TEMP_DIR = ".temp_jsxgraph"
    end
    ensure_hidden_dir(TEMP_DIR)
    return TEMP_DIR
end

-- Remove file without checking existence
local function remove_file(path)
    os.remove(path)
end

-- UUID generator
math.randomseed(os.time())
local function uuid()
    local template = 'xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxx'
    return 'JXG' .. string.gsub(template, '[xy]', function(c)
        local r = math.random(0, 15)
        if c == 'x' then return string.format('%x', r) else return string.format('%x', (r % 4) + 8) end
    end)
end

-- Parse number / aspect
local function parseNumber(s)
    if not s or s == "" then return nil end
    s = s:match("^%s*(.-)%s*$")
    return tonumber(s)
end

local function parseAspect(s)
    if not s or s == "" then return 1 end
    s = s:match("^%s*(.-)%s*$")
    local a, b = s:match("([%d%.]+)%s*/%s*([%d%.]+)")
    if a and b then
        local numA, numB = tonumber(a), tonumber(b)
        if numB ~= 0 then return numA / numB else return 1 end
    end
    local n = tonumber(s)
    return n or 1
end

local function calculate_dimensions(widthStr, heightStr, aspectStr)
    local width = parseNumber(widthStr)
    local height = parseNumber(heightStr)
    local aspect = parseAspect(aspectStr)
    if width and not height then height = width / aspect
    elseif height and not width then width = height * aspect
    elseif not width and not height then width = 500; height = width / aspect
    end
    return tostring(width), tostring(height)
end

-- Node runner
local function run_node(node_cmd)
    if package.config:sub(1,1) == "\\" then
        node_cmd = node_cmd:gsub("/", "\\")
    end
    local ok, _, code = os.execute(node_cmd)
    if not ok or code ~= 0 then
        error("Node.js execution failed: " .. node_cmd)
    end
end

-- Join path
local function join_path(...)
    local SEP = package.config:sub(1,1)
    return table.concat({...}, SEP)
end

-- Cache Base64 for speed
local JSXGRAPH_BASE64
local CSS_BASE64

local function load_base64_files()
    if not JSXGRAPH_BASE64 then
        JSXGRAPH_BASE64 = 'data:text/javascript;base64,' .. quarto.base64.encode(ioRead(join_path(extension_dir,"resources","js","jsxgraphcore.js")))
    end
    if not CSS_BASE64 then
        CSS_BASE64 = 'data:text/css;base64,' .. quarto.base64.encode(ioRead(join_path(extension_dir,"resources","css","jsxgraph.css")))
    end
end

-- Render JSXGraph
local function render_jsxgraph(globalOptions)

    function CodeBlock(content)
        if not content.classes:includes("jsxgraph") then return end

        local options = copyTable(globalOptions)
        local attr

        -- Global attributes
        if quarto.metadata then
            attr = quarto.metadata.get('jsxgraph')
            if type(attr) == "table" then
                for k,v in pairs(attr) do options[k] = pandoc.utils.stringify(v) end
            end
        end

        -- CodeBlock attributes
        attr = content.attr.attributes
        if type(attr) == "userdata" then
            for k,v in pairs(attr) do options[k] = pandoc.utils.stringify(v) end
        end

        -- Dimensions
        options.width, options.height = calculate_dimensions(options.width, options.height, options.aspect_ratio)
        local id = uuid()
        options.uuid = id
        svg_counter = svg_counter + 1

        local jsxgraph = content.text
        jsxgraph = jsxgraph:gsub("initBoard%(%s*BOARDID%s*,", 'initBoard("jxg_box",')
        jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("' .. id .. '",')

        local render = 'svg'
        if quarto.doc.is_format("html") then render = options.render end
        if is_nonempty_string(options.echo) then options.echo = options.echo=="true" end

        if render == 'svg' then
            local temp_dir = get_temp_dir()
            local prefix = "file_" .. svg_counter .. "_"
            local file_node_path = join_path(temp_dir, prefix .. "code_node_board.mjs")
            local file_svg_path = join_path(temp_dir, prefix .. "board.svg")

            local content_node2 = string.format([[
import puppeteer from "puppeteer";

            ]]) .. string.format([[

import path from 'path';
import fs from "fs";

let width = "%s";
let height = "%s";
let style = "%s";
let src_jxg = "%s";
let dom = "%s";
let src_mjx = "%s";
let src_css = "%s";
let uuid = "%s";
let unit = "%s";
let textwidth = "%s";
let svgFilename = "%s";

            ]], options.width, options.height, options.style, options.src_jxg, options.dom, options.src_mjx, options.src_css, options.uuid, options.unit, options.textwidth, file_svg_path) .. string.format([[

function getUnit(value) {
    const match = value.toString().match(/[a-z%%]+$/i);
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

if (unit === "%%") {
    width = ((widthNum / 100) * textNum).toFixed(4);
    height = ((heightNum / 100) * textNum).toFixed(4);
    unit = textUnit;
}
            ]]) .. string.format([[

async function main() {
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    await page.setViewport({width: parseInt(width), height: parseInt(height)});

            ]]) .. string.format([[

    await page.setContent(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <!-- Include MathJax -->
    <script id="MathJax-script" defer src="${src_mjx}"></script>
    <!-- Include JSXGraph -->
    <!--<script src="${src_jxg}"></script>-->
    <!-- Include CSS -->
    <style>
        @import url("${src_css}");
    </style>
    <style>
      html, body { margin: 0; padding: 0; width: 100%%; height: 100%%; }
      .jxgbox { border: none; }
    </style>
  </head>
  <body>
    <div id="${uuid}" class="jxgbox" style="width: ${width}${unit}; height: ${height}${unit}; display: block; object-fit: fill; box-sizing: border-box; ${style};"></div>
  </body>
</html>
`);

    if (fs.existsSync(src_jxg)) {
        await page.addScriptTag({ path: path.resolve(src_jxg) });
    } else if (src_jxg.startsWith('http://') || src_jxg.startsWith('https://') || src_jxg.startsWith('file://')) {
        await page.addScriptTag({url: src_jxg});
    }

    await page.evaluate((uuid) => {
            ]]) .. jsxgraph .. string.format([[
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
            ]])

            ioWrite(file_node_path, content_node2)

            local node_cmd = string.format('node "%s" "%s"', file_node_path, file_svg_path)

            run_node(node_cmd)

            local img = pandoc.Image({}, file_svg_path, "")
            local svg_code = pandoc.Para({img})

            if options.echo then
                local codeBlock = pandoc.CodeBlock(content.text, {class='javascript'})
                return pandoc.Div({svg_code, codeBlock})
            else
                return svg_code
            end
        else
            load_base64_files()
            if not options.src_jxg:match("^http") then options.src_jxg = JSXGRAPH_BASE64 end
            if options.src_css ~= '' then options.src_css = CSS_BASE64 end

            local icontent = string.format([[
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script id="MathJax-script" async src="%s"></script>
<script src="%s"></script>
<style>@import url("%s");</style>
<style>html,body{margin:0;padding:0;width:100%%;height:100%%;}.jxgbox{border:none;border-radius:0px;}</style>
</head>
<body>
<div id="%s" class="jxgbox" style="width:100%%;height:100%%;display:block;object-fit:fill;box-sizing:border-box;"></div>
<script>%s</script>
</body>
</html>]], options.src_mjx, options.src_jxg, options.src_css, id, jsxgraph)

            local jsx_b64 = 'data:text/html;base64,' .. quarto.base64.encode(icontent)
            local iframe = '<iframe src="'..jsx_b64..'" class="'..options.class..'" name="iframe'..id..'"'
            if options.unit == "%" then
                iframe = iframe .. ' style="width:'..options.width..options.unit..'; aspect-ratio:'..options.width..'/'..options.height..'; position:relative; margin:0; padding:0; display:block; z-index:1;'..options.style..';"'
            else
                iframe = iframe .. ' style="width:'..options.width..options.unit..'; height:'..options.height..options.unit..'; position:relative; margin:0; padding:0; display:block; z-index:1;'..options.style..';"'
            end
            if options.iframe_id then iframe = iframe .. ' id="'..options.iframe_id..'"' end
            iframe = iframe..' sandbox="allow-scripts"></iframe>'

            local html_code = pandoc.RawBlock("html", iframe)
            if options.echo then
                local codeBlock = pandoc.CodeBlock(content.text, {class='javascript'})
                return pandoc.Div({html_code, codeBlock})
            else
                return html_code
            end
        end
    end

    return {CodeBlock = CodeBlock}
end

function Pandoc(doc)
    local options = {
        iframe_id = nil, width = nil, height = nil, aspect_ratio="1/1", render='iframe',
        dom='chrome', textwidth='20cm', style='border:1px solid black; border-radius:10px;',
        class='', echo=false, unit='px', reload=false,
        src_jxg=join_path(extension_dir,"resources","js","jsxgraphcore.js"),
        src_css=join_path(extension_dir,"resources","css","jsxgraph.css"),
        src_mjx='https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-svg.js'
    }

    local globalOptions = doc.meta["jsxgraph"]
    if type(globalOptions) == "table" then
        for k,v in pairs(globalOptions) do options[k] = pandoc.utils.stringify(v) end
    end

    return doc:walk(render_jsxgraph(options))
end