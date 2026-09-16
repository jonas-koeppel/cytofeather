// No package install needed: node --test tests/core.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new vm.Script(script); // Check syntax of the complete production script.
const functions = ['checkedSamples','sampleGroupNames','gateExportPath','defaultGroupColor','statisticsCSV','recalculateGatePercentCache','gatePercentText','gatePercentTextForSample','gateColor','sampleById','gateOffsetBands','gateVisibleForCurrentAxes','gateSampleIsVisible','gateSampleGroupId','activeSampleGroupId','copyGateBranchToGroup','gateAndDescendantIds','importEventIndex','compensationPreviewSample','polygonEdgeAt','parseCSVRows','parseCSV','uniqueParameterNames','parseFCS','parseText','csvEscape','populationCSV','prepareWorkspace','serializeWorkspace','normalizeGate','isSegmentGate','transformAxisValue','sampleDetectorNames','parameterIndexForDetector','normalizeCompensationState','compensationOperator','invertSquareMatrix','applyCompensationToSample','makePopulationFilter','valueOf','pointInGate','gateAppliesToSample','gateEffectiveSampleId','visibleSamples','calculateStats','calculateHistogram','smoothHistogramBins'];
const ctx = vm.createContext({TextDecoder, Float64Array, Float32Array, Uint32Array, DataView, Uint8Array, console});
vm.runInContext(`let gatePercentCache=new Map(),gatePercentBySampleCache=new Map(),gatePercentCacheDirty=true;let sampleGroups = [], samples = [], gates = [], axis = {}, compensationState = {}, visibleSampleIds = new Set(), currentPopulationId = null; const collapsedGateIds=new Set(); const palette=['#123456']; let plotStyle={}; const paramSettings={}; const ui={plotType:{value:'hist-offset'},gridCols:{value:'2'}}; const document={body:{dataset:{theme:'dark'}}};`, ctx);
for (const name of functions) {
  const start = script.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  const end = script.indexOf('\n}', start) + 2;
  // Some helpers fit on a single line.
  const lineEnd = script.indexOf('\n', start);
  const firstLine = script.slice(start, lineEnd);
  vm.runInContext(firstLine.trimEnd().endsWith('}') ? firstLine : script.slice(start, end), ctx);
}
vm.runInContext(script.match(/const STATS_EXPORT_METRICS = \[[\s\S]*?\n\];/)[0],ctx);
vm.runInContext(script.split('\n').find(line => line.startsWith('const idGen =')), ctx);
const run = source => vm.runInContext(source, ctx);
const buf = text => new TextEncoder().encode(text).buffer;
function fcs({dtype='F', bits=32, order='1,2,3,4', mode='L', values=[1,2,3,4], stains=['A','B'], zeroOffsets=false}={}) {
  const bytes = bits / 8, little = order.startsWith('1,2');
  const metadata = {'$PAR':'2','$TOT':String(values.length/2),'$DATATYPE':dtype,'$MODE':mode,'$BYTEORD':order,'$P1N':'D1','$P2N':'D2','$P1S':stains[0],'$P2S':stains[1],'$P1B':String(bits),'$P2B':String(bits),'$BEGINDATA':'512','$ENDDATA':String(512+values.length*bytes-1)};
  const text = '|' + Object.entries(metadata).flat().join('|') + '|';
  const header = 'FCS3.1    ' + [58,57+text.length,zeroOffsets?0:512,zeroOffsets?0:512+values.length*bytes-1,0,0].map(n=>String(n).padStart(8)).join('');
  const out=new Uint8Array(512+values.length*bytes); out.set(new TextEncoder().encode(header)); out.set(new TextEncoder().encode(text),58);
  const view = new DataView(out.buffer);
  values.forEach((v,i)=>{ const off=512+i*bytes; if(dtype==='F') view.setFloat32(off,v,little); else if(dtype==='D') view.setFloat64(off,v,little); else { let value=BigInt(v); for(let b=0;b<bytes;b++){out[off+(little?b:bytes-1-b)]=Number(value&255n);value>>=8n;} } });
  return out.buffer;
}
function workspace() {return {samples:[{id:'s1',name:'sample',params:['X','Y'],data:[[1,2],[3,4]],n:2,color:'#123456'}], gates:[{id:'G1',name:'Gate 1',type:'rect',parentId:null,xParam:'X',yParam:'Y',def:{x0:0,y0:0,x1:10,y1:10}}],axis:{xParam:'X',yParam:'Y',xScale:'linear',yScale:'linear',xMin:0,xMax:10,yMin:0,yMax:10},visibleSampleIds:['s1'],currentPopulationId:'G1',plotType:'hist-offset'};}
test('CSV round trip handles quoted names, annotations, missing values and precision', async()=>{
  const sample=await ctx.parseCSV(buf('\uFEFFsample,"CD3, FITC",SSC\r\n"one, two",16777217,2\r\n"line\nname",3,\r\n'), 'test.csv');
  assert.deepEqual(Array.from(sample.params),['CD3, FITC','SSC']); assert.equal(sample.n,2); assert.equal(sample.data[0][0],16777217); assert.ok(Number.isNaN(sample.data[1][1]));
});
test('Malformed CSV is rejected with useful errors',async()=>{
  for(const text of ['', 'X,Y\n', 'X,X\n1,2', 'X,Y\n1,2,3', 'X,Y\n1,2\n3oops,4', 'X,Y\n"1,2', 'label\naaa']) await assert.rejects(ctx.parseCSV(buf(text),'bad.csv'));
});
test('Population export aligns reordered and missing channels',()=>{
  run(`samples=[{id:'a',name:'a',params:['X','Y'],data:[[1],[2]],n:1},{id:'b',name:'b',params:['Y','X','Z'],data:[[20],[10],[30]],n:1}]; visibleSampleIds=new Set(['a','b']); currentPopulationId=null; ui.fileList={children:samples.map(s=>({dataset:{sampleId:s.id}}))};`);
  assert.equal(ctx.populationCSV(),'sample,X,Y,Z\r\na,1,2,\r\nb,10,20,30');
});
test('FCS decodes floats, doubles, endian integer variants and metadata offsets',async()=>{
  for(const options of [{},{order:'4,3,2,1'},{dtype:'D',bits:64,values:[1.123456789,2,3,4]},{dtype:'I',bits:16,order:'1,2',values:[1000,2000,3000,4000]},{dtype:'I',bits:16,order:'2,1'},{dtype:'I',bits:48,values:[2**40,2,3,4]},{zeroOffsets:true}]) {
    const s=await ctx.parseFCS(fcs(options),'test.fcs'); assert.equal(s.data[0][0],options.values?.[0]??1); assert.equal(s.data[1][1],options.values?.[3]??4);
  }
});
test('Duplicate FCS stain names remain separately addressable',async()=>{
  const s=await ctx.parseFCS(fcs({stains:['CD3','CD3']}),'test.fcs'); assert.equal(new Set(s.params).size,2); assert.deepEqual(Array.from(s.paramDetectors),['D1','D2']);
});
test('FCS rejects truncated files and unsupported histograms',async()=>{
  await assert.rejects(ctx.parseFCS(new ArrayBuffer(10),'bad.fcs'),/truncated/);
  await assert.rejects(ctx.parseFCS(fcs().slice(0,520),'bad.fcs'),/offsets|truncated/);
  await assert.rejects(ctx.parseFCS(fcs({mode:'C'}),'bad.fcs'),/list-mode/);
  await assert.rejects(ctx.parseFCS(fcs({dtype:'I',bits:64,values:[2**54,2,3,4]}),'bad.fcs'),/precision/);
});
test('All nine bundled FCS samples load with finite numeric events',async()=>{
  for(const dir of ['example_data','compensation_test_data']) for(const name of fs.readdirSync(path.join(__dirname,'..',dir)).filter(n=>n.endsWith('.fcs'))) {
    const bytes=fs.readFileSync(path.join(__dirname,'..',dir,name)); const s=await ctx.parseFCS(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),name);
    assert.ok(s.n>7000,name); assert.equal(s.params.length,s.data.length); assert.ok(s.data.every(col=>col.every(Number.isFinite)),name); assert.equal(new Set(s.params).size,s.params.length);
  }
});
test('Workspace round trip retains view, raw precision, missing values and compensation',()=>{
  const ws=workspace(); ws.samples[0].data[0]=[16777217,null]; ws.theme='dark'; ws.compensation={enabled:true,channels:['X','Y'],matrix:[[100,10],[0,100]]};
  const prepared=ctx.prepareWorkspace(ws); assert.equal(prepared.samples[0].rawData[0][0],16777217); assert.ok(Number.isNaN(prepared.samples[0].rawData[0][1])); assert.equal(prepared.plotType,'hist-offset');
  ctx.prepared=prepared; run(`samples=prepared.samples; gates=prepared.gates; axis=prepared.axis; compensationState=prepared.compensation; visibleSampleIds=new Set(prepared.visibleSampleIds);`);
  const saved=JSON.parse(JSON.stringify(ctx.serializeWorkspace())); assert.equal(saved.version,2); assert.equal(saved.samples[0].data[0][0],16777217); assert.equal(saved.samples[0].data[0][1],null); assert.equal(saved.plotType,'hist-offset'); assert.equal(saved.theme,'dark');
  const reopened=ctx.prepareWorkspace(saved); assert.equal(reopened.samples[0].data[1][0],prepared.samples[0].data[1][0]);
});
test('Workspace validation rejects cycles, duplicate IDs, bad arrays, ranges and singular compensation without changing state',()=>{
  const mutations=[w=>w.gates[0].parentId='G1',w=>w.gates.push(w.gates[0]),w=>w.samples[0].data[0].pop(),w=>w.axis.xMax=0,w=>w.gates[0].parentId='missing',w=>w.compensation={enabled:true,channels:['X','Y'],matrix:[[100,100],[100,100]]}];
  const before=run('samples'); for(const change of mutations){const ws=workspace();change(ws);assert.throws(()=>ctx.prepareWorkspace(ws));assert.equal(run('samples'),before);}
});
test('New gates cannot reuse IDs loaded from a workspace',()=>{ run("gates=[{id:'G1'},{id:'G2'},{id:'G4'}]"); assert.equal(run('idGen()'),'G3'); assert.equal(run('idGen()'),'G5'); });
test('Compensation recovers known true signals and disabling restores raw values',()=>{
  const sample={params:['X','Y'],n:2,data:[Float64Array.from([110,70]),Float64Array.from([70,110])]};sample.rawData=sample.data;
  const state={enabled:true,channels:['X','Y'],matrix:[[100,20],[20,100]]};ctx.applyCompensationToSample(sample,state);
  assert.ok(Math.abs(sample.data[0][0]-100)<1e-9);assert.ok(Math.abs(sample.data[1][0]-50)<1e-9);ctx.applyCompensationToSample(sample,{enabled:false});assert.equal(sample.data,sample.rawData);
});
test('Legacy numeric strings in cached axis ranges can be reopened',()=>{
  const ws=workspace(); ws.paramSettings={X:{min:'0',max:'10',scale:'linear'}};
  assert.equal(ctx.prepareWorkspace(ws).paramSettings.X.max,10);
});
test('Saved compensation must not silently replace invalid values with zero',()=>{
  const ws=workspace(); ws.compensation={enabled:true,channels:['X','Y'],matrix:[[100,'bad'],[0,100]]};assert.throws(()=>ctx.prepareWorkspace(ws),/matrix/);
});

test('Import choices cap evenly across FCS and CSV, preserve totals, or skip',async()=>{
  for(const parse of [()=>ctx.parseFCS(fcs({values:[1,2,3,4,5,6,7,8]}),'large.fcs',n=>{assert.equal(n,4);return 2;}),()=>ctx.parseCSV(buf('X,Y\n1,2\n3,4\n5,6\n7,8'),'large.csv',n=>{assert.equal(n,4);return 2;})]){
    const s=await parse();assert.equal(s.n,2);assert.equal(s.originalEventCount,4);assert.deepEqual(Array.from(s.data[0]),[1,7]);assert.deepEqual(Array.from(s.data[1]),[2,8]);
  }
  assert.equal(await ctx.parseFCS(fcs(),'skip.fcs',()=>0),null);
  assert.equal(await ctx.parseCSV(buf('X\n1\n2'),'skip.csv',()=>0),null);
});
test('Large CSV cap returns exactly 500,000 events including both ends',async()=>{
  const total=500003;const s=await ctx.parseCSV(buf('X\n'+Array.from({length:total},(_,i)=>i).join('\n')),'large.csv',n=>{assert.equal(n,total);return 500000;});
  assert.equal(s.n,500000);assert.equal(s.data[0][0],0);assert.equal(s.data[0][499999],total-1);
});
test('Compensation preview uses sampled raw values without mutating the sample',()=>{
  const sample={n:3,params:['A','B'],paramDetectors:['A','B'],rawData:[[10,20,30],[3,6,9]],data:[[99,99,99],[99,99,99]]};
  const before=JSON.stringify(sample),state={enabled:true,channels:['A','B'],matrix:[[100,10],[0,100]]};
  const p=ctx.compensationPreviewSample(sample,state,2);
  assert.equal(p.n,2);assert.deepEqual(Array.from(p.data[1]),[2,6]);assert.deepEqual(Array.from(p.rawData[1]),[3,9]);assert.equal(JSON.stringify(sample),before);
  assert.throws(()=>ctx.compensationPreviewSample(sample,{...state,matrix:[[100,100],[100,100]]}),/singular/i);
});
test('Polygon edge selection handles closing edge, nearest edge and misses',()=>{
  const pts=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  assert.equal(ctx.polygonEdgeAt(pts,50,2),0);assert.equal(ctx.polygonEdgeAt(pts,2,50),3);assert.equal(ctx.polygonEdgeAt(pts,50,50),-1);
});

test('Group copies retain ancestor filters, copy descendants and leave originals independent',()=>{
  run(`sampleGroups=[{id:'group',name:'Treated',sampleIds:['a']}];samples=[{id:'a',n:2,params:['X','Y'],data:[[2,8],[2,8]]},{id:'b',n:2,params:['X','Y'],data:[[2,8],[2,8]]}];gates=[{id:'root',name:'Root',type:'rect',parentId:null,def:{x0:0,y0:0,x1:5,y1:5},xParam:'X',yParam:'Y'},{id:'child',name:'Child',type:'rect',parentId:'root',def:{x0:0,y0:0,x1:10,y1:10},xParam:'X',yParam:'Y'},{id:'leaf',name:'Leaf',type:'rect',parentId:'child',def:{x0:0,y0:0,x1:4,y1:4},xParam:'X',yParam:'Y'}];`);
  const copied=ctx.copyGateBranchToGroup('child','group');
  assert.equal(run('gates.length'),6);assert.notEqual(copied.parentId,'root');
  assert.equal(ctx.makePopulationFilter(copied.id)(run('samples[0]'),0),true);
  assert.equal(ctx.makePopulationFilter(copied.id)(run('samples[0]'),1),false);
  assert.equal(ctx.makePopulationFilter(copied.id)(run('samples[1]'),0),false);
  copied.def.x1=3;assert.equal(run("gates.find(g=>g.id==='child').def.x1"),10);
  ctx.copyGateBranchToGroup('child','group');assert.equal(run('gates.length'),6);
  run("sampleGroups[0].sampleIds=['b']");assert.equal(ctx.makePopulationFilter(copied.id)(run('samples[0]'),0),false);assert.equal(ctx.makePopulationFilter(copied.id)(run('samples[1]'),0),true);
});
test('Group roots filter visible samples and events, including empty groups',()=>{
  run("currentPopulationId='group';visibleSampleIds=new Set(['a','b']);ui.fileList={children:[{dataset:{sampleId:'a'}},{dataset:{sampleId:'b'}}]};");
  assert.deepEqual(Array.from(ctx.visibleSamples(),s=>s.id),['b']);assert.equal(ctx.makePopulationFilter('group')(run('samples[0]'),0),false);
  run('sampleGroups[0].sampleIds=[]');assert.equal(ctx.visibleSamples().length,0);
  run('currentPopulationId=null;sampleGroups=[];gates=[];');
});
test('Workspace validates group membership and persists group assignments and selection',()=>{
  const w=workspace();w.sampleGroups=[{id:'sg',name:'Treated',sampleIds:['s1']}];w.gates[0].groupId='sg';w.currentPopulationId='sg';
  const restored=ctx.prepareWorkspace(w);assert.equal(restored.sampleGroups[0].name,'Treated');assert.equal(restored.gates[0].groupId,'sg');assert.equal(restored.currentPopulationId,'sg');
  const bad=JSON.parse(JSON.stringify(w));bad.sampleGroups[0].sampleIds=['missing'];assert.throws(()=>ctx.prepareWorkspace(bad),/group/i);
  const badRef=JSON.parse(JSON.stringify(w));badRef.gates[0].groupId='missing';assert.throws(()=>ctx.prepareWorkspace(badRef),/group/i);
  assert.equal(ctx.prepareWorkspace(workspace()).sampleGroups.length,0);
});

test('Colored group gates appear in all-events views only for member rows',()=>{
  run(`sampleGroups=[{id:'sg',name:'Group 1',color:'#ab1234',sampleIds:['a','c']}];samples=['a','b','c'].map(id=>({id}));visibleSampleIds=new Set(['a','b','c']);currentPopulationId=null;axis={xParam:'X',yParam:'Y'};ui.plotType.value='scatter';gates=[{id:'groupGate',groupId:'sg',parentId:null,xParam:'X',yParam:'Y'}];`);
  const g=run('gates[0]');assert.equal(ctx.gateColor(g),'#ab1234');assert.equal(ctx.gateVisibleForCurrentAxes(g),true);assert.equal(ctx.gateVisibleForCurrentAxes(g,'b'),false);assert.equal(ctx.gateVisibleForCurrentAxes(g,'a'),true);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.gateOffsetBands(g,run('samples'),10,300))),[{y:10,h:100},{y:210,h:100}]);
  run("visibleSampleIds=new Set(['b'])");assert.equal(ctx.gateVisibleForCurrentAxes(g),false);
  run('sampleGroups=[];gates=[];currentPopulationId=null');
});

test('Percent cache survives switching groups and reports empty parents safely',()=>{
  run(`sampleGroups=[{id:'a',name:'Group 1',color:'#8b5cf6',sampleIds:['s1']},{id:'b',name:'Group 2',sampleIds:['s2']}];samples=['s1','s2'].map(id=>({id,name:id,n:2,params:['X','Y'],data:[[1,9],[1,9]]}));visibleSampleIds=new Set(['s1','s2']);ui.fileList={children:samples.map(s=>({dataset:{sampleId:s.id}}))};gates=['a','b'].map((groupId,i)=>({id:'gate'+i,name:'Cells',groupId,type:'rect',parentId:null,xParam:'X',yParam:'Y',def:{x0:0,y0:0,x1:5,y1:5}}));currentPopulationId='b';gatePercentCacheDirty=true;`);
  assert.equal(ctx.gatePercentTextForSample(run('gates[1]'),'s2'),'50.00%');
  run('currentPopulationId=null');assert.equal(ctx.gatePercentTextForSample(run('gates[0]'),'s1'),'50.00%');assert.equal(ctx.gatePercentTextForSample(run('gates[0]'),'s2'),'N/A');
  assert.notEqual(ctx.defaultGroupColor(),'#8b5cf6');
});
test('Group CSVs identify membership and populations without unrelated sample rows',()=>{
  const csv=ctx.statisticsCSV(['a','b','gate0','gate1'],[],['events'],'a');
  assert.match(csv,/sample,sample_groups,gate_group,gate,gate_path,events/);assert.match(csv,/s1,Group 1,Group 1,Cells,Cells,1/);assert.ok(!csv.includes('s2,'));
  const pop=ctx.populationCSV('gate0');assert.match(pop,/sample_groups,population_group,population/);assert.match(pop,/s1,Group 1,Group 1,Cells,1,1/);assert.ok(!pop.includes('s2,'));
  run('sampleGroups=[];gates=[];currentPopulationId=null');
});

test('CSV all-sample exports omit nonmember gates and preserve overlapping group rows',()=>{
  run(`sampleGroups=[{id:'ga',name:'Group A',sampleIds:['s1','s2']},{id:'gb',name:'Group B',sampleIds:['s2']}];samples=['s1','s2','outside'].map(id=>({id,name:id,n:1,params:['X','Y'],data:[[1],[1]]}));visibleSampleIds=new Set(samples.map(s=>s.id));ui.fileList={children:samples.map(s=>({dataset:{sampleId:s.id}}))};gates=['ga','gb'].map((groupId,i)=>({id:'g'+i,name:'Cells',groupId,type:'rect',parentId:null,xParam:'X',yParam:'Y',def:{x0:0,y0:0,x1:5,y1:5}}));currentPopulationId=null;`);
  const rows=ctx.statisticsCSV(['g0','g1'],[],['events']).trim().split('\n');
  assert.equal(rows.length,4);assert.ok(rows.some(r=>r.startsWith('s1,Group A,Group A,')));
  assert.equal(rows.filter(r=>r.startsWith('s2,')).length,2);assert.ok(!rows.some(r=>r.startsWith('outside,')));
  const pop=ctx.populationCSV('g1').trim().split('\n');assert.equal(pop.length,2);assert.ok(pop[1].startsWith('s2,'));
  run('sampleGroups=[];gates=[];currentPopulationId=null');
});
