-- JSXGraph filter
--[[
  MIT License, see file LICENSE
]]

--- Extension name constant

local EXTENSION_NAME = "JSXGraph"

-- Activate debugging output.

local debugging = true

-- Debug output.

local function debug_out (text)
    if debugging then
        quarto.log.output(tostring(text))
    end
end

-- Counter for JSXGraph boards.

local svg_counter = 0

local script_path = PANDOC_SCRIPT_FILE
local lua_dir = pandoc.path.directory(script_path)
local extension_dir = pandoc.path.directory(lua_dir)

debug_out('script_path' .. script_path)
debug_out('lua_dir' .. lua_dir)
debug_out('extension_dir' .. extension_dir)

-- Helper function to copy a table.

function copyTable(obj, seen)

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

function is_nonempty_string(x)
    return x ~= nil and type(x) == "string"
end

local function render_jsxgraph(globalOptions)

    function CodeBlock(content)

        if content.classes:includes("jsxgraph") then

            debug_out('JSXGraph block detected.')

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

            -- Generate id.

            math.randomseed(os.time() + os.clock() * 1000000)
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

            local id = uuid()

            debug_out('id' .. id)

            -- next JSXGraph board.

            svg_counter = svg_counter + 1

            debug_out('svg_counter' .. svg_counter)

            -- JSXGraph – javascript code.

            local jsxgraph = content.text

            -- Replace const BOARDID, e.g. code from https://jsxgraph.org/share.

            jsxgraph = jsxgraph:gsub("initBoard%(%s*BOARDID%s*,", 'initBoard("jxg_box",')

            -- Default value 'render'.

            local render = 'svg'

            -- Set 'render'.

            if quarto.doc.is_format("html") then
                render = options['render']
            end

            debug_out('render' .. render)

            -- Set 'echo'.

            if is_nonempty_string(options.echo) then
                options.echo = options.echo == "true"
            end

            debug_out('options.echo' .. tostring(options.echo))

            if render == 'svg' then

                -- Export svg.

                -- Replace id by 'jxg_box'.

                jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("jxg_box",')

                -- Create mjs file for nodejs.

                -- Content mjs file before JSXGraph code.

                local resource_before = pandoc.path.join({extension_dir, "resources", "mjs", "code_before_board.mjs"})

                local file_before = io.open(resource_before, "r")
                local content_before = file_before:read("*a")
                file_before:close()

                -- Content mjs file after JSXGraph code.

-- ToDo: Adopt svg style option in code_after_board.ms.

                local resource_after = pandoc.path.join({extension_dir, "resources", "mjs", "code_after_board.mjs"})

                local file_after = io.open(resource_after, "r")
                local content_after = file_after:read("*a")
                file_after:close()

                -- Create hidden directory.

                local function ensure_hidden_dir(path)
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

                -- Hidden directory for mjs and svg files.

                local temp_dir = ".temp_jsxgraph"
                ensure_hidden_dir(temp_dir)

                -- Prefix for files.

                local prefix = "file_" .. svg_counter .. "_"

                -- Set file paths.

                local file_node_path = join_path(temp_dir, prefix .. "code_node_board.mjs")
                local file_svg_path = join_path(temp_dir, prefix .. "board.svg")

                -- Merge content.

                local content_node = content_before .. jsxgraph .. content_after .. [[
                ]]

                -- Create mjs file.

                local file_node = io.open(file_node_path, "w")
                file_node:write(content_node)
                file_node:close()

                -- Create nodejs command.

                local node_cmd = string.format(
                        "node " .. file_node_path .. " " .. file_svg_path .. " width=%q height=%q style=%q",
                        options['width'],
                        options['height'],
                        options['style']
                )

                -- Execute nodejs command.

                local handle = io.popen(node_cmd)
                local result = handle:read("*a")
                handle:close()

                debug_out('result' .. result)

                -- Create svg file.

                local svg_file = io.open(file_svg_path, "r")
                svg_file:close()

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

                -- Replace id by uuid.

                jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("' .. id .. '",')

                -- Code for <div> and <iframe>.

                local html = ''

                if options['render'] == 'div' then

                    -- Code for <div>.

-- ToDo: Handle width and height with %.
-- ToDo: Content of jsxgraph.css only in style.

                    html = html .. '<div id="' .. id .. '" style="width: ' .. options['width'] .. 'px; height: ' .. options['height'] .. 'px; margin-bottom: 16px; position: relative; overflow: hidden; background-color: #fff; border-style: solid; border-width: 1px; border-color: #356aa0; border-radius: 10px; -webkit-border-radius: 10px; -ms-touch-action: none;' .. options['style'] .. '"></div>\n'
                    html = html .. '<script type="module">\n'

-- ToDo: Insert src_jxg.

                    html = html .. '    import JXG from "https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.mjs";\n'
                    html = html .. jsxgraph .. '\n'
                    html = html .. '</script>\n'
                else

                    -- Code for <iframe>.

                    -- Create iframe content.

                    local icontent = '<!DOCTYPE html>\n'
                    icontent = icontent .. '<html lang="en">\n'
                    icontent = icontent .. '  <head>\n'
                    icontent = icontent .. '    <meta charset="UTF-8">\n'
                    icontent = icontent .. '    <script id="MathJax-script" async src="' .. options['src_mjx'] .. '"></script>'
                    icontent = icontent .. '    <script src="' .. options['src_jxg'] .. '"></script>\n'
                    icontent = icontent .. '    <link rel="stylesheet" type="text/css" href="' .. options['src_css'] .. '">\n'
                    icontent = icontent .. '    <style>\n'
                    icontent = icontent .. '      html, body { margin: 0; padding: 0; width: 100%; height: 100%; }\n'
                    icontent = icontent .. '      .jxgbox { border: none; }\n'
                    icontent = icontent .. '    </style>\n'
                    icontent = icontent .. '  </head>\n'
                    icontent = icontent .. '  <body>\n'
                    icontent = icontent .. '    <div id="' .. id .. '" class="jxgbox" style="width: 100%; height: 100%; display: block; object-fit: fill; box-sizing: border-box;"></div>\n'
                    icontent = icontent .. '    <script>\n'
                    icontent = icontent .. jsxgraph .. '\n'
                    icontent = icontent .. '    </script>\n'
                    icontent = icontent .. '  </body>\n'
                    icontent = icontent .. '</html>\n'

                    -- Base64 of iframe content.

                    local jsx_b64 = 'data:text/html;base64,' .. quarto.base64.encode(icontent);

                    -- Create iframe.

                    local iframe = '<iframe '
                    if options['iframe_id'] ~= nil then
                        iframe = iframe .. ' id="' .. options['iframe_id'] .. '" '
                    end
                    iframe = iframe .. ' src="' .. jsx_b64 .. '" '
                    iframe = iframe .. ' sandbox="allow-scripts  allow-same-origin" '
                    iframe = iframe .. ' width="' .. options['width'] .. '"'
                    iframe = iframe .. ' height="' .. options['height'] .. '"'
                    iframe = iframe .. ' class="' .. options['class'] .. '"'
                    iframe = iframe .. ' style="position: relative; margin:0; padding:0; display: block; z-index: 1; ' .. options['style'] .. ';"'
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

-- ToDo: Button only with px?

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

    local DecoratedCodeBlock = function(node)
        quarto.log.output('>>> execute DecoratedCodeBlock')
        return CodeBlock(node.code_block)
    end

    return {
        CodeBlock = CodeBlock,
        DecoratedCodeBlock = DecoratedCodeBlock
    }

end

function Pandoc(doc)

    ---Configuration options for the extension
    ---@type table<string, any>

    local options = {
        iframe_id = nil,
        width = '500',
        height = '500',
        render = 'iframe',
        style = 'border: 1px solid black; border-radius: 10px;',
        class = '',
        echo = false,
        reload = false,

-- ToDo: How to handle mjs?

        src_jxg = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js',
        src_css = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css',
        src_mjx = 'https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js'
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
