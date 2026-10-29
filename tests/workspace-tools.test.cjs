// Production-function checks for linked quadrants, history and binary workspaces.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function appContext(){
  const c=vm.createContext({TextDecoder,TextEncoder,Blob,Float64Array,Float32Array,Uint16Array,Uint32Array,Uint8Array,DataView,console,setTimeout,clearTimeout,getComputedStyle:()=>({getPropertyValue:()=>'#112233'})});
  vm.runInContext(`const TAU=Math.PI*2,HISTORY_LIMIT=100;let customAxes=[],samples=[],sampleGroups=[],gates=[],axis={},compensationState={enabled:false,channels:[],matrix:[]},visibleSampleIds=new Set(),currentPopulationId=null,plotStyle={},editingGate={},drawState=null,gateDragState=null,labelDragGateId=null,hoverQuadrant=null;const collapsedGateIds=new Set(),palette=['#112233'],paramSettings={};const undoHistory={undo:[],redo:[],current:null,key:'',timer:null,restoring:false};const ui={plotType:{value:'scatter'},gridCols:{value:'2'},fileList:{children:[]}};const document={body:{dataset:{theme:'light'}},activeElement:null};const controls={};const byId=id=>controls[id]||(controls[id]={});const markGatePercentDirty=()=>{},refreshPopulationOptions=()=>{},rebuildGateTree=()=>{},render=()=>{};`,c);
  const names=['validateQuadrantSets','quadSiblings','newQuadId','quadrantBasis','pointInQuadrant','pointInGate','tiltQuadrant','setQuadCenter','quadrantLines','quadrantAnchor','drawQuadrantCanvas','drawQuadrantPDF','makeScaler','transformAxisValue','inverseTransformAxisValue','gatePointToTransformed','getEllipseCenterT','pnpoly','isSegmentGate','copyGateBranchToGroup','gateAndDescendantIds','gateSampleGroupId','gateEffectiveSampleId','gateAppliesToSample','sampleById','sampleName','forkGateForSample','cloneGateDef','baseGateName','applyGateToSample','applyGateToAll','removeGateAndChildren','normalizeGate','prepareWorkspace','serializeWorkspace','encodeWorkspaceBinary','decodeWorkspaceBinary','readWorkspaceFile','validateCustomAxes','applyCustomAxes','sampleDetectorNames','parameterIndexForDetector','normalizeCompensationState','compensationOperator','invertSquareMatrix','applyCompensationToSample','makePopulationFilter','valueOf','checkedSamples','sampleGroupNames','gateExportPath','statisticsCSV','csvEscape','calculateStats','historyState','historyKey','historyBusy','scheduleHistoryCommit','updateHistoryButtons','commitHistory','resetHistory','restoreHistoryState','undo','redo'];
  for(const name of names){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);const line=source.slice(start,source.indexOf('\n',start));vm.runInContext(line.trimEnd().endsWith('}')?line:source.slice(start,source.indexOf('\n}',start)+2),c);}
  for(const name of ['WORKSPACE_MAGIC','platformIsLittleEndian'])vm.runInContext(source.split('\n').find(l=>l.startsWith('const '+name+' =')),c);
  vm.runInContext(source.match(/const STATS_EXPORT_METRICS = \[[\s\S]*?\n\];/)[0],c);
  vm.runInContext(source.split('\n').find(l=>l.startsWith('const idGen =')),c);
  // UI installation is stubbed; the production history/data reconstruction runs unchanged.
  vm.runInContext(`function installWorkspace(next){customAxes=next.customAxes;sampleGroups=next.sampleGroups;samples=next.samples;gates=next.gates;axis=next.axis;compensationState=next.compensation;visibleSampleIds=new Set(next.visibleSampleIds);currentPopulationId=next.currentPopulationId;plotStyle=next.plotStyle;ui.plotType.value=next.plotType;ui.gridCols.value=next.gridCols;ui.fileList.children=samples.map(s=>({dataset:{sampleId:s.id}}));editingGate={};}`,c);
  c.run=s=>vm.runInContext(s,c);
  c.load=state=>{c.state=state;c.run(`customAxes=state.customAxes||[];sampleGroups=state.sampleGroups||[];samples=state.samples||[];gates=state.gates||[];axis=state.axis||{};visibleSampleIds=new Set(samples.map(s=>s.id));ui.fileList.children=samples.map(s=>({dataset:{sampleId:s.id}}));currentPopulationId=null;`);};
  return c;
}
const axis={xParam:'X',yParam:'Y',xScale:'linear',yScale:'linear',xMin:0,xMax:10,yMin:0,yMax:10000};
function quadrants(extra={}){return ['UL','UR','LR','LL'].map((q,i)=>({id:'q'+i,name:'Q'+(i+1),type:'quad',quadId:'set',parentId:null,xParam:'X',yParam:'Y',xScale:'linear',yScale:'linear',viewAxis:{...axis},...extra,def:{x:5,y:5000,q,xSpan:10,ySpan:10000,xAngle:.3,yAngle:-.2,...extra.def}}));}
function sample(){return {id:'s',name:'sample',color:'#112233',params:['X','Y'],n:5,data:[Float64Array.from([1,3,5,7,9]),Float64Array.from([1000,7000,5000,3000,9000])]};}
function workspace(){return {version:2,samples:[sample()],gates:quadrants(),axis:{...axis},visibleSampleIds:['s'],currentPopulationId:null,plotType:'scatter',sampleGroups:[]};}

test('Tilted quadrants partition linear and log populations exactly once, with defined boundary ownership',()=>{
  const c=appContext();
  for(const log of [false,true]){
    const gs=quadrants(log?{xScale:'log',yScale:'log',def:{x:10,y:100,xSpan:4,ySpan:6}}:{});
    for(let i=0;i<1000;i++){const x=log?10**(i/250-1):i/99,y=log?10**((i*37%1000)/166-1):(i*337%10000);assert.equal(gs.filter(g=>c.pointInGate(g,x,y)).length,1);}
    assert.equal(gs.find(g=>c.pointInGate(g,gs[0].def.x,gs[0].def.y)).def.q,'UR');
    for(const g of gs){assert.equal(c.pointInGate(g,NaN,1),false);if(log)assert.equal(c.pointInGate(g,0,1),false);}
  }
  const gs=quadrants({def:{xAngle:0,yAngle:0}});
  assert.equal(gs.find(g=>c.pointInGate(g,5,1000)).def.q,'LR');assert.equal(gs.find(g=>c.pointInGate(g,1,5000)).def.q,'UL');
});
test('Tilting either divider and moving the centre update all four gates without depending on later plot ranges',()=>{
  const c=appContext(),gs=quadrants();c.load({gates:gs,axis});
  c.tiltQuadrant(gs[0],'rotate-x',{x:8,y:7000});assert.equal(new Set(gs.map(g=>g.def.xAngle)).size,1);assert.equal(gs[0].def.yAngle,-.2);
  c.tiltQuadrant(gs[0],'rotate-y',{x:8,y:7000});assert.equal(new Set(gs.map(g=>g.def.yAngle)).size,1);assert.ok(Math.abs(gs[0].def.xAngle-gs[0].def.yAngle)<Math.PI/2-.1);
  const before=gs.map(g=>c.pointInGate(g,7,8000));c.run('axis={...axis,xMax:100000,yMax:1e8}');assert.deepEqual(gs.map(g=>c.pointInGate(g,7,8000)),before);
  c.setQuadCenter(gs[0],3,2000);assert.ok(gs.every(g=>g.def.x===3&&g.def.y===2000));
});
test('Quadrant anchors stay inside their sectors and canvas/PDF use the same clipped divider coordinates',()=>{
  const c=appContext(),gs=quadrants(),area={x:30,y:20,w:600,h:400};c.load({gates:gs,axis});
  for(const g of gs){const p=c.quadrantAnchor(g,axis);assert.equal(c.pointInGate(g,p.x,p.y),true);}
  const lines=[],pdfLines=[];let last,clipped=false;
  const canvas={save(){},restore(){},beginPath(){},rect(){},clip(){},stroke(){},moveTo(x,y){last=[x,y];},lineTo(x,y){lines.push([...last,x,y]);last=[x,y];}};
  const pdf={saveGraphicsState(){},restoreGraphicsState(){clipped=false;},rect(){},clip(){clipped=true;},discardPath(){},line(...v){assert.ok(clipped);pdfLines.push(v);}};
  c.drawQuadrantCanvas(canvas,gs[0],area);c.drawQuadrantPDF(pdf,gs[0],area,axis);assert.deepEqual(pdfLines,lines);
  for(const line of pdfLines)for(let i=0;i<4;i+=2){assert.ok(line[i]>=30&&line[i]<=630);assert.ok(line[i+1]>=20&&line[i+1]<=420);}
});
test('Group copies preserve linked quadrants and descendants while edits stay independent',()=>{
  const c=appContext(),gs=quadrants();gs.push({id:'child',name:'child',type:'segment',parentId:'q0',xParam:'X',def:{x0:0,x1:10}});
  c.load({gates:gs,samples:[sample()],sampleGroups:[{id:'group',name:'Group',sampleIds:['s']}],axis});
  const copy=c.copyGateBranchToGroup('q0','group');const siblings=c.quadSiblings(copy);assert.equal(siblings.length,4);assert.notEqual(copy.quadId,'set');
  assert.ok(c.run('gates').some(g=>g.parentId===copy.id));c.setQuadCenter(copy,2,2000);assert.equal(gs[0].def.x,5);assert.ok(siblings.every(g=>g.def.x===2));
});
test('Sample-specific application and deletion treat a quadrant set as one edit',()=>{
  const c=appContext(),gs=quadrants();c.load({gates:gs,samples:[sample()],axis});
  const copy=c.applyGateToSample('q0','s');assert.equal(c.quadSiblings(copy).length,4);assert.notEqual(copy.quadId,'set');
  assert.ok(gs.slice(0,4).every(g=>g.excludeSampleIds.includes('s')));c.removeGateAndChildren(copy.id);assert.equal(c.run('gates.length'),4);assert.ok(c.run('gates').every(g=>!g.sampleId));
});
test('Binary workspaces retain raw precision, missing values, compensation, custom axes and tilted gates',async()=>{
  const c=appContext(),w=workspace();w.samples[0].data[0][0]=16777217;w.samples[0].data[1][1]=NaN;
  w.compensation={enabled:true,channels:['X','Y'],matrix:[[100,10],[0,100]]};w.customAxes=[{name:'Ratio',left:'X',right:'Y',operator:'/'}];
  // Fixture uses the same binary header/column format as V2, with mixed float column widths.
  w.samples[0].data[1]=Float32Array.from(w.samples[0].data[1]);
  const blob=c.encodeWorkspaceBinary(w);assert.equal(await blob.slice(0,8).text(),'CYTOFWS1');
  const decoded=await c.readWorkspaceFile(blob),next=c.prepareWorkspace(decoded);
  assert.ok(decoded.samples[0].data[1] instanceof Float32Array);assert.equal(next.samples[0].rawData[0][0],16777217);assert.ok(Number.isNaN(next.samples[0].rawData[1][1]));
  assert.equal(next.samples[0].params.at(-1),'Ratio');assert.equal(next.gates[0].def.xAngle,.3);
  c.load(next);c.run('compensationState=state.compensation');const saved=c.serializeWorkspace({binary:true});assert.equal(saved.samples[0].data[0],next.samples[0].rawData[0]);
  const reopened=c.prepareWorkspace(await c.decodeWorkspaceBinary(c.encodeWorkspaceBinary(saved)));
  assert.equal(reopened.samples[0].data[1][0],next.samples[0].data[1][0]);assert.equal(reopened.samples[0].params.length,3);
});
test('Both JSON and binary loaders reject malformed data before it can replace the current analysis',async()=>{
  const c=appContext(),w=workspace();w.samples[0].data=w.samples[0].data.map(a=>Array.from(a));
  const json=await c.readWorkspaceFile(new Blob([JSON.stringify(w)]));assert.equal(c.prepareWorkspace(json).samples.length,1);
  const blob=c.encodeWorkspaceBinary(w);await assert.rejects(c.readWorkspaceFile(blob.slice(0,blob.size-1)),/truncated/);
  await assert.rejects(c.readWorkspaceFile(new Blob(['bad'])),/not a Cytofeather/);
  w.gates[0].def.xAngle=Infinity;assert.throws(()=>c.prepareWorkspace(w),/quadrant angles/);
  const bad=new Blob([await blob.slice(0,16).arrayBuffer(),'{}']);await assert.rejects(c.readWorkspaceFile(bad),/truncated/);
});
test('Undo and redo restore gates, metadata, compensation and derived axes while sharing raw columns',()=>{
  const c=appContext(),s=sample();s.rawData=s.data;c.load({samples:[s],gates:quadrants(),axis});
  c.resetHistory();const original=c.run('undoHistory.current'),raw=original.samples[0].data[0];
  c.run("gates[0].name='Renamed';customAxes=[{name:'Ratio',left:'X',right:'Y',operator:'/'}];compensationState={enabled:true,channels:['X','Y'],matrix:[[100,10],[0,100]]};samples.forEach(s=>{applyCompensationToSample(s,compensationState);applyCustomAxes(s,customAxes);})");
  c.commitHistory();assert.equal(c.run('undoHistory.current.samples[0].data[0]'),raw);c.undo();assert.equal(c.run('gates[0].name'),'Q1');assert.equal(c.run('samples[0].params.length'),2);assert.equal(c.run('samples[0].data[0]'),raw);
  c.redo();assert.equal(c.run('gates[0].name'),'Renamed');assert.equal(c.run('samples[0].params.at(-1)'),'Ratio');assert.equal(c.run('samples[0].data[1][0]'),999.9);
  c.undo();c.run("gates[0].name='Different edit'");c.commitHistory();assert.equal(c.run('undoHistory.redo.length'),0);
});
test('Automatic label placement and population navigation do not create spurious undo steps',()=>{
  const c=appContext();c.load({samples:[sample()],gates:quadrants(),axis});c.resetHistory();
  c.run("gates[0].labelPos={x:2,y:8000};currentPopulationId='q0'");c.commitHistory();assert.equal(c.run('undoHistory.undo.length'),0);
  c.run('gates[0].labelPos.manual=true');c.commitHistory();assert.equal(c.run('undoHistory.undo.length'),1);
});
module.exports={appContext};

test('Quadrant statistics and CSV counts agree with membership and sum to the parent population',()=>{
  const c=appContext(),s=sample(),gs=quadrants();c.load({samples:[s],gates:gs,axis});
  const rows=c.statisticsCSV(gs.map(g=>g.id),['X'],['events','mean']).split('\r\n').map(row=>row.split(','));
  const countColumn=rows[0].indexOf('events'),meanColumn=rows[0].indexOf('mean_X');let total=0;
  gs.forEach((g,i)=>{const values=s.data[0].filter((x,k)=>c.pointInGate(g,x,s.data[1][k]));const row=rows[i+1];assert.equal(+row[countColumn],values.length);if(values.length)assert.equal(+row[meanColumn],+(values.reduce((a,b)=>a+b,0)/values.length).toExponential(2));total+=+row[countColumn];});
  assert.equal(total,s.n);
});
test('Workspace validation rejects incomplete or inconsistent linked quadrants',()=>{
  const c=appContext(),w=workspace();w.gates.pop();assert.throws(()=>c.prepareWorkspace(w),/four linked/);
  w.gates=quadrants();w.gates[1].def.x=6;assert.throws(()=>c.prepareWorkspace(w),/share their dividers/);
});

test('V2 multi-plot files open using the saved active plot without enabling multiple plots',()=>{
  const c=appContext(),w=workspace();w.activePanelId='active';w.panels=[{id:'other',axis:w.axis,populationId:null,plotType:'scatter'},{id:'active',axis:{...axis,xMax:20},populationId:'q1',plotType:'scatter-grid',gridCols:'3',plotStyle:{scatterOpacity:.4}}];
  const next=c.prepareWorkspace(w);assert.equal(next.axis.xMax,20);assert.equal(next.currentPopulationId,'q1');assert.equal(next.plotType,'scatter-grid');
  c.load(next);c.run("ui.plotType.value=state.plotType;ui.gridCols.value=state.gridCols");assert.equal(c.serializeWorkspace().panels,undefined);
});
