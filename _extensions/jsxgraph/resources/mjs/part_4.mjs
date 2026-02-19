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
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
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