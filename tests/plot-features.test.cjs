const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
function appContext() {
  const context = vm.createContext({console,TextDecoder,Float64Array,Float32Array,Uint32Array,Uint8Array,DataView});
  vm.runInContext(`const TAU=Math.PI*2;let samples=[],gates=[],currentPopulationId=null,axis={},visibleSampleIds=new Set();let plotStyle={scatterDotSize:1.5,scatterOpacity:.65,scatterGridPalette:'classic'};const ui={fileList:{children:[]}};`,context);
  const names=['makeScaler','calculateDensityPoints','drawDensityDots','drawDensityDotsPDF','paletteColor','lerp','rgbToHex','hexToRgb','clampNumber','scatterDotSize','scatterOpacity','buildGatingStrategyPanels','strategyGatePoints','strategyAxisForPanel','strategyGateStats','strategyPanelSamples','strategyPdfText','drawStrategyAxesPDF','drawStrategyScatterPDF','drawStrategyHistogramPDF','drawStrategyGatePDF','gatingStrategyPagination','createGatingStrategyPDF','makePopulationFilter','pointInGate','valueOf','gateEffectiveSampleId','gateAppliesToSample','isSegmentGate','visibleSamples','transformAxisValue','inverseTransformAxisValue','getEllipseCenterT','gatePointToTransformed','pnpoly','getAxisTicks','getLogTicks','getLinearTicks','niceStep','formatExportTickLabel','formatNum','drawPdfSuperscriptText','parseSuperscriptToken','calculateHistogram','smoothHistogramBins'];
  for(const name of names){
    const start=source.search(new RegExp(`function ${name}\\(`));assert.ok(start>=0,name);
    const firstLine=source.slice(start,source.indexOf('\n',start));
    vm.runInContext(firstLine.trimEnd().endsWith('}')?firstLine:source.slice(start,source.indexOf('\n}',start)+2),context);
  }
  vm.runInContext(source.match(/const DENSITY_PALETTES = \{[\s\S]*?\n\};/)[0],context);
  context.setState = state => {
    context.state=state;
    vm.runInContext(`samples=state.samples||[];gates=state.gates||[];visibleSampleIds=new Set(samples.map(s=>s.id));ui.fileList.children=samples.map(s=>({dataset:{sampleId:s.id}}));`,context);
  };
  return context;
}
const ax={xParam:'X',yParam:'Y',xScale:'linear',yScale:'linear',xMin:0,xMax:10,yMin:0,yMax:10};
const sample=(id,points)=>({id,name:id,color:'#7aa2ff',params:['X','Y'],n:points.length,data:[points.map(p=>p[0]),points.map(p=>p[1])]});
const gate=(id,parentId=null,def={x0:0,x1:10,y0:0,y1:10})=>({id,name:id,parentId,type:'rect',xParam:'X',yParam:'Y',xScale:'linear',yScale:'linear',def});
test('Overlay density pools all samples and keeps original dot positions',()=>{
  const c=appContext(),s=sample('a',[[1.23,2.34],[1.23,2.34],[8.76,7.65]]);
  const one=c.calculateDensityPoints([s],ax,()=>true),two=c.calculateDensityPoints([s,{...s,id:'b'}],ax,()=>true);
  assert.equal(two.eventCount,6);assert.equal(two.maxDensity,2*one.maxDensity);
  const positions=two.buckets.flat();assert.equal(positions.filter(p=>p.x===.123&&p.y===.23399999999999999).length,4);
  assert.ok(positions.some(p=>Math.abs(p.x-.876)<1e-12));
});
test('Density excludes invalid, out-of-range, nonpositive log and filtered events',()=>{
  const c=appContext(),s=sample('a',[[NaN,1],[0,1],[-1,1],[1,Infinity],[100,1],[1,1],[2,2]]);
  const d=c.calculateDensityPoints([s],{...ax,xMin:.1,xScale:'log'},(_,i)=>i!==6);
  assert.equal(d.eventCount,1);assert.equal(d.drawnCount,1);
});
test('Density estimation uses all events even when drawing is downsampled',()=>{
  const c=appContext(),s=sample('a',Array.from({length:100},(_,i)=>[i<90?2:8,2]));
  const full=c.calculateDensityPoints([s],ax,()=>true,Infinity),limited=c.calculateDensityPoints([s],ax,()=>true,5);
  assert.equal(full.maxDensity,limited.maxDensity);assert.equal(full.eventCount,limited.eventCount);assert.equal(limited.drawnCount,5);
});
test('Canvas and PDF render individual circles rather than density tiles',()=>{
  const c=appContext(),density=c.calculateDensityPoints([sample('a',[[1,2],[3,4]])],ax,()=>true);
  let circles=0,fills=0;
  const canvas={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},arc(){circles++;},fill(){fills++;}};
  c.drawDensityDots(canvas,{x:0,y:0,w:100,h:100},density,'classic',1,.7);assert.equal(circles,2);assert.ok(fills>0);
  circles=0;const pdf={saveGraphicsState(){},restoreGraphicsState(){},rect(){},clip(){},discardPath(){},GState:function(){},setGState(){},setFillColor(){},circle(){circles++;}};
  c.drawDensityDotsPDF(pdf,{x:0,y:0,w:100,h:100},density,'classic',1,.7);assert.equal(circles,2);
  assert.equal(c.paletteColor('classic',0),'#0000b8');assert.equal(c.paletteColor('classic',1),'#ff0000');
});
test('Strategy groups same-axis siblings and orders parents before children',()=>{
  const c=appContext();const gs=[gate('child','root'),gate('root'),gate('sibling','root'),{...gate('segment','child'),type:'segment',yParam:null,def:{x0:1,x1:2}}];
  c.setState({samples:[sample('a',[[1,1]])],gates:gs});const panels=c.buildGatingStrategyPanels();
  assert.deepEqual(Array.from(panels,p=>Array.from(p.gates,g=>g.id)),[['root'],['child','sibling'],['segment']]);assert.equal(panels[2].histogram,true);
});
test('Strategy percentages use all parent events, independently of plot ranges',()=>{
  const c=appContext(),root=gate('root',null,{x0:0,x1:5,y0:0,y1:10}),child=gate('child','root',{x0:0,x1:2,y0:0,y1:10});
  const s=sample('a',[[1,1],[2,2],[3,3],[8,8]]);c.setState({samples:[s],gates:[root,child]});const stats=c.strategyGateStats(child,[s]);
  assert.equal(stats.parent,3);assert.equal(stats.events,2);assert.ok(Math.abs(stats.percent-200/3)<1e-12);
});
test('Sample-specific strategy gates have correct denominators and N/A rows',()=>{
  const c=appContext(),g={...gate('a only'),sampleId:'a'},a=sample('a',[[1,1]]),b=sample('b',[[2,2],[3,3]]);c.setState({samples:[a,b],gates:[g]});
  const p=c.buildGatingStrategyPanels()[0];assert.equal(c.strategyGateStats(g,[a,b]).parent,1);assert.equal(c.strategyPanelSamples(p,[b]).length,0);assert.equal(c.strategyGateStats(g,[b]).percent,null);
  assert.equal(c.buildGatingStrategyPanels([g],[b]).length,0);
});
test('Strategy uses saved gate axes, including after gates move beyond their original view',()=>{
  const c=appContext(),g={...gate('root',null,{x0:0,x1:20,y0:0,y1:10}),viewAxis:ax};c.setState({samples:[sample('a',[[1,1],[2,2]])],gates:[g]});
  const p=c.buildGatingStrategyPanels()[0],a=c.strategyAxisForPanel(p,[]);assert.ok(a.xMax>20);assert.ok(a.yMax>10);assert.equal(a.xMin,0);
});
test('Pagination keeps sample rows and gate columns complete without duplication',()=>{
  const c=appContext(),pages=c.gatingStrategyPagination(7,5,'grid',5),cells=new Set();
  for(const p of pages) for(let r=p.rowStart;r<p.rowEnd;r++)for(let col=p.colStart;col<p.colEnd;col++){const key=`${r}:${col}`;assert.ok(!cells.has(key));cells.add(key);}
  assert.equal(cells.size,35);assert.equal(pages.length,4);assert.equal(c.gatingStrategyPagination(7,5,'overlay',5).length,2);
});
module.exports={appContext};

test('Real PDF generation covers scatter, histogram and continuation pages without changing input',()=>{
  const c=appContext();c.window={jspdf:require('../vendor/jspdf.umd.min.js')};
  const root=gate('root'),child={...gate('hist','root'),type:'segment',yParam:null,def:{x0:1,x1:5}};
  const state={samples:Array.from({length:4},(_,i)=>sample(String(i),[[1,2],[3,4],[8,9]])),gates:[root,child]};
  c.setState(state);const before=JSON.stringify(state);
  for(const mode of ['overlay','grid'])for(const density of [true,false]){
    const pdf=c.createGatingStrategyPDF({mode,density,palette:'classic',allEvents:true,columns:1});
    assert.equal(pdf.getNumberOfPages(),mode==='grid'?4:2);
    assert.ok(pdf.output().startsWith('%PDF-'));assert.ok(pdf.output('arraybuffer').byteLength>2000);
  }
  assert.equal(JSON.stringify(state),before);
});
