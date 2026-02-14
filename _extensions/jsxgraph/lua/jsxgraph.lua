-- JSXGraph filter
--[[
  MIT License, see file LICENSE
]] --- Extension name constant

local EXTENSION_NAME = "jsxgraph"

quarto.log.output("Version 0.9.6")

-- Counter for JSXGraph boards

local svg_counter = 0

local script_path = PANDOC_SCRIPT_FILE
local lua_dir = pandoc.path.directory(script_path)
local extension_dir = pandoc.path.directory(lua_dir)

-- Helper function to copy a table
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

-- Helper for non empty string
function is_nonempty_string(x)
    return x ~= nil and type(x) == "string"
end

local function render_jsxgraph(globalOptions)

    function CodeBlock(content)

        if content.classes:includes("jsxgraph") then
            -- Initialise options table
            local options = copyTable(globalOptions)

            -- Parse options

            local attr
            -- Global _quarto.yml should be here
            -- quarto.log.output('>>>', content.meta)

            -- Read options from document yml

            if quarto.metadata ~= nil then
                attr = quarto.metadata.get('jsxgraph')
                if type(attr) == "table" then
                    for k, v in pairs(attr) do
                        if k == 'style' then
                            options[k] = options[k] .. pandoc.utils.stringify(v)
                        else
                            options[k] = pandoc.utils.stringify(v)
                        end
                        --quarto.log.output('>>>', k, options[k])
                    end
                end
            end

            -- Read options in code block

            attr = content.attr.attributes
            if type(attr) == "userdata" then
                for k, v in pairs(attr) do
                    if k == 'style' then
                        options[k] = options[k] .. pandoc.utils.stringify(v)
                    else
                        options[k] = pandoc.utils.stringify(v)
                    end
                    -- quarto.log.output(k, options[k])
                end
            end

            -- generate id

            math.randomseed(os.time() + os.clock() * 1000000)
            local function uuid()
                local template = 'xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx'
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

            -- next JSXGraph board

            svg_counter = svg_counter + 1

            -- JSXGraph

            local jsxgraph = content.text

            local render = 'svg'

            if quarto.doc.is_format("html") then
                render = options['render']
                -- quarto.log.output('html:' .. render)
            end

            if render == 'svg' then
                --svg

                -- replace BOARDID od '...' by 'jxg_box'

                jsxgraph = jsxgraph:gsub("initBoard%(%s*BOARDID%s*,", 'initBoard("jxg_box",')
                jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("jxg_box",')

                -- Create mjs file for nodejs

                local resource_before = pandoc.path.join({extension_dir, "resources", "mjs", "code_before_board.mjs"})

                local file_before = io.open(resource_before, "r")
                local content_before = file_before:read("*a")
                file_before:close()

                local resource_after = pandoc.path.join({extension_dir, "resources", "mjs", "code_after_board.mjs"})

                local file_after = io.open(resource_after, "r")
                local content_after = file_after:read("*a")
                file_after:close()

                -- Delete existing file
                --os.remove("code_node_board.mjs")

                local function ensure_hidden_dir(path)
                  if package.config:sub(1,1) == "\\" then
                    -- Windows
                    os.execute('mkdir "' .. path .. '"')
                    os.execute('attrib +h "' .. path .. '"')
                  else
                    -- macOS / Linux
                    os.execute('mkdir -p "' .. path .. '"')
                  end
                end

                local function join_path(...)
                  local SEP = package.config:sub(1,1)  -- "\\" Windows, "/" Unix
                  return table.concat({...}, SEP)
                end

                local temp_dir = ".temp_jsxgraph"

                -- Prefix for files
                local prefix = "file_" .. svg_counter .. "_"

                ensure_hidden_dir(temp_dir)

                local file_node_path = join_path(temp_dir, prefix .. "code_node_board.mjs")
                local file_svg_path = join_path(temp_dir, prefix .. "board.svg")

                -- New mjs file
                local file_node = io.open(file_node_path, "w")

                -- Merge content
                local content_node = content_before .. jsxgraph .. content_after .. [[
                ]]
                file_node:write(content_node)
                file_node:close()

                local node_cmd = string.format(
                    "node " .. file_node_path .. " " .. file_svg_path .. " width=%q height=%q style=%q",
                    options['width'],
                    options['height'],
                    options['style']
                )

                -- Execute nodejs
                local handle = io.popen(node_cmd)
                local result = handle:read("*a")
                handle:close()

                -- SVG file
                local svg_file = io.open(file_svg_path, "r")
                svg_file:close()
                local img = pandoc.Image({}, file_svg_path, "")
                return pandoc.Para({img})
            else
                -- replace BOARDID

                local html_content = ''

                jsxgraph = jsxgraph:gsub("initBoard%(%s*BOARDID%s*,", 'initBoard("' .. id .. '",')

                -- replace id

                jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("' .. id .. '",')

                if options['render'] == 'div' then
                    html_content = html_content .. '<div id="' .. id .. '" style="width: ' .. options['width'] .. 'px; height: ' .. options['height'] .. 'px; position: relative; overflow: hidden; background-color: #fff; border-style: solid; border-width: 1px; border-color: #356aa0; border-radius: 10px; -webkit-border-radius: 10px; margin: 0; -ms-touch-action: none;"></div>\n'
                    html_content = html_content .. '<script type="module">\n'
                    html_content = html_content .. '    import JXG from "https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.mjs";\n'
                    html_content = html_content .. jsxgraph .. '\n'
                    html_content = html_content .. '</script>\n'
                else
                    local save = '<!DOCTYPE html>\n'
                    save = save .. '<html lang="en">\n'
                    save = save .. '  <head>\n'
                    save = save .. '    <meta charset="UTF-8">\n'
                    save = save .. '    <script id="MathJax-script" async src="' .. options['src_mjx'] .. '"></script>'
                    save = save .. '    <script src="' .. options['src_jxg'] .. '"></script>\n'
                    save = save .. '    <link rel="stylesheet" type="text/css" href="' .. options['src_css'] .. '">\n'
                    save = save .. '    <style>\n'
                    save = save .. '      html, body { margin: 0; padding: 0; width: 100%; height: 100%; }\n'
                    save = save .. '      .jxgbox { border: none; }\n'
                    save = save .. '    </style>\n'
                    save = save .. '  </head>\n'
                    save = save .. '  <body>\n'
                    save = save .. '    <div id="' .. id ..
                               '" class="jxgbox" style="width: 100%; height: 100%; display: block; object-fit: fill; box-sizing: border-box;"></div>\n'
                    save = save .. '    <script>\n'
                    save = save .. jsxgraph .. '\n'
                    save = save .. '    </script>\n'
                    save = save .. '  </body>\n'
                    save = save .. '</html>\n'

                    -- quarto.log.output(save)

                    -- Create iframe
                    local jsx_b64 = 'data:text/html;base64,' .. quarto.base64.encode(save);
                    html_content = '<iframe '
                    if options['iframe_id'] ~= nil then
                        html_content = html_content .. ' id="' .. options['iframe_id'] .. '" '
                    end
                    html_content = html_content .. ' src="' .. jsx_b64 .. '" '
                    html_content = html_content .. ' sandbox="allow-scripts" '
                    html_content = html_content .. ' width="' .. options['width'] .. '"'
                    html_content = html_content .. ' height="' .. options['height'] .. '"'
                    html_content = html_content .. ' class="' .. options['class'] .. '"'
                    html_content = html_content .. ' style="' .. options['style'] .. '"'
                    html_content = html_content .. ' name="iframe' .. id .. '"'
                    html_content = html_content .. '></iframe>\n'
                    if options['reload'] == false then
                        html_content = html_content .. '<button  id="button' .. id .. '">&#x21BA;</button>\n'
                        html_content = html_content .. '<script>\n'
                        html_content = html_content .. '    const btn' .. id .. ' = document.getElementsById("button' .. id .. '");\n'
                        html_content = html_content .. '    const iframe' .. id .. ' = document.getElementByName("iframe' .. id .. '")[0]\n'
                        html_content = html_content .. '    btn' .. id .. '.addEventListener("click", () => { iframe' .. id .. '.contentWindow.location.reload(); });\n'
                        html_content = html_content .. '    \n'
                        html_content = html_content .. '</script>\n'
                    end
                end

                if is_nonempty_string(options.echo) then
                    options.echo = options.echo == "true"
                end

                local html_code = pandoc.RawBlock("html", html_content)

                if options.echo == true then
                    -- local codeBlock = pandoc.CodeBlock(content.text, content.attr)
                    local codeBlock = pandoc.CodeBlock(content.text, {class='javascript'})
                    return pandoc.Div({html_code, codeBlock})
                else
                    return iframe_code
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
        echo = true,
        reload = false,
        src_jxg = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js',
        src_css = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css',
        src_mjx = 'https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js'
    }

    -- Process global attributes
    local globalOptions = doc.meta["jsxgraph"]
    if type(globalOptions) == "table" then
        for k, v in pairs(globalOptions) do
            options[k] = pandoc.utils.stringify(v)
        end
    end

    return doc:walk(render_jsxgraph(options))
end
