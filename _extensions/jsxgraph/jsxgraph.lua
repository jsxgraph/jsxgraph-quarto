 -- JSXGraph filter

--[[
  MIT License, see file LICENSE
]]

--- Extension name constant
local EXTENSION_NAME = "jsxgraph"

function CodeBlock(content)
  if content.classes:includes("jsxgraph") then

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

    --[[
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
    --]]

    -- Parse options

    --[[
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
    --]]

    local attr
    -- Global _quarto.yml should be here

    -- Document yml

    attr = quarto.metadata.get('jsxgraph')
    -- quarto.log.output('|>', quarto.metadata.get('jsxgraph'))

    -- Options in page yml
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

    -- Options in code block

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

    -- iframe file - AW: no, send base64 string to src attribute
    --[[
    local file = io.open(id .. ".html", "w")
    --]]

    local save =  '<!DOCTYPE html>\n'
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
    save = save .. '    <div id="'..id..'" class="jxgbox" style="width: 100%; height: 100%; display: block; object-fit: fill; box-sizing: border-box;"></div>\n'
    save = save .. '    <script>\n'
    save = save .. jsxgraph .. '\n'
    save = save .. '    </script>\n'
    save = save .. '  </body>\n'
    save = save .. '</html>\n'

  --[[
    file:write(save)
    file:close()

    -- iframe
    local iframe = '<iframe src="' .. id .. '.html" width="' .. width .. '" height="' .. height .. '" style=""></iframe>\n'
  --]]

    -- iframe
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

    -- output html
    return pandoc.RawBlock("html", iframe)

  else
    return content
  end
end
