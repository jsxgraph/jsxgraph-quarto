 -- JSXGraph

function CodeBlock(content)
  if content.classes:includes("jsxgraph") then

    -- generate id

    math.randomseed(os.time() + os.clock()*1000000)
    local function uuid()
        local template ='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
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

    -- separate first line and read width and height

    local function tokenizer(input, delimiter)
        local tokens = {}
        local escaped_delim = delimiter:gsub("([%^%$%(%)%%%.%[%]%*%+%-%?])", "%%%1")
        local pattern = "([^" .. escaped_delim .. "]*)"
        for token in string.gmatch(input, pattern .. escaped_delim .. "?") do
            if token ~= "" then
                table.insert(tokens, token)
            end
        end
        return tokens
    end

    -- set width and heiht

    local width = ''
    local height = ''

    local first = tokenizer(jsxgraph,  '\n')[1]

    if first:match('initBoard') then
      width = '500px'
      height = '500px'
    else
      local size = tokenizer(first, ' ')
      width = size[1]
      height = size[2]
      jsxgraph = jsxgraph:gsub("^[^\n]*\n", "")
    end

    -- replace id
    jsxgraph = jsxgraph:gsub([[initBoard%s*%(%s*(['"])[^'"]*%1%s*,]], 'initBoard("' .. id .. '",')


    local file = io.open(id .. ".js", "w")


    local save = "import JXG from 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.mjs';"
    save = save .. jsxgraph

    file:write(save)
    file:close()




    -- local handle = io.popen('node ' .. id .. '.js')
    local handle = io.popen('node loadJSX.js')
    local output = handle:read('*a')
    handle:close()
    local json = require('dkjson')
    local data = json.decode(output)

    -- print(data.sum)


    -- output html
    return pandoc.RawBlock("html", 'Test')

  else
    return content
  end
end