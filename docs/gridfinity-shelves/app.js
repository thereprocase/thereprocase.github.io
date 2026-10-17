import * as THREE from 'three';
import {OrbitControls} from '/p1s-feet/vendor/OrbitControls.js';
import {defaults,parameters,binarySTL} from './kernel.js?v=backplate-4';
const $=id=>document.getElementById(id),form=$('config'),host=$('viewer');
let worker,result,viewResult,mesh,installed=false;
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){$('viewer-note').textContent='3D rendering is unavailable in this browser. Use the native CAD generator linked below.';$('status').textContent='WebGL is required for this interactive preview.';$('generate').disabled=true;throw e;}renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9dc');
const camera=new THREE.PerspectiveCamera(38,1,.1,5000);camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const bands=new THREE.DataTexture(new Uint8Array([90,155,220,255]),4,1,THREE.RedFormat);bands.needsUpdate=true;bands.magFilter=THREE.NearestFilter;bands.minFilter=THREE.NearestFilter;
const material=new THREE.MeshToonMaterial({color:0x5da3ad,gradientMap:bands});
scene.add(new THREE.HemisphereLight(0xffffff,0x555566,2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(100,-160,250);scene.add(light);
let grid=new THREE.GridHelper(256,16,0x777777,0xbbbbbb);grid.rotation.x=Math.PI/2;grid.position.z=-.1;scene.add(grid);
function values(){return Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof defaults[k]==='boolean'?form.elements[k].checked:Number(form.elements[k].value)]));}
function download(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function updatePose(){if(!mesh)return;mesh.rotation.x=installed?-viewResult.printRotation:0;mesh.position.set(0,installed?-Math.sin(viewResult.printRotation)*viewResult.printZShift:0,installed?-Math.cos(viewResult.printRotation)*viewResult.printZShift:0);grid.visible=!installed;$('print-pose').setAttribute('aria-pressed',String(!installed));$('installed').setAttribute('aria-pressed',String(installed));}
function reset(){const box=mesh?new THREE.Box3().setFromObject(mesh):new THREE.Box3(new THREE.Vector3(-50,-50,0),new THREE.Vector3(50,50,35)),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),d=Math.max(size.x,size.y,size.z)*1.8;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d,-d,d*.85));camera.near=.1;camera.far=Math.max(5000,d*10);camera.updateProjectionMatrix();controls.update();}
function show(r){result=r;viewResult=r;if(mesh){scene.remove(mesh);mesh.geometry.dispose();for(const child of mesh.children){child.geometry.dispose();child.material.dispose();}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(r.vertices,3));g.setIndex(new THREE.BufferAttribute(r.triangles,1));g.computeVertexNormals();
 mesh=new THREE.Mesh(g,material);mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,32),new THREE.LineBasicMaterial({color:0x273c40})));scene.add(mesh);updatePose();reset();
 const p=r.parameters;g.computeBoundingBox();const span=g.boundingBox.getSize(new THREE.Vector3()),width=span.x,depth=span.y;
 const lines=[['Array',`${p.columns} × ${p.rows}`],['Print footprint',`${width.toFixed(1)} × ${depth.toFixed(1)} mm`],['Shelf tilt',`${p.angle}°`],['Mount columns',String(p.mounts.length)],['Mount height',`${p.mount_rows} peg row${p.mount_rows===1?'':'s'}`],['Backplate',p.backplate?'Solid':'Open with cross-ties'],['Gussets',`${p.webColumns.length} · Gridfinity boundaries`],['Solid volume',`${(r.volume/1000).toFixed(2)} cm³`],['Mesh triangles',r.trianglesCount.toLocaleString()],['Pose','Frame face on bed']];
 $('dimensions').replaceChildren(...lines.flatMap(([a,b])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;return [dt,dd];}));
 const notes=['Generated variant: inspect toolpaths and test bin release before loading.'];if(width>256||depth>256)notes.push('Exceeds a 256 × 256 mm P1S bed.');else notes.push('Bounding box fits 256 × 256 mm; plate exclusions and purge space still need checking.');if(p.mount_rows===1)notes.push('Hook-only mounting: no lower locking hoop; check lift-out retention.');if(p.mount_rows>2)notes.push('Taller mounts increase the reaction span; extra rows require an installation and load trial.');if(p.rows>2)notes.push('More than two rows deep: unqualified long cantilever. Geometry checks do not establish a safe load; test peg retention and deflection before use.');else if(p.rows>1)notes.push('Multiple depth rows increase cantilever leverage.');if(p.clearance<0)notes.push('Negative clearance can hold bins above their nominal seated height.');
 $('fit-note').textContent=notes.join(' ');$('status').textContent='Geometry ready · one connected solid · peg preservation passed';$('stl').disabled=false;$('recipe').disabled=false;$('viewer-note').hidden=true;
}
function setBusy(b){$('generate').disabled=b;$('cancel').disabled=!b;}
function generate(){if(!form.reportValidity())return;let p;try{p=values();parameters(p);}catch(e){$('status').textContent=e.message;return;}
 worker?.terminate();result=null;$('stl').disabled=true;$('recipe').disabled=true;setBusy(true);$('status').textContent='Generating and checking geometry…';worker=new Worker('./worker.js?v=backplate-4',{type:'module'});
 worker.onmessage=({data})=>{setBusy(false);worker.terminate();if(data.error){$('status').textContent=`Generation failed: ${data.error}`;return;}show(data.result);};
 worker.onerror=()=>{setBusy(false);worker.terminate();$('status').textContent='Geometry engine could not load. Retry, or use the native CAD generator below.';};worker.postMessage(p);
}
form.onsubmit=e=>{e.preventDefault();generate();};form.oninput=()=>{worker?.terminate();setBusy(false);result=null;$('status').textContent='Settings changed · generate again to update preview and downloads';$('stl').disabled=true;$('recipe').disabled=true;};
$('cancel').onclick=()=>{worker?.terminate();setBusy(false);$('status').textContent='Generation cancelled. Adjust settings or generate again.';};
for(const button of document.querySelectorAll('[data-preset]'))button.onclick=()=>{const [x,y]=button.dataset.preset.split('').map(Number),p={...defaults,columns:x,rows:y,beam:x===1?5:10};for(const [k,v] of Object.entries(p)){if(typeof v==='boolean')form.elements[k].checked=v;else form.elements[k].value=v;}generate();};
$('print-pose').onclick=()=>{installed=false;updatePose();reset();};$('installed').onclick=()=>{installed=true;updatePose();reset();};$('reset-view').onclick=reset;
$('stl').onclick=()=>{if(result)download(binarySTL(result),'model/stl',`gridfinity-${result.parameters.columns}x${result.parameters.rows}-${result.parameters.mount_rows}peg-${result.parameters.backplate?'solid':'open'}-frame-down.stl`);};
$('recipe').onclick=()=>{if(result)download(JSON.stringify(Object.fromEntries(Object.keys(defaults).map(k=>[k,result.parameters[k]])),null,2)+'\n','application/json','gridfinity-recipe.json');};
new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}).observe(host);
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});reset();generate();
