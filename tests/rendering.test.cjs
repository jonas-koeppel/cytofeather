// Rendering/interaction regressions using the production functions and a recording canvas.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function extract(c,name) {
  const start=source.search(new RegExp(`function ${name}\\(`));assert.ok(start>=0,name);
  const firstLine=source.slice(start,source.indexOf('\n',start));
  vm.runInContext(firstLine.trimEnd().endsWith('}')?firstLine:source.slice(start,source.indexOf('\n}',start)+2),c);
}
function context() {
  const frames=[],work={data:0,overlays:0,stats:0,ghosts:0,histograms:0,density:0,markers:0,history:0,copies:0,labels:[],exact:[]};
  const canvasContext=new Proxy({measureText:text=>({width:text.length*6})},{get:(o,k)=>k in o?o[k]:k==='drawImage'?()=>work.copies++:()=>{}});
  const canvas=()=>({width:600,height:400,getContext:()=>canvasContext});
  const controls={statsUpdateStatus:{hidden:true},downloadPanelStats:{disabled:false}};
  const c=vm.createContext({console,Float64Array,Float32Array,frames,work,controls,canvasContext,canvas,
    requestAnimationFrame:fn=>frames.push(fn),getComputedStyle:()=>({getPropertyValue:()=>'#112233'})});
  c.run=s=>vm.runInContext(s,c);
  c.run(`const TAU=Math.PI*2,PAD={l:60,r:16,t:16,b:36};let samples=[],gates=[],sampleGroups=[],visibleSampleIds=new Set(),currentPopulationId=null;
    let axis={xParam:'X',yParam:'Y',xScale:'linear',yScale:'linear',xMin:0,xMax:10,yMin:0,yMax:10};
    let plotStyle={},plotDisplaySize={w:600,h:400,dpr:1},renderQueued=false,renderPhase='all',renderingExport=false;
    const plotLayerCache={canvas:null,key:null},plotColumnIds=new WeakMap();let nextPlotColumnId=1,liveGatePreview=null;
    let gateDragState=null,editingGate={id:null,handle:null},labelDragGateId=null,labelDragCellArea=null,labelDragSampleId=null,drawState=null;
    let gatePercentCache=new Map(),gatePercentBySampleCache=new Map(),gatePercentCacheDirty=true,statsRevision=0,statsPanelCache=null;
    const document={body:{dataset:{theme:'light'}},createElement:()=>canvas()},ctx=canvasContext;
    const ui={plot:canvas(),plotType:{value:'scatter'},gridCols:{value:'2'},scatterPseudocolorToggle:{},fileList:{children:[]}};
    const byId=id=>controls[id],setAxisFromUI=()=>{},syncCanvasResolution=()=>{},plotLogicalWidth=()=>plotDisplaySize.w,plotLogicalHeight=()=>plotDisplaySize.h;
    const syncFileGroupMarkers=()=>work.markers++,scheduleHistoryCommit=()=>work.history++,drawGhost=()=>work.ghosts++;
    function updateStats(){work.stats++;work.exact=collectPanelStatistics(currentPopulationId,visibleSamples(),['X'],'pooled');controls.downloadPanelStats.disabled=false;}
    function drawScatterPlot(){if(drawDataPhase())work.data++;if(drawOverlayPhase()){work.overlays++;work.labels=gates.map(g=>canvasGatePercentText(g));}}
    function drawGridScatterPlot(...args){drawScatterPlot(...args);}function drawHistPlot(...args){drawScatterPlot(...args);}const drawCanvasAxisTitles=()=>{};
  `);
  const names=['plotArea','render','requestRender','renderFrame','renderPlotContent','drawDataPhase','drawOverlayPhase','plotColumnIdentity','plotPopulationSignature','plotDataKey','gateEditInProgress','plotInteractionInProgress','setStatsPending','drawPlotUpdateHint','makeGatePreview','gatePreviewTester','liveGatePercent','canvasGatePercentText','finishGateInteraction','markGatePercentDirty','makePopulationFilter','pointInGate','pointInQuadrant','quadrantBasis','quadSiblings','gatePointToTransformed','getEllipseCenterT','pnpoly','transformAxisValue','inverseTransformAxisValue','valueOf','isSegmentGate','checkedSamples','visibleSamples','activeSampleGroupId','gateSampleGroupId','gateEffectiveSampleId','gateAppliesToSample','recalculateGatePercentCache','gatePercentText','gatePercentTextForSample','collectPanelStatistics','calculateStats'];
  names.forEach(name=>extract(c,name));
  c.load=state=>{c.state=state;c.run(`samples=state.samples||[];gates=state.gates||[];sampleGroups=state.sampleGroups||[];visibleSampleIds=new Set(samples.map(s=>s.id));ui.fileList.children=samples.map(s=>({dataset:{sampleId:s.id}}));`);};
  c.flush=()=>{assert.equal(frames.length,1,'one redraw scheduled');frames.shift()();};
  c.work=work;c.frames=frames;c.controls=controls;
  return c;
}
const sample=(id='s',n=100)=>({id,name:id,color:'#123456',n,params:['X','Y'],data:[Float64Array.from({length:n},(_,i)=>i%10),Float64Array.from({length:n},(_,i)=>i%10)]});
const gate=(id='g',parentId=null)=>({id,name:id,parentId,type:'rect',xParam:'X',yParam:'Y',xScale:'linear',yScale:'linear',def:{x0:0,x1:5,y0:0,y1:10}});

test('Redraw requests share one animation frame, use the latest state and draw the ghost once',()=>{
  const c=context();c.load({samples:[sample()]});
  c.run("drawState={type:'poly'};render();render();drawState.pts=[{x:1,y:1}];render()");
  assert.equal(c.work.data,0);c.flush();assert.equal(c.work.data,1);assert.equal(c.work.ghosts,1);assert.equal(c.work.stats,0);
  c.run('drawState=null;render();render()');c.flush();assert.equal(c.work.data,1);assert.equal(c.work.stats,1);
});
test('Gate and label movement reuse the event layer and defer full statistics until release',()=>{
  const c=context();c.load({samples:[sample()],gates:[gate()]});c.render();c.flush();
  const exact=c.work.stats;c.run("gateDragState={id:'g'};gates[0].def.x1=2;markGatePercentDirty();render()");c.flush();
  assert.equal(c.work.data,1);assert.equal(c.work.stats,exact);assert.equal(c.work.labels[0],'≈30.0%');
  assert.equal(c.controls.statsUpdateStatus.hidden,false);assert.equal(c.controls.downloadPanelStats.disabled,true);
  c.finishGateInteraction();c.flush();assert.equal(c.work.data,1);assert.equal(c.work.stats,exact+1);assert.equal(c.work.labels[0],'30.00%');
  assert.equal(c.controls.statsUpdateStatus.hidden,true);assert.equal(c.work.exact[0].events,100);
  c.run("labelDragGateId='g';render()");c.flush();assert.equal(c.work.data,1);assert.equal(c.work.stats,exact+1);
  c.finishGateInteraction();c.flush();assert.equal(c.work.stats,exact+2);
});
test('A dependent population retains its event layer during editing and rebuilds from the final gate on release',()=>{
  const c=context();c.load({samples:[sample()],gates:[gate()]});c.run("currentPopulationId='g';render()");c.flush();
  assert.equal(c.work.exact[0].events,60);
  c.run("editingGate={id:'g',handle:{type:'rect'}};gates[0].def.x1=1;markGatePercentDirty();render()");c.flush();
  assert.equal(c.work.data,1);assert.equal(c.work.stats,1);
  c.finishGateInteraction();c.flush();assert.equal(c.work.data,2);assert.equal(c.work.exact[0].events,20);assert.equal(c.run('liveGatePreview'),null);
});
test('Cached data invalidates for ancestry/scope, columns, axes, style, size/DPR, theme, visibility and order',()=>{
  const c=context(),a=sample('a'),b=sample('b');c.load({samples:[a,b],gates:[gate('root'),gate('child','root')],sampleGroups:[{id:'group',name:'Group',sampleIds:['a']}]});
  c.render();c.flush();let count=1;
  for(const change of ["axis.xMax=20","plotStyle.scatterPseudocolor=true","samples[0].color='#abcdef'","samples[0].name='New name'","samples[0].data[0]=Float64Array.from(samples[0].data[0],x=>x+1)","ui.fileList.children.reverse()","visibleSampleIds.delete('b')","sampleGroups[0].sampleIds.push('b')","plotDisplaySize={w:700,h:500,dpr:2}","document.body.dataset.theme='dark'","currentPopulationId='child'","gates[0].def.x1=3","gates[0].sampleId='a'","ui.plotType.value='scatter-grid'","ui.gridCols.value='1'"]){
    c.run(change+';render()');c.flush();assert.equal(c.work.data,++count,change);
  }
  c.run("gates[1].labelPos={x:3,y:2,manual:true};editingGate.id='child';render()");c.flush();assert.equal(c.work.data,count);
});
test('Synchronous image exports bypass the screen cache and use exact percentages during a drag',()=>{
  const c=context();c.load({samples:[sample()],gates:[gate()]});c.render();c.flush();
  c.run("gateDragState={id:'g'};gates[0].def.x1=2;markGatePercentDirty();render()");
  c.render(c.run('ctx'),true,{includeAxisTitles:false});assert.equal(c.work.data,2);assert.equal(c.work.labels[0],'30.00%');
  assert.equal(c.frames.length,1);assert.equal(c.run('renderPhase'),'all');assert.equal(c.run('renderingExport'),false);
  c.flush();assert.equal(c.work.data,2);assert.equal(c.work.labels[0],'≈30.0%');
});
test('A queued frame cannot overwrite a newer workspace or restored compensation columns with old data',()=>{
  const c=context();c.load({samples:[sample()]});c.render();c.flush();c.render();
  c.load({samples:[{...sample('restored'),data:[new Float64Array([8,9]),new Float64Array([1,2])],n:2}]});
  c.flush();assert.equal(c.work.data,2);assert.equal(c.work.exact[0].events,2);assert.equal(c.work.exact[0].stats.get('X').mean,'8.50e+0');
});
test('Live previews cap event visits, reuse parent sampling and honor group/sample scopes and missing values',()=>{
  const c=context(),a=sample('a',200003),b=sample('b',100007),other=sample('other',100000);
  const parent=gate('parent'),child={...gate('child','parent'),groupId:'group'};
  c.load({samples:[a,b,other],gates:[parent,child],sampleGroups:[{id:'group',name:'Group',sampleIds:['a','b']}]});
  const preview=c.makeGatePreview(child);assert.equal(preview.points.size,2);assert.ok([...preview.points.values()].reduce((n,p)=>n+p.length,0)<=25000);
  c.run("editingGate={id:'child',handle:{type:'rect'}}");assert.equal(c.liveGatePercent(child),100);
  const stored=c.run('liveGatePreview');child.def.x1=1;assert.ok(c.liveGatePercent(child)<100);assert.equal(c.run('liveGatePreview'),stored);
  child.sampleId='a';c.run('liveGatePreview=null');assert.deepEqual([...c.makeGatePreview(child).points.keys()],['a']);
  const small={...sample('a',3),data:[[NaN,1,9],[1,1,1]]};c.load({samples:[small],gates:[gate()]});c.run("liveGatePreview=null;editingGate={id:'g',handle:{type:'rect'}}");
  assert.ok(Math.abs(c.liveGatePercent(c.run('gates[0]'))-100/3)<1e-12);
});
test('Compiled preview tests match exact geometry, including tilted/log quadrants and polygon boundaries',()=>{
  const c=context(),view={xMin:1,xMax:1000,yMin:1,yMax:1000};
  const shapes=[gate(),{...gate(),type:'segment',def:{x0:1,x1:3}},{...gate(),type:'poly',def:{pts:[{x:1,y:1},{x:9,y:1},{x:4,y:8}]}},{...gate(),type:'ellipse',def:{cx:4,cy:5,rx:2,ry:3,angle:.6}}];
  shapes.push(...shapes.filter(g=>g.type==='poly'||g.type==='ellipse').map(g=>({...g,xScale:'log',yScale:'log'})));
  for(const log of [false,true])for(const q of ['UL','UR','LR','LL'])shapes.push({...gate(),type:'quad',xScale:log?'log':'linear',yScale:log?'log':'linear',viewAxis:view,def:{x:3,y:4,xSpan:log?3:10,ySpan:log?3:10,xAngle:.3,yAngle:-.2,q}});
  for(const g of shapes){const test=c.gatePreviewTester(g);for(const x of [NaN,Infinity,-1,0,1,2,3,4,5,8,9,10,100])for(const y of [NaN,-1,0,1,3,4,5,9,100])assert.equal(test(x,y),c.pointInGate(g,x,y),JSON.stringify({type:g.type,def:g.def,x,y}));}
});

test('Scatter, grid and both histogram modes draw live overlays without revisiting event data',()=>{
  for(const mode of ['scatter','scatter-grid','hist','hist-offset']){
    const c=context();
    c.run(`function drawAxes(){work.data++;}function drawGates(){work.overlays++;}function drawGatesInGridCell(){work.overlays++;}function drawHistOffsetSegmentGates(){work.overlays++;}
      const drawPlotBorder=()=>{},drawPseudocolorScatterCell=()=>work.density++,hexToRGBA=color=>color;
      const scatterDotSize=()=>1.5,scatterOpacity=()=>.65,histFillOpacity=()=>.1,histLineWidth=()=>1.5,histogramYMode=()=>'percent';`);
    for(const name of ['drawScatterPlot','drawGridScatterPlot','drawHistPlot','drawHistData','makeScaler','gridColumnCount','calculateHistogram','smoothHistogramBins','addSmoothDensityCurveToPath','addSmoothDensityStrokeToPath'])extract(c,name);
    c.run('const actualHistogram=calculateHistogram;calculateHistogram=(...args)=>{work.histograms++;return actualHistogram(...args);};');
    c.load({samples:[sample('a'),sample('b')],gates:[gate()]});c.mode=mode;c.run('ui.plotType.value=mode;render()');c.flush();
    const data=c.work.data,histograms=c.work.histograms,overlays=c.work.overlays;
    assert.ok(data>0,mode);assert.ok(overlays>0,mode);
    c.run("gateDragState={id:'g'};gates[0].def.x1=2;markGatePercentDirty();render()");c.flush();
    assert.equal(c.work.data,data,mode);assert.equal(c.work.histograms,histograms,mode);assert.ok(c.work.overlays>overlays,mode);
    c.finishGateInteraction();c.flush();assert.equal(c.work.data,data,mode);
    if(mode.startsWith('scatter')){
      c.run("plotStyle.scatterPseudocolor=true;plotStyle.scatterGridPseudocolor=true;render()");c.flush();const density=c.work.density;assert.ok(density>0);
      c.run("gateDragState={id:'g'};gates[0].def.x1=4;markGatePercentDirty();render()");c.flush();assert.equal(c.work.density,density);
    }
  }
});

test('Linked quadrant preview percentages share one parent sample and follow independent divider tilts',()=>{
  const c=context(),gs=['UL','UR','LR','LL'].map((q,i)=>({...gate('q'+i),quadId:'set',type:'quad',def:{x:4,y:5,xSpan:10,ySpan:10,xAngle:.3,yAngle:-.2,q}}));
  c.load({samples:[sample('a'),sample('b')],gates:gs});c.run("editingGate={id:'q0',handle:{type:'quad'}}");
  const initial=gs.map(g=>c.liveGatePercent(g));assert.ok(Math.abs(initial.reduce((a,b)=>a+b,0)-100)<1e-10);
  const preview=c.run('liveGatePreview');gs.forEach(g=>g.def.yAngle=.7);
  const moved=gs.map(g=>c.liveGatePercent(g));assert.equal(c.run('liveGatePreview'),preview);assert.ok(Math.abs(moved.reduce((a,b)=>a+b,0)-100)<1e-10);assert.notDeepEqual(moved,initial);
  for(const id of ['a','b'])assert.ok(Math.abs(gs.reduce((sum,g)=>sum+c.liveGatePercent(g,id),0)-100)<1e-10);
});
test('Release before the scheduled frame still commits exact final values and export failures restore render state',()=>{
  const c=context();c.load({samples:[sample()],gates:[gate()]});c.render();c.flush();
  c.run("gateDragState={id:'g'};gates[0].def.x1=1;markGatePercentDirty();render()");c.finishGateInteraction();c.flush();
  assert.equal(c.work.labels[0],'20.00%');assert.equal(c.controls.statsUpdateStatus.hidden,true);
  c.run('const previousDraw=drawScatterPlot;drawScatterPlot=()=>{throw new Error("export failed");};');
  assert.throws(()=>c.render(c.run('ctx'),true,{}),/export failed/);assert.equal(c.run('renderPhase'),'all');assert.equal(c.run('renderingExport'),false);
  c.run('drawScatterPlot=previousDraw;render()');c.flush();assert.equal(c.work.labels[0],'20.00%');
});
