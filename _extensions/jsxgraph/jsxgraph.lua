-- JSXGraph filter
--[[
  MIT License, see file LICENSE
]] --- Extension name constant
local EXTENSION_NAME = "jsxgraph"

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

local function render_graph(globalOptions)

    local CodeBlock = function(content)
        if content.classes:includes("jsxgraph") then

            -- Initialise options table
            local options = copyTable(globalOptions)

            -- generate id

            math.randomseed(os.time() + os.clock() * 1000000)
            local function uuid()
                local template = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                return string.gsub(template, '[xy]', function(c)
                    local r = math.random(0, 15)
                    if c == 'x' then
                        return string.format('%x', r)
                    else
                        return string.format('%x', (r % 4) + 8)
                    end
                end)
            end

            local id = uuid()

            -- JSXGraph JavaScript
            local jsxgraph = content.text

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
                        -- quarto.log.output('>>>', k, options[k])
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

            -- replace BOARDID

            jsxgraph = jsxgraph:gsub("initBoard%(%s*BOARDID%s*,", 'initBoard("' .. id .. '",')

            -- replace id

            jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("' .. id .. '",')

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

            -- Create iframe
            local jsx_b64 = 'data:text/html;base64,' .. quarto.base64.encode(save);
            local iframe = '<iframe '
            if options['iframe_id'] ~= nil then
                iframe = iframe .. ' id="' .. options['iframe_id'] .. '" '
            end
            iframe = iframe .. ' src="' .. jsx_b64 .. '" '
            iframe = iframe .. ' sandbox="allow-scripts" '
            iframe = iframe .. ' width="' .. options['width'] .. '"'
            iframe = iframe .. ' height="' .. options['height'] .. '"'
            iframe = iframe .. ' class="' .. options['class'] .. '"'
            iframe = iframe .. ' style="' .. options['style'] .. '"'
            iframe = iframe .. '></iframe>\n'

            -- Output html
            return pandoc.RawBlock("html", iframe)

        else
            return content
        end
    end

    local DecoratedCodeBlock = function(node)
        -- quarto.log.output('>>> execute DecoratedCodeBlock')
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
        style = 'border: 1px solid black; border-radius: 10px;',
        class = '',
        showSrc = false,
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

    return doc:walk(render_graph(options))
end
