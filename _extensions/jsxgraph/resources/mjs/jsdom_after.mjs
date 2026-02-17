

const boxDiv = dom.window.document.getElementById('jxg_box');
//const svgElement = boxDiv.querySelector('svg');

const serializer = new dom.window.XMLSerializer();

const svgElement = serializer.serializeToString(boxDiv.querySelector('svg'));

createSvg({
    svgElement: svgElement,
    width: width,
    height: height,
    svgFilename: svgFilename,
    backgroundColor: '#ffa'
});