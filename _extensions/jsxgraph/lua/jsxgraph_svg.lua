-- Counter for JSXGraph boards

local svg_counter = 0

local script_path = PANDOC_SCRIPT_FILE
local lua_dir = pandoc.path.directory(script_path)
local extension_dir = pandoc.path.directory(lua_dir)

if quarto.doc.is_format("html") then
    quarto.log.output('html')
end

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

local function render_svg(globalOptions)

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

            -- next JSXGraph board

            svg_counter = svg_counter + 1

            local jsxgraph = content.text

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

            -- Prefix for files
            local prefix = "file_" .. svg_counter .. "_"

            -- New mjs file
            local file_node = io.open(prefix .. "code_node_board.mjs", "w")

            -- Merge content
            local content_node = content_before .. jsxgraph .. content_after .. [[
            ]]
            file_node:write(content_node)
            file_node:close()

            local node_cmd = string.format(
                "node " .. prefix .. "code_node_board.mjs " .. prefix .. "board.svg width=%q height=%q style=%q",
                options['width'],
                options['height'],
                options['style']
            )

            -- Execute nodejs
            local handle = io.popen(node_cmd)
            local result = handle:read("*a")
            handle:close()

            -- SVG file
            local svg_file = io.open(prefix .. "board.svg", "r")
            svg_file:close()
            local img = pandoc.Image({}, prefix .. "board.svg", "")
            return pandoc.Para({img})
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
        echo = false,
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

    return doc:walk(render_svg(options))
end
