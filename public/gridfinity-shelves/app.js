import {demandRenderer,taskWorker} from '../gridfinity-common/generator-runtime.js?v=runtime-3';
import {readSettingsLink,settingsURL,copySettingsLink} from '../gridfinity-common/settings-link.js?v=share-1';
import {footprintHull,placementAtAngle,bestPlacement} from './bed-placement.js?v=diagonal-1';
import {spacingForBed} from './neighbor-spacing.js?v=base-types-1';
import {boards,boardDefaults,boardSettings} from './boards.js?v=dense-1';
import * as THREE from 'three';
import {OrbitControls} from '/p1s-feet/vendor/OrbitControls.js';
import {defaults,baseTypes,parameters,binarySTL} from './kernel.js?v=female-bases-2';
const $=id=>document.getElementById(id),form=$('config'),host=$('viewer');
let worker,result,viewResult,mesh,installed=false,helperObjects=[],helpersVisible=true,installedHelpersVisible=false;
let widthWorker,widthResult,sharedKind='shelf',busy=false;let ghosts,ghostsEnabled=false,viewHull,fitToBed=false;try{fitToBed=localStorage.getItem('gridfinity-shelf-placement-v1')==='fit';}catch{}
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){$('viewer-note').textContent='3D rendering is unavailable in this browser. Use the native CAD generator linked below.';$('status').textContent='WebGL is required for this interactive preview.';$('generate').disabled=true;$('generate-preview').disabled=true;throw e;}renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9dc');
const camera=new THREE.PerspectiveCamera(38,1,.1,5000);camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const bands=new THREE.DataTexture(new Uint8Array([90,155,220,255]),4,1,THREE.RedFormat);bands.needsUpdate=true;bands.magFilter=THREE.NearestFilter;bands.minFilter=THREE.NearestFilter;
const material=new THREE.MeshToonMaterial({color:0x5da3ad,gradientMap:bands});
const bedTint={enabled:{value:1},size:{value:new THREE.Vector2(256,256)}};
material.onBeforeCompile=shader=>{
 shader.uniforms.bedTintEnabled=bedTint.enabled;shader.uniforms.bedTintSize=bedTint.size;
 shader.vertexShader='varying vec2 bedWorldXY;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nbedWorldXY=(modelMatrix*vec4(transformed,1.0)).xy;');
 shader.fragmentShader='uniform float bedTintEnabled; uniform vec2 bedTintSize; varying vec2 bedWorldXY;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(bedTintEnabled>0.5 && (bedWorldXY.x<0.0 || bedWorldXY.y<0.0 || bedWorldXY.x>bedTintSize.x || bedWorldXY.y>bedTintSize.y)) diffuseColor.rgb=vec3(0.95,0.06,0.035);');
};

scene.add(new THREE.HemisphereLight(0xffffff,0x555566,2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(100,-160,250);scene.add(light);
const bedPresets={'180':[180,180],'220':[220,220],'250x210':[250,210],'256':[256,256],'300':[300,300],'350':[350,350]},bedKey='gridfinity-shelf-bed-v1';
let bedWidth=256,bedDepth=256,bedPreset='256',bed;
const validBed=(w,d)=>Number.isFinite(w)&&Number.isFinite(d)&&w>=25&&w<=2000&&d>=25&&d<=2000;
try{const saved=JSON.parse(localStorage.getItem(bedKey));if(saved&&validBed(saved.width,saved.depth)){bedWidth=saved.width;bedDepth=saved.depth;bedPreset=Object.keys(bedPresets).find(k=>bedPresets[k][0]===bedWidth&&bedPresets[k][1]===bedDepth)??'custom';}}catch{}
function updateSpacingTable(){
 const selected=form.elements.board_system.value,fmt=v=>Number(v.toFixed(2)).toString();
 $('spacing-bed').textContent=`Unrotated shelf widths up to your ${bedWidth} mm bed width (maximum 32 cells). Aligned, same-height neighbors; 42 mm Gridfinity pitch is unchanged. Empty holes are counted between the nearest mounts on the same horizontal row. Staggered layouts keep their row phase.`;
 $('spacing-tables').replaceChildren(...Object.entries(boards).map(([id,b])=>{
 const details=document.createElement('details');details.open=id===selected;const summary=document.createElement('summary');summary.textContent=b.name+(id===selected?' · selected':'');details.append(summary);
 const wrap=document.createElement('div');wrap.className='spacing-scroll';const table=document.createElement('table');const caption=document.createElement('caption');caption.textContent=`${Number(b.pitchX.toFixed(2))} mm between hole columns`;
 table.append(caption);const head=document.createElement('thead');head.innerHTML='<tr><th scope="col">Cells wide</th><th scope="col">Width mm</th><th scope="col">Repeat mm</th><th scope="col">Edge gap mm</th><th scope="col">Empty holes</th></tr>';table.append(head);
 const body=document.createElement('tbody');for(const r of spacingForBed(id,bedWidth)){const tr=document.createElement('tr');if(Number(form.elements.columns.value)===r.columns&&id===selected)tr.className='spacing-current';for(const v of [r.columns,fmt(r.width),fmt(r.spacing),fmt(r.gap),r.emptyHoles]){const td=document.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);details.append(wrap);return details;
 }));
}
function bedSummary(){updateSpacingTable();
 let text=`${bedWidth} × ${bedDepth} mm · 10 mm grid`;$('bed-status').dataset.overflow='false';
 if(mesh&&viewHull){const p=printPlacement();$('bed-status').dataset.overflow=String(!p.fits);text+=` · ${p.angle.toFixed(2)}° · ${p.width.toFixed(1)} × ${p.depth.toFixed(1)} mm footprint`;if(!p.fits)text+=` · Exceeds bed at ${p.angle.toFixed(2)}°.`;}
 $('fit-bed').setAttribute('aria-pressed',String(fitToBed));$('straight-bed').setAttribute('aria-pressed',String(!fitToBed));
 $('bed-status').textContent=text;$('bed-legend-size').textContent=`${bedWidth} × ${bedDepth} mm bed · 10 mm grid`;
}
function rebuildBed(syncControls=true){
 if(bed){scene.remove(bed);bed.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}
 bed=new THREE.Group();const plate=new THREE.Mesh(new THREE.PlaneGeometry(bedWidth,bedDepth),new THREE.MeshBasicMaterial({color:0xdfe3e2,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));plate.position.set(bedWidth/2,bedDepth/2,-.18);plate.renderOrder=-2;bed.add(plate);
 const minor=[],major=[];for(let x=10;x<bedWidth;x+=10)(x%50===0?major:minor).push(x,0,-.12,x,bedDepth,-.12);for(let y=10;y<bedDepth;y+=10)(y%50===0?major:minor).push(0,y,-.12,bedWidth,y,-.12);
 for(const [vertices,color] of [[minor,0xb5bdbc],[major,0x798986]]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const lines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,depthWrite:false}));lines.renderOrder=-1;bed.add(lines);}
 const outline=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-.1),new THREE.Vector3(bedWidth,0,-.1),new THREE.Vector3(bedWidth,bedDepth,-.1),new THREE.Vector3(0,bedDepth,-.1)]);const edge=new THREE.LineLoop(outline,new THREE.LineBasicMaterial({color:0x273c40,depthWrite:false}));edge.renderOrder=-1;bed.add(edge);scene.add(bed);bed.visible=!installed;
 $('bed-preset').value=bedPreset;if(syncControls){$('bed-width').value=bedWidth;$('bed-depth').value=bedDepth;}bedSummary();
}
function applyBed(w,d,preset,syncControls=true){
 cancelWidthSearch();
 if(!validBed(w,d)){$('bed-status').textContent='Enter bed dimensions from 25 to 2000 mm. The previous bed is still shown.';$('bed-status').dataset.overflow='true';return;}
 bedWidth=w;bedDepth=d;bedPreset=preset;rebuildBed(syncControls);updatePose();if(!installed)reset();try{localStorage.setItem(bedKey,JSON.stringify({width:w,depth:d}));}catch{}
}
$('bed-preset').onchange=()=>{const id=$('bed-preset').value;if(id==='custom'){bedPreset=id;$('bed-width').focus();return;}applyBed(...bedPresets[id],id);};
for(const id of ['bed-width','bed-depth'])$(id).oninput=()=>{const w=Number($('bed-width').value),d=Number($('bed-depth').value);$('bed-preset').value='custom';applyBed(w,d,'custom',false);};
rebuildBed();
function values(){return Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof defaults[k]==='boolean'?form.elements[k].checked:typeof defaults[k]==='string'?form.elements[k].value:Number(form.elements[k].value)]));}
function download(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function updateHelpers(){const visible=installed?installedHelpersVisible:helpersVisible;for(const h of helperObjects)h.visible=visible;$('helpers').setAttribute('aria-pressed',String(visible));$('helpers').textContent=visible?'Hide reinforcement':'Show reinforcement';$('helper-legend-state').textContent=helperObjects.length?(visible?'shown':'hidden'):'unavailable';}
function clearGhosts(){if(!ghosts)return;scene.remove(ghosts);ghosts.traverse(o=>{if(o.material)o.material.dispose();});ghosts=null;}
function updateGhosts(){
 clearGhosts();$('neighbors').setAttribute('aria-pressed',String(ghostsEnabled));$('neighbor-note').hidden=!ghostsEnabled;$('ghost-legend').hidden=!(ghostsEnabled&&installed);
 if(!mesh||!ghostsEnabled)return;
 $('neighbor-note').textContent='Neighbor ghosts appear in Installed pose.';if(!installed)return;
 const b=boards[viewResult.parameters.board_system],box=new THREE.Box3().setFromObject(mesh),size=box.getSize(new THREE.Vector3());
 // Aligned copies preserve the complete lattice, including alternating slot/hex phases.
 const sx=b.pitchX*(viewResult.parameters.board_system==='hsw'?2:1),sz=b.pitchZ*(viewResult.parameters.board_system==='skadis'?2:1);
 const dx=Math.ceil((size.x-1e-4)/sx)*sx,dz=Math.ceil((size.z-1e-4)/sz)*sz;
 ghosts=new THREE.Group();for(const [x,z] of [[-dx,0],[dx,0],[0,-dz],[0,dz]]){
 const g=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({color:0x5270cc,transparent:true,opacity:.18,depthWrite:false}));g.rotation.copy(mesh.rotation);g.position.copy(mesh.position).add(new THREE.Vector3(x,0,z));ghosts.add(g);
 }scene.add(ghosts);
 const sites=viewResult.parameters.mountSites,xs=sites.filter(s=>Math.abs(s.z-sites[0].z)<1e-4).map(s=>s.x),span=Math.max(...xs)-Math.min(...xs),steps=Math.round((dx-span)/(b.pitchX*(viewResult.parameters.board_system==='hsw'?2:1))),empty=Math.max(0,steps-1);
 $('neighbor-note').textContent=`Blue ghosts: aligned copies on board holes. Side by side: move ${dx.toFixed(2)} mm (${Math.round(dx/b.pitchX)} columns); ${empty} empty hole${empty===1?'':'s'} between mounting columns, ${Math.max(0,dx-size.x).toFixed(2)} mm between edges. Stacked: move ${dz.toFixed(2)} mm (${Math.round(dz/b.pitchZ)} rows). Copies use the nearest aligned holes that clear the model envelope. Downloads contain only your model.`;
}
$('neighbors').onclick=()=>{ghostsEnabled=!ghostsEnabled;if(ghostsEnabled)installed=true;updatePose();reset();};
function fileStem(r){const p=r.parameters,n=v=>String(Number(Number(v).toFixed(3))).replace('-','minus').replace('.','p');return `${p.board_system}-${r.kind??'shelf'}-${p.columns}x${p.rows}-${p.base_type}-${p.mount_rows}peg-${p.backplate?'solid':'open'}-tilt${n(p.angle)}-seat${n(p.clearance)}-web${n(p.gusset??p.web??2.4)}-beam${n(p.beam)}-${p.board_system==='original'?`peg${n(p.peg_clearance)}-grip${n(p.hook_grip)}-hoop${n(p.hoop_firmness)}`:boards[p.board_system].mode==='bolted'?`screw${n(p.screw_clearance)}-head${n(p.head_clearance)}-recess${n(p.counterbore_depth)}`:`fit${n(p.slot_clearance)}-lower${n(p.lower_clearance)}-panel${n(p.board_thickness)}-gap${n(p.board_gap)}`}`;}
function printPlacement(){return fitToBed?bestPlacement(viewHull,bedWidth,bedDepth):placementAtAngle(viewHull,bedWidth,bedDepth,0);}
function updatePose(){bedTint.enabled.value=installed?0:1;bedTint.size.value.set(bedWidth,bedDepth);$('overhang-legend').hidden=installed;bed.visible=!installed;$('bed-legend').hidden=installed;if(!mesh)return;mesh.rotation.set(installed?-viewResult.printRotation:0,0,installed?0:printPlacement().angle*Math.PI/180);if(installed)mesh.position.set(0,-Math.sin(viewResult.printRotation)*viewResult.printZShift,-Math.cos(viewResult.printRotation)*viewResult.printZShift);else{const p=printPlacement();mesh.position.set(p.x,p.y,0);}$('print-pose').setAttribute('aria-pressed',String(!installed));$('installed').setAttribute('aria-pressed',String(installed));updateHelpers();updateGhosts();bedSummary();}
function reset(){const box=mesh?new THREE.Box3().setFromObject(mesh):new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(bedWidth,bedDepth,35));if(installed&&ghosts)box.union(new THREE.Box3().setFromObject(ghosts));if(!installed)box.union(new THREE.Box3(new THREE.Vector3(0,0,-.18),new THREE.Vector3(bedWidth,bedDepth,0)));const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),d=Math.max(size.x,size.y,size.z)*1.8;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d,-d,d*.85));camera.near=.1;camera.far=Math.max(5000,d*10);camera.updateProjectionMatrix();controls.update();}
function show(r){viewLoop.request();clearGhosts();result=r;viewResult=r;viewHull=footprintHull(r.vertices);if(mesh){scene.remove(mesh);mesh.geometry.dispose();for(const child of mesh.children){child.geometry.dispose();child.material.dispose();}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(r.vertices,3));g.setIndex(new THREE.BufferAttribute(r.triangles,1));g.computeVertexNormals();
 mesh=new THREE.Mesh(g,material);mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,32),new THREE.LineBasicMaterial({color:0x273c40})));helperObjects=(r.helpers??[]).map(h=>{const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.BufferAttribute(h.vertices,3));hg.setIndex(new THREE.BufferAttribute(h.triangles,1));const hm=new THREE.Mesh(hg,new THREE.MeshBasicMaterial({color:0xffd600,transparent:true,opacity:.32,depthWrite:false,depthTest:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));hm.renderOrder=2;mesh.add(hm);return hm;});scene.add(mesh);updatePose();reset();
 const p=r.parameters;g.computeBoundingBox();const span=g.boundingBox.getSize(new THREE.Vector3()),width=span.x,depth=span.y;
 const lines=[['Base type',baseTypes[p.base_type]],['Board',boards[p.board_system].name],['Array',`${p.columns} × ${p.rows}`],['Unrotated footprint',`${width.toFixed(1)} × ${depth.toFixed(1)} mm`],['Shelf tilt',`${p.angle}°`],['Mount columns',p.board_system==='skadis'?p.mountZ.map(z=>p.mountSites.filter(s=>s.z===z).length).join(' / ')+' per row':String(p.mounts.length)],['Total mounts',String(p.mountSites.length)],['Mount height',`${p.mount_rows} peg row${p.mount_rows===1?'':'s'}`],['Backplate',p.backplate?'Solid':'Open with cross-ties'],['Gussets',`${p.webColumns.length} · Gridfinity boundaries`],['Solid volume',`${(r.volume/1000).toFixed(2)} cm³`],['Mesh triangles',r.trianglesCount.toLocaleString()],['Export pose','Frame face on bed']];
 if(r.kind==='coupon')lines.splice(0,lines.length,['Part',boards[p.board_system].mode==='bolted'?'Screw-fit coupon':'Peg-pair fit coupon'],['Board',boards[p.board_system].name],['Hole spacing',p.board_system==='skadis'?'20 mm stagger · 40 mm same row':`${boards[p.board_system].pitchZ} mm`],['Unrotated footprint',`${width.toFixed(1)} × ${depth.toFixed(1)} mm`],['Solid volume',`${(r.volume/1000).toFixed(2)} cm³`]);if(p.board_system==='original')lines.push(['Peg clearance / side',`${p.peg_clearance.toFixed(2)} mm`],['Hook grip',`${p.hook_grip.toFixed(2)} mm`],['Hoop firmness',`${p.hoop_firmness.toFixed(2)} mm`]);else if(boards[p.board_system].mode==='bolted')lines.push(['M3 screw clearance / side',`${p.screw_clearance.toFixed(2)} mm`],['Head clearance / side',`${p.head_clearance.toFixed(2)} mm`],['Head recess depth',`${p.counterbore_depth.toFixed(2)} mm`],['Required M3 inserts',String(p.mountSites.length)]);else lines.push([p.board_system==='skadis'?'Slot clearance / side':'Upper pin clearance / side',`${p.slot_clearance.toFixed(2)} mm`],['Board thickness',`${p.board_thickness.toFixed(2)} mm`],['Board gap',`${p.board_gap.toFixed(2)} mm`],...(p.board_system==='skadis'?[['Retainer depth',`${p.retainer_depth.toFixed(2)} mm`]]:[['Hole opening',`${p.hole_diameter.toFixed(3)} mm`],['Lower pin clearance / side',`${p.lower_clearance.toFixed(2)} mm`]]) );
 if(r.helpers?.length)lines.push(['Reinforcement',`${r.helpers.length} helper bod${r.helpers.length===1?'y':'ies'} · 3.5 mm margin`]);
 bedSummary();
 $('dimensions').replaceChildren(...lines.flatMap(([a,b])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;return [dt,dd];}));
 const notes=[];if(r.kind!=='coupon'&&p.base_type==='weighted')notes.push('Weighted shelf: 6×2 mm magnet pockets, M3 clearance and underside head access, 21.4 mm square × 4 mm ballast cavities and shallow foot recesses. Added ballast increases pegboard load; hardware fit and cavity bridging need testing.');if(r.kind==='coupon')notes.push('Try this pair on your board, then keep these peg-fit settings for the shelf.');if(p.board_system!=='original'&&boards[p.board_system].mode!=='bolted')notes.push('Support the hook ledges in the supplied frame-down pose.');if(p.board_system==='original'&&p.mount_rows===1)notes.push('Mini mount: hooks only, without lower locking hoops.');if(p.rows>1)notes.push('For deeper shelves, the mounting-height and gusset controls add support underneath.');if(p.clearance<0)notes.push('A tighter seat can make bins sit slightly higher.');
 if(r.reinforcementError)notes.push('Reinforcement export unavailable: '+r.reinforcementError);$('fit-note').textContent=notes.join(' ');$('status').textContent='Geometry ready · choose a download format';$('stl').disabled=false;$('recipe').disabled=false;$('viewer-note').hidden=true;for(const id of ['step','three-mf','helpers'])$(id).disabled=!r.helpers?.length;$('stl').textContent=r.kind==='coupon'?(boards[p.board_system].mode==='bolted'?'Download screw-fit STL':'Download peg-pair STL'):'Download STL';
}
function setBusy(b){document.documentElement.dataset.busy=String(b);busy=b;$('use-width').disabled=b;$('find-width').disabled=b||!!widthWorker;for(const id of ['step','three-mf','helpers'])$(id).disabled=b||!result?.helpers?.length;form.elements.board_system.disabled=b;$('coupon').disabled=b;$('generate-preview').disabled=b;$('generate-preview').textContent=b?'Generating…':'Generate preview';$('generate').disabled=b;$('cancel').disabled=!b;}
function generate(kind='shelf'){if(widthWorker)cancelWidthSearch();if(kind==='shelf'&&!form.reportValidity())return;let p;try{p=kind==='coupon'?{...defaults,columns:1,rows:1,...Object.fromEntries(['base_type','board_system',...Object.keys(boardDefaults).filter(k=>k!=='board_system'),'peg_clearance','hook_grip','hoop_firmness'].map(k=>[k,typeof defaults[k]==='string'?form.elements[k].value:Number(form.elements[k].value)]))}:values();parameters(p);}catch(e){$('status').textContent=e.message;return;}
 worker?.terminate();result=null;$('stl').disabled=true;$('recipe').disabled=true;setBusy(true);$('status').textContent=kind==='coupon'?'Building your mount coupon…':'Building your shelf…';$('viewer-note').textContent=mesh?'Previous model · computing new geometry…':'Computing geometry in your browser…';$('viewer-note').hidden=false;worker=taskWorker('./worker.js?v=female-bases-2',$('status'));
 worker.onmessage=({data})=>{setBusy(false);worker.terminate();if(data.error){$('viewer-note').textContent=mesh?'Previous model · generation failed':'No new model generated. See the error below.';$('viewer-note').hidden=false;$('status').textContent=`Generation failed: ${data.error}`;return;}show(data.result);};
 worker.onerror=()=>{setBusy(false);worker.terminate();$('viewer-note').textContent=mesh?'Previous model · geometry engine failed to load':'Geometry engine failed to load.';$('viewer-note').hidden=false;$('status').textContent='Geometry engine could not load. Retry, or use the native CAD generator below.';};worker.postMessage({parameters:p,kind});
}
form.onsubmit=e=>{e.preventDefault();generate();};form.oninput=()=>{cancelWidthSearch();updateSpacingTable();worker?.terminate();setBusy(false);result=null;$('status').textContent='Settings changed · select Generate preview to update the model and downloads';$('viewer-note').textContent=mesh?'Previous model · generate to update':'No model generated · select Generate preview';$('viewer-note').hidden=false;$('stl').disabled=true;$('recipe').disabled=true;for(const id of ['step','three-mf','helpers'])$(id).disabled=true;};
$('coupon').onclick=()=>generate('coupon');$('reset-fit').onclick=()=>{for(const k of ['peg_clearance','hook_grip','hoop_firmness',...Object.keys(boardDefaults).filter(k=>k!=='board_system')])form.elements[k].value=boardSettings(form.elements.board_system.value)[k]??defaults[k];form.oninput();};
$('cancel').onclick=()=>{worker?.terminate();setBusy(false);if(result){$('status').textContent='Export cancelled. Your generated shelf is kept; retry export when ready.';return;}$('status').textContent='Generation cancelled. Adjust settings or generate again.';$('viewer-note').textContent=mesh?'Previous model · generation cancelled':'Generation cancelled · select Generate preview';$('viewer-note').hidden=false;};
for(const button of document.querySelectorAll('[data-preset]'))button.onclick=()=>{cancelWidthSearch();const [x,y]=button.dataset.preset.split('').map(Number),p={...defaults,columns:x,rows:y,beam:x===1?5:10,...Object.fromEntries(['base_type','board_system',...Object.keys(boardDefaults).filter(k=>k!=='board_system'),'peg_clearance','hook_grip','hoop_firmness'].map(k=>[k,typeof defaults[k]==='string'?form.elements[k].value:Number(form.elements[k].value)]))};for(const [k,v] of Object.entries(p)){if(typeof v==='boolean')form.elements[k].checked=v;else form.elements[k].value=v;}generate();};
for(const [id,fit] of [['fit-bed',true],['straight-bed',false]])$(id).onclick=()=>{fitToBed=fit;installed=false;try{localStorage.setItem('gridfinity-shelf-placement-v1',fit?'fit':'straight');}catch{}updatePose();reset();};
$('print-pose').onclick=()=>{installed=false;updatePose();reset();};$('installed').onclick=()=>{installed=true;updatePose();reset();};$('reset-view').onclick=reset;
$('stl').onclick=()=>{if(!result||busy)return;const start=performance.now();download(binarySTL(result),'model/stl',fileStem(result)+'-frame-down.stl');const elapsed=performance.now()-start;document.documentElement.dataset.lastTaskMS=String(elapsed);document.documentElement.dataset.lastTaskOutcome='success';$('status').textContent='Geometry ready · STL downloaded · '+(elapsed/1000).toFixed(2)+' s';};
$('helpers').onclick=()=>{if(installed)installedHelpersVisible=!installedHelpersVisible;else helpersVisible=!helpersVisible;updateHelpers();};
function exportSolids(format){if(!result?.helpers?.length)return;const exportResult=result,exportBed={width:bedWidth,depth:bedDepth,rotationDeg:printPlacement().angle},exportName=fileStem(exportResult)+'-reinforced'+(format==='3mf'?'-bed'+exportBed.rotationDeg.toFixed(2).replace('.','p')+'deg':'')+'.'+(format==='step'?'step':'3mf');setBusy(true);$('status').textContent='Preparing '+format.toUpperCase()+' download…';worker=taskWorker('./export-worker.js?v=female-bases-2',$('status'));worker.onmessage=({data})=>{worker.terminate();setBusy(false);if(data.error){$('status').textContent='Export failed: '+data.error;return;}download(data.bytes,format==='step'?'application/step':'model/3mf',exportName);$('status').textContent='Geometry ready · '+format.toUpperCase()+' downloaded';};worker.onerror=()=>{worker.terminate();setBusy(false);$('status').textContent='Export failed. Generate again or retry.';};worker.postMessage({format,result:exportResult,bed:exportBed});}
$('step').onclick=()=>exportSolids('step');$('three-mf').onclick=()=>exportSolids('3mf');
$('recipe').onclick=()=>{if(result)download(JSON.stringify(Object.fromEntries(Object.keys(defaults).filter(k=>(result.parameters.board_system!=='original'||!(k in boardDefaults))&&(k!=='base_type'||result.parameters.base_type!=='frame')).map(k=>[k,result.parameters[k]])),null,2)+'\n','application/json',fileStem(result)+'-parameters.json');};
let previousBoard='original';
function updateBoardUI(){
 updateSpacingTable();
 const id=form.elements.board_system.value,original=id==='original',skadis=id==='skadis',b=boards[id],bolted=b.mode==='bolted';
 if(id!==previousBoard){for(const [k,v] of Object.entries(boardSettings(id)))if(k!=='board_system')form.elements[k].value=v;previousBoard=id;}
 for(const [field,show] of [['original-fit',original],['slot-fit',!original&&!bolted],['bolt-fit',bolted]]){const f=$(field);f.hidden=!show;for(const e of f.querySelectorAll('input'))e.disabled=!show;}
 $('retainer-control').hidden=!skadis;form.elements.retainer_depth.disabled=!skadis;
 $('round-extra').hidden=original||skadis||bolted;for(const e of $('round-extra').querySelectorAll('input'))e.disabled=original||skadis||bolted;
 form.elements.board_thickness.min=skadis?'4':'.5';form.elements.board_thickness.max=skadis?'6.5':'8';
 $('board-fit-title').textContent=skadis?'SKÅDIS slot fit':'Hole and panel fit';$('pin-clearance-label').textContent=skadis?'Slot clearance / side · mm':'Upper pin clearance / side · mm';$('hole-size-label').textContent=b.mode==='square'?'Actual square hole side · mm':'Actual hole diameter · mm';
 $('board-status').textContent=original?'PF02 upper hooks and PF07 lower hoops from the peg repository.':'Modeled from reference dimensions; not print tested. '+(bolted?'Uses the original board’s M3 inserts, connected with screws.':skadis?'Adapted from John Mylchreest’s MIT-licensed connector library.':'L-hook and locating pin adapted from Eugene Vasenev’s MIT-licensed model.');
 $('mount-hint').textContent=original?'Every usable hole across the selected width is populated. Two rows is the default; taller mounts add lower hoops and bearing pegs between.':skadis?'Hooks follow the staggered SKÅDIS slots: 40 mm across a row, 20 mm between alternating rows. Narrow shelves skip rows that cannot fit a hook inside the backplate.':`Every usable hole is populated: ${Number(b.pitchX.toFixed(4))} mm across and ${b.pitchZ} mm down. `+(bolted?'M3 screws attach the backplate to the board inserts. ':'An upper L-hook retains the shelf; the lower pins locate it. ')+(id==='wall_control'?'This preset uses the round holes, not the proprietary slots. Default panel thickness is a provisional 0.9 mm; measure yours.':id==='bott_perfo'?'Rounded pins fit the square perforations. These are our hooks, not the Perfo locking-clip interface. The 0.9 mm panel thickness is provisional; measure yours.':'');
 $('coupon-hint').textContent=original?'The coupon uses two holes one inch apart.':skadis?'The coupon uses two slots, offset 20 mm horizontally and vertically. Both have drop-in retaining tails.':bolted?`The coupon has two M3 screw mounts ${b.pitchZ} mm apart.`:`The coupon uses an L-hook and lower pin in two holes ${b.pitchZ} mm apart.`;
 $('adapter-note').textContent=id==='multiboard'?'Print the official Drop-In Nut Snap — M3, add an M3 nut to each snap, then fasten through this backplate. Seat the backplate on the snap faces and choose screw length for full nut engagement. Use a short L-shaped Allen key in the screw-access pockets.':id==='hsw'?'Use the original HSW insert-m3 with its M3 hardware. The backplate seats on the insert faces. Every hex column is used, with alternating columns offset vertically by 11.8 mm; vertical holes remain 23.6 mm apart. Choose screw length for your inserts. Use a short L-shaped Allen key in the screw-access pockets.':'';$('adapter-link').href=b.insert??'https://multibuild.io/parts';
 $('native-source-note').hidden=!original;$('board-source-note').hidden=original;
}
form.elements.board_system.addEventListener('change',updateBoardUI);updateBoardUI();
function feedback(){
 let p;try{p=result?.parameters??values();}catch{p={board_system:form.elements.board_system.value};}
 const recipe=Object.fromEntries(Object.keys(defaults).map(k=>[k,p[k]]));
 const part=result?(result.kind==='coupon'?'Fit coupon':'Shelf'):'Settings only';
 const text=`Board: ${boards[p.board_system]?.name??p.board_system}\nPart: ${part}\nModel revision: base-types-1\n\nFit / print observations:\n${$('feedback-notes').value}\n\nMeasured board dimensions (mm):\n${$('feedback-measurements').value}\n\nParameters:\n\`\`\`json\n${JSON.stringify(recipe,null,2)}\n\`\`\`\n`;
 return {recipe,text,part};
}
$('feedback-open').onclick=()=>{const {text}=feedback();const url=new URL('https://github.com/thereprocase/thereprocase.github.io/issues/new');url.searchParams.set('title','Gridfinity board fit: '+boards[form.elements.board_system.value].name);url.searchParams.set('body',text);window.open(url.href,'_blank','noopener');};
$('feedback-save').onclick=()=>{const {recipe,text,part}=feedback();download(JSON.stringify({date:new Date().toISOString(),revision:'base-types-1',part,parameters:recipe,feedback:text},null,2)+'\n','application/json','gridfinity-board-feedback.json');};
function cancelWidthSearch(message='Settings changed · find the largest width again.'){
 if(widthWorker||widthResult){widthWorker?.terminate();widthWorker=null;widthResult=null;$('width-result').textContent=message;}
 $('find-width').disabled=busy;$('cancel-width').disabled=true;$('use-width').hidden=true;
}
$('find-width').onclick=()=>{
 let input;try{if(!form.reportValidity())return;input=values();parameters({...input,columns:1});}catch(e){$('width-result').textContent=e.message;return;}
 cancelWidthSearch();widthResult=null;$('find-width').disabled=true;$('cancel-width').disabled=false;$('width-result').textContent='Checking supported widths in your browser…';
 const search=widthWorker=new Worker('./search-width-worker.js?v=female-bases-2',{type:'module'});
 const finish=()=>{widthWorker?.terminate();widthWorker=null;$('find-width').disabled=busy;$('cancel-width').disabled=true;};
 widthWorker.onmessage=({data})=>{if(widthWorker!==search)return;if(data.progress){$('width-result').textContent=`Checking ${data.progress.columns} × ${data.progress.rows}, including diagonal placement…`;return;}
 finish();if(data.error){$('width-result').textContent='Width check failed: '+data.error;return;}
 widthResult=data.result;if(!widthResult.columns){$('width-result').textContent=`No supported width fits this bed at ${widthResult.rows} cells deep, including diagonally.`;return;}
 const r=widthResult;$('width-result').textContent=`Largest supported width at this depth: ${r.columns} × ${r.rows} · ${r.placement.angle.toFixed(2)}° · ${r.placement.width.toFixed(1)} × ${r.placement.depth.toFixed(1)} mm footprint.`;$('use-width').textContent=`Use ${r.columns} × ${r.rows}`;$('use-width').hidden=false;
 };
 widthWorker.onerror=()=>{if(widthWorker!==search)return;finish();$('width-result').textContent='Width check could not complete. Retry.';};widthWorker.postMessage({parameters:input,bed:{width:bedWidth,depth:bedDepth}});
};
$('cancel-width').onclick=()=>cancelWidthSearch('Width check cancelled.');
$('use-width').onclick=()=>{if(!widthResult?.columns)return;const columns=widthResult.columns;form.elements.columns.value=columns;fitToBed=true;installed=false;updatePose();reset();try{localStorage.setItem('gridfinity-shelf-placement-v1','fit');}catch{}generate();};
$('share-settings').onclick=async()=>{
 try{if(!form.reportValidity())return;const input=values();parameters(input);const url=settingsURL(location.href,'shelves',input,{bed:{width:bedWidth,depth:bedDepth},fitToBed,installed,ghosts:ghostsEnabled,helpersVisible,installedHelpersVisible,kind:result?.kind==='coupon'?'coupon':'shelf'});$('share-url').value=url;$('share-url').hidden=false;$('share-status').textContent='Copying settings link…';const copied=await copySettingsLink(url);$('share-url').hidden=copied;$('share-status').textContent=copied?'Settings link copied.':'Copy the settings link below.';if(!copied){$('share-url').focus();$('share-url').select();}}
 catch(e){$('share-status').textContent='Could not make settings link: '+e.message;}
};
function restoreSharedSettings(){
 try{const linked=readSettingsLink(location.href,'shelves',defaults);if(!linked)return false;parameters(linked.parameters);const v=linked.view;
 if(v.kind!==undefined&&!['shelf','coupon'].includes(v.kind))throw Error('Invalid linked part.');
 if(v.bed&&!validBed(v.bed.width,v.bed.depth))throw Error('Invalid linked bed size.');
 for(const k of ['fitToBed','installed','ghosts','helpersVisible','installedHelpersVisible'])if(v[k]!==undefined&&typeof v[k]!=='boolean')throw Error('Invalid linked view setting.');
 sharedKind=v.kind??'shelf';cancelWidthSearch();for(const [k,value] of Object.entries(linked.parameters)){const field=form.elements[k];if(typeof value==='boolean')field.checked=value;else field.value=value;}
 previousBoard=form.elements.board_system.value;updateBoardUI();if(v.fitToBed!==undefined)fitToBed=v.fitToBed;if(v.installed!==undefined)installed=v.installed;if(v.ghosts!==undefined)ghostsEnabled=v.ghosts;if(v.helpersVisible!==undefined)helpersVisible=v.helpersVisible;if(v.installedHelpersVisible!==undefined)installedHelpersVisible=v.installedHelpersVisible;
 if(v.bed)applyBed(v.bed.width,v.bed.depth,Object.keys(bedPresets).find(k=>bedPresets[k][0]===v.bed.width&&bedPresets[k][1]===v.bed.depth)??'custom');
 $('share-status').textContent='Settings restored from link.';return true;
 }catch(e){$('share-status').textContent='Could not load settings link: '+e.message;return false;}
}
addEventListener('hashchange',()=>{if(restoreSharedSettings())generate(sharedKind);});
const viewLoop=demandRenderer({renderer,controls,scene,camera,host});restoreSharedSettings();reset();generate(sharedKind);
addEventListener('pagehide',()=>{worker?.terminate();cancelWidthSearch('Width check stopped.');setBusy(false);$('status').textContent=result?'Operation stopped. Generated shelf is kept.':'Operation stopped. Generate to retry.';});
