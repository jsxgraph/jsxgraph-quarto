import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPlaywright} from './support/browser.mjs';
const root=new URL('../_extensions/jsxgraph/',import.meta.url);
const receipt=JSON.parse(readFileSync(new URL('upstream-runtime.json',root)));
const lua=readFileSync(new URL('lua/jsxgraph.lua',root),'utf8');
// The extension's keepaspectratio code, as the bridge script runs it.
const keepView=lua.slice(lua.indexOf('  function fit(box, width, height)'),lua.indexOf('  JXG.QuartoAssessment = {'));
test('bundled runtime files match the released package record',()=>{
 assert.equal(receipt.runtimeVersion,'1.14.2');
 for(const [name,sha] of Object.entries(receipt.files))assert.equal(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex'),sha);
});
const playwright=await loadPlaywright();
async function open(name){
 return playwright[name].launch({headless:true,...(name==='chromium' && process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
}
for(const name of (process.env.JXG_TEST_BROWSERS || 'chromium').split(',')) {
 test('JSXGraph alone keeps a hidden board\'s view and explicit units in '+name,{skip:!playwright && 'Playwright unavailable'},async()=>{
  const browser=await open(name);
  try{
   const page=await browser.newPage();
   await page.setContent('<div id="visible" style="width:400px;height:200px"></div><div id="holder" style="display:none;width:400px"><div id="hidden" style="width:100%;height:200px"></div><div id="units" style="width:100%;height:200px"></div></div>');
   await page.addScriptTag({path:fileURLToPath(new URL('resources/js/jsxgraphcore.js',root))});
   const expected=await page.evaluate(()=>{
    const options={boundingbox:[-5,5,5,-5],axis:false,keepaspectratio:false,showCopyright:false,showNavigation:false};
    window.control=JXG.JSXGraph.initBoard('visible',options);control.setBoundingBox([0,10,10,0],false);
    window.hiddenBoard=JXG.JSXGraph.initBoard('hidden',options);hiddenBoard.setBoundingBox([0,10,10,0],false);
    window.unitsBoard=JXG.JSXGraph.initBoard('units',{originX:50,originY:250,unitX:40,unitY:20,axis:false,showCopyright:false,showNavigation:false});
    return {version:JXG.version,bbox:control.getBoundingBox()};
   });
   assert.equal(expected.version,receipt.runtimeVersion);
   await page.evaluate(()=>{document.querySelector('#holder').style.display='';});
   await page.waitForFunction(()=>hiddenBoard.canvasWidth>0 && unitsBoard.canvasWidth>0);
   const actual=await page.evaluate(()=>({bbox:hiddenBoard.getBoundingBox(),units:[unitsBoard.unitX,unitsBoard.unitY],origin:unitsBoard.origin.scrCoords.slice(1)}));
   assert.deepEqual(actual.bbox,expected.bbox);assert.deepEqual(actual.units,[40,20]);assert.deepEqual(actual.origin,[50,250]);
  }finally{await browser.close();}
 });
 // Still open upstream: when this starts to fail without the extension's
 // code, JSXGraph fits the whole box itself and keepView can go.
 test('a narrowed keepaspectratio board shows its whole box only with the extension\'s code in '+name,{skip:!playwright && 'Playwright unavailable'},async()=>{
  const browser=await open(name);
  try{
   const result={};
   for(const wrapped of [false,true]){
    const page=await browser.newPage();
    await page.setContent('<div id="outer" style="width:600px"><div id="box" style="width:100%;height:150px"></div></div>');
    await page.addScriptTag({path:fileURLToPath(new URL('resources/js/jsxgraphcore.js',root))});
    if(wrapped)await page.addScriptTag({content:keepView});
    await page.evaluate(()=>{window.board=JXG.JSXGraph.initBoard('box',{boundingbox:[0,6,14,0],keepaspectratio:true,axis:false,showCopyright:false,showNavigation:false});});
    await page.evaluate(()=>{document.querySelector('#outer').style.width='273px';});
    await page.waitForFunction(()=>board.canvasWidth===273);
    await page.waitForTimeout(100);
    result[wrapped]=await page.evaluate(()=>board.getBoundingBox());
    await page.close();
   }
   const whole=(box)=>box[0]<=1e-9 && box[1]>=6-1e-9 && box[2]>=14-1e-9 && box[3]<=1e-9;
   assert.ok(!whole(result[false]),'JSXGraph alone crops the sides: '+result[false]);
   assert.ok(whole(result[true]),'with the extension the whole box is shown: '+result[true]);
  }finally{await browser.close();}
 });
 test('the home button shows the whole box of a narrowed keepaspectratio board only with the extension\'s code in '+name,{skip:!playwright && 'Playwright unavailable'},async()=>{
  const browser=await open(name);
  try{
   const result={};
   for(const wrapped of [false,true]){
    const page=await browser.newPage();
    await page.setContent('<div id="outer" style="width:600px"><div id="box" style="width:100%;height:150px"></div></div>');
    await page.addScriptTag({path:fileURLToPath(new URL('resources/js/jsxgraphcore.js',root))});
    if(wrapped)await page.addScriptTag({content:keepView});
    await page.evaluate(()=>{window.board=JXG.JSXGraph.initBoard('box',{boundingbox:[0,6,14,0],keepaspectratio:true,axis:false,showCopyright:false,showNavigation:true,showZoom:true});});
    await page.evaluate(()=>{document.querySelector('#outer').style.width='273px';});
    await page.waitForFunction(()=>board.canvasWidth===273);
    await page.waitForTimeout(100);
    await page.evaluate(()=>{board.zoomIn();board.zoomIn();});
    await page.click('#box_navigation_100');
    result[wrapped]=await page.evaluate(()=>({box:board.getBoundingBox(),zoom:[board.zoomX,board.zoomY]}));
    await page.close();
   }
   const whole=(box)=>box[0]<=1e-9 && box[1]>=6-1e-9 && box[2]>=14-1e-9 && box[3]<=1e-9;
   assert.ok(!whole(result[false].box),'JSXGraph alone crops the sides: '+result[false].box);
   assert.ok(whole(result[true].box),'with the extension the whole box is shown: '+result[true].box);
   assert.deepEqual(result[true].zoom,[1,1]);
  }finally{await browser.close();}
 });
}
