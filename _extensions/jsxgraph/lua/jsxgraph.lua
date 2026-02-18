-- JSXGraph filter
--[[
  MIT License, see file LICENSE
]]

--- Extension name constant

local EXTENSION_NAME = "JSXGraph"

-- Counter for JSXGraph boards.

local svg_counter = 0

local script_path = PANDOC_SCRIPT_FILE
local lua_dir = pandoc.path.directory(script_path)
local extension_dir = pandoc.path.directory(lua_dir)

-- Helper function to copy a table.

local function copyTable(obj, seen)

    -- Handle non-tables and previously-seen tables.

    if type(obj) ~= 'table' then
        return obj
    end
    if seen and seen[obj] then
        return seen[obj]
    end

    -- New table; mark it as seen and copy recursively.

    local s = seen or {}
    local res = {}
    s[obj] = res
    for k, v in pairs(obj) do
        res[copyTable(k, s)] = copyTable(v, s)
    end
    return setmetatable(res, getmetatable(obj))
end

-- Helper for non empty string.

local function is_nonempty_string(x)
    return x ~= nil and type(x) == "string"
end

-- Read file.
local function ioRead(file)
    local ioFile = io.open(file, "r")
    local ioContent = ioFile:read("*a")
    ioFile:close()
    return ioContent
end

-- Write file.
local function ioWrite(file, content)
    local ioFile = io.open(file, "w")
    ioFile:write(content)
    ioFile:close()
end

local function dir_exists(path)
    local ok, err, code = os.rename(path, path)
    if ok then
        return true
    else
        -- code 13 = Permission denied.
        -- code 2 = No such file or directory.
        return code == 13
    end
end

-- Create hidden directory.

local function ensure_hidden_dir(path)
    if dir_exists(path) then
        return -- Verzeichnis existiert bereits
    end
    if package.config:sub(1,1) == "\\" then
        -- Windows.
        os.execute('mkdir "' .. path .. '"')
        os.execute('attrib +h "' .. path .. '"')
    else
        -- macOS / Linux.
        os.execute('mkdir -p "' .. path .. '"')
    end
end

-- Set directory path.

local function join_path(...)
    local SEP = package.config:sub(1,1)  -- "\\" Windows, "/" Unix
    return table.concat({...}, SEP)
end

-- Remove file if exists.

local function remove_file(path)
    if dir_exists(path) then
        local success, err = os.remove(path)
    end
end

local function uuid()
    local template = 'xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxx'
    return 'JXG' .. string.gsub(template, '[xy]', function(c)
        local r = math.random(0, 15)
        if c == 'x' then
            return string.format('%x', r)
        else
            return string.format('%x', (r % 4) + 8)
        end
    end)
end

local function render_jsxgraph(globalOptions)

    function CodeBlock(content)

        if content.classes:includes("jsxgraph") then

            -- Initialise options table.

            local options = copyTable(globalOptions)

            -- Parse options.

            local attr

            -- Global _quarto.yml should be here.

            -- Read options from document yml.

            if quarto.metadata ~= nil then
                attr = quarto.metadata.get('jsxgraph')
                if type(attr) == "table" then
                    for k, v in pairs(attr) do
                        if k == 'style' then
                            options[k] = options[k] .. pandoc.utils.stringify(v)
                        else
                            options[k] = pandoc.utils.stringify(v)
                        end
                    end
                end
            end

            -- Read options in code block.

            attr = content.attr.attributes
            if type(attr) == "userdata" then
                for k, v in pairs(attr) do
                    if k == 'style' then
                        options[k] = options[k] .. pandoc.utils.stringify(v)
                    else
                        options[k] = pandoc.utils.stringify(v)
                    end
                end
            end

            -- Generate id as uuid.

            math.randomseed(os.time() + os.clock() * 1000000)
            local id = uuid()

            -- Next JSXGraph board.

            svg_counter = svg_counter + 1

            -- JSXGraph – javascript code.

            local jsxgraph = content.text

            -- Replace const BOARDID, e.g. code from https://jsxgraph.org/share.

            jsxgraph = jsxgraph:gsub("initBoard%(%s*BOARDID%s*,", 'initBoard("jxg_box",')

            -- Replace id by uuid.

            jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("' .. id .. '",')

            -- Default value 'render'.

            local render = 'svg'

            -- Set 'render'.

            if quarto.doc.is_format("html") then
                render = options['render']
            end

            -- Set 'echo'.

            if is_nonempty_string(options.echo) then
                options.echo = options.echo == "true"
            end

            if render == 'svg' then

                -- Export svg.

                -- Hidden directory for mjs and svg files.

                local temp_dir = ".temp_jsxgraph"
                ensure_hidden_dir(temp_dir)

                -- Prefix for files.

                local prefix = "file_" .. svg_counter .. "_"

                -- Set file paths and remove files if exit.

                local file_node_path = join_path(temp_dir, prefix .. "code_node_board.mjs")
                remove_file(file_node_path)
                local file_svg_path = join_path(temp_dir, prefix .. "board.svg")
                remove_file(file_svg_path)

                -- Create mjs file for nodejs.

                local use_file = ioRead(pandoc.path.join({extension_dir, "resources", "mjs", "use_" .. options['dom'] .. ".mjs"}))
                local svg_file = ioRead(pandoc.path.join({extension_dir, "resources", "mjs",  "svg.mjs"}))
                local content_node = use_file .. jsxgraph .. svg_file .. [[
                ]]
                ioWrite(file_node_path, content_node)

                -- Create nodejs command.

                local node_cmd = ''

                node_cmd = string.format(
                    "node " .. file_node_path .. " " .. file_svg_path .. " width=%q height=%q style=%q src_jxg=%q src_mjx=%q src_css=%q dom=%q unit=%q uuid=%q",
                    options['width'],
                    options['height'],
                    options['style'],
                    options['src_jxg'],
                    options['src_mjx'],
                    options['src_css'],
                    options['dom'],
                    options['unit'],
                    id -- uuid
                )

                --quarto.log.output(node_cmd)

                -- Execute nodejs command.

                local handle = io.popen(node_cmd)
                local result = handle:read("*a")
                handle:close()

                -- Create svg file.

                local svg_file = ioRead(file_svg_path)

                -- Create pandoc.Image.

                local img = pandoc.Image({}, file_svg_path, "")
                local svg_code = pandoc.Para({img})

                -- Return content with/without JSXGRaph code.

                if options.echo then
                    local codeBlock = pandoc.CodeBlock(content.text, {class='javascript'})
                    return pandoc.Div({svg_code, codeBlock})
                else
                    return svg_code
                end
            else

                -- Export html.

                -- Code for <div> and <iframe>.

                local html = ''

                -- Code for <iframe>.

                -- Create iframe content.

                if not options['src_jxg']:match("^http") then
                    local jsxgraph_local = ioRead(pandoc.path.join({extension_dir, "resources", "js", "jsxgraphcore.js"}))
                    options['src_jxg'] = 'data:text/javascript;base64,' .. quarto.base64.encode(jsxgraph_local)
                end


                if options['src_css'] ~= '' then
                    local css_local = ioRead(pandoc.path.join({extension_dir, "resources", "css", "jsxgraph.css"}))
                    options['src_css'] = 'data:text/css;base64,' .. quarto.base64.encode(css_local)
                end

                local icontent = string.format([[
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <!-- Include MathJax -->
    <script id="MathJax-script" async src="%s"></script>
    <!-- Include JSXGraph -->
    <script src="%s"></script>
    <!-- Include CSS -->
    <style>
        @import url("%s");
    </style>
    <style>
      html, body { margin: 0; padding: 0; width: 100%%; height: 100%%; }
      .jxgbox { border: none; border-radius: 0px; }
    </style>
  </head>
  <body>
    <div id="%s" class="jxgbox" style="width: 100%%; height: 100%%; display: block; object-fit: fill; box-sizing: border-box;"></div>
    <script>
%s
    </script>
  </body>
</html>
]], options['src_mjx'], options['src_jxg'], options['src_css'], id, jsxgraph)

                -- Base64 of iframe content.

                local jsx_b64 = 'data:text/html;base64,' .. quarto.base64.encode(icontent);

                -- Create iframe.

                local iframe = '<iframe '
                if options['iframe_id'] ~= nil then
                    iframe = iframe .. ' id="' .. options['iframe_id'] .. '" '
                end
                iframe = iframe .. ' src="' .. jsx_b64 .. '" '
                iframe = iframe .. ' sandbox="allow-scripts  allow-same-origin" '

                -- Set width an height.

                iframe = iframe .. ' class="' .. options['class'] .. '"'
                iframe = iframe .. ' style="width:' .. options['width'] .. options['unit'] .. '; height:' .. options['height'] .. options['unit'].. ';position: relative; margin:0; padding:0; display: block; z-index: 1; ' .. options['style'] .. ';"'
                iframe = iframe .. ' name="iframe' .. id .. '"'
                iframe = iframe .. '></iframe>\n'

                -- Set reload option.

                if is_nonempty_string(options.reload) then
                    options.reload = options.reload == "true"
                end

                -- Add iframe.

                if options.reload then

                    -- Fix div vs iframe margin differences.

                    -- ToDo: Different behaviour in revealjs.

                    local margin_b = 10;
                    if options.echo then
                        margin_b = -8
                    end

                    -- Add reload button.

                    html = '<div style="border: none; margin-bottom: ' .. margin_b .. 'px; position: relative; display: inline-block;\n">'
                    html = html .. '<button  id="button' .. id .. '" style="position: absolute; bottom: 0px; left: 2px; z-index: 2; background-color: transparent; color: #000000; border: none; font-size: 16px; cursor: pointer;">&#x21BA;</button>\n'
                    html = html .. iframe .. '\n'
                    html = html .. '</div>\n'
                    html = html .. '<script>\n'
                    html = html .. '    const btn' .. id .. ' = document.getElementById("button' .. id .. '");\n'
                    html = html .. '    const iframe' .. id .. ' = document.getElementsByName("iframe' .. id .. '")[0]\n'
                    html = html .. '    btn' .. id .. '.addEventListener("click", () => { iframe' .. id .. '.src = iframe' .. id .. '.src; });\n'--contentWindow.location.reload();
                    html = html .. '</script>\n'
                else
                    html = iframe
                end

                -- Create pandoc.RawBlock.

                local html_code = pandoc.RawBlock("html", html)

                -- Return content with/without JSXGRaph code.

                if options.echo then
                    local codeBlock = pandoc.CodeBlock(content.text, {class='javascript'})
                    return pandoc.Div({html_code, codeBlock})
                else
                    return html_code
                end
            end
        end
    end

    return {
        CodeBlock = CodeBlock
    }
end

function Pandoc(doc)

    ---Configuration options for the extension
    ---@type table<string, any>

    local options = {
        iframe_id = nil,
        width = '400',
        height = '400',
        render = 'iframe',
        dom = 'chrome',
        style = 'border: 1px solid black; border-radius: 10px;',
        class = '',
        echo = false,
        unit = 'px',
        reload = false,
        src_jxg = pandoc.path.join({extension_dir, "resources", "js", "jsxgraphcore.js"}), --'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js',
        src_css = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css',
        src_mjx = 'https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-svg.js'
    }

    -- Process global attributes.

    local globalOptions = doc.meta["jsxgraph"]
    if type(globalOptions) == "table" then
        for k, v in pairs(globalOptions) do
            options[k] = pandoc.utils.stringify(v)
        end
    end

    return doc:walk(render_jsxgraph(options))
end
