import * as THREE from 'three';
import {OrbitControls} from '/p1s-feet/vendor/OrbitControls.js';
import {STLLoader} from '/p1s-feet/vendor/STLLoader.js';
const $=id=>document.getElementById(id),host=$('viewer');
try{
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.localClippingEnabled=true;host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e8e8');
 const camera=new THREE.PerspectiveCamera(36,1,.1,3000);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=80;controls.maxDistance=1600;
 scene.add(new THREE.HemisphereLight(0xffffff,0x59616c,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(100,-130,200);scene.add(light);
 const fill=new THREE.DirectionalLight(0xffffff,1.2);fill.position.set(-80,100,100);scene.add(fill);
 const dims=(await fetch('./geometry.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()})).assembly;
 const loader=new STLLoader();const [b,c]=await Promise.all([loader.loadAsync('./base.stl'),loader.loadAsync('./floating-pad.stl')]);
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.75,side:THREE.DoubleSide});
 const baseMaterial=material(0x66717e),padMaterial=material(0x008e9c);
 const groups=[];for(let i=0;i<4;i++){const group=new THREE.Group(),base=new THREE.Mesh(b,baseMaterial),pad=new THREE.Mesh(c,padMaterial);group.add(base,pad);scene.add(group);groups.push({group,base,pad})}
 const stoneMaterial=new THREE.MeshStandardMaterial({color:0x92928a,transparent:true,opacity:.38,roughness:1,side:THREE.DoubleSide,depthWrite:false});
 const fullStone=new THREE.Mesh(new THREE.BoxGeometry(dims.paver_reference_side_mm,dims.paver_reference_side_mm,dims.paver_reference_thickness_mm),stoneMaterial);
 const cornerStone=new THREE.Mesh(new THREE.BoxGeometry(96,96,dims.paver_reference_thickness_mm),stoneMaterial);scene.add(fullStone,cornerStone);
 const grid=new THREE.GridHelper(600,30,0xa8adb3,0xc8ccd0);grid.rotation.x=Math.PI/2;grid.position.z=-.15;scene.add(grid);
 const clip=new THREE.Plane(new THREE.Vector3(0,-1,0),0);let mode='single';
 function update(){
  const e=+$('explode').value,offset=(dims.paver_reference_side_mm-dims.width_mm)/2;
  const positions=[[-offset,-offset],[offset,-offset],[offset,offset],[-offset,offset]];
  groups.forEach(({group,base,pad},i)=>{group.visible=mode==='stack'||i===0;group.position.set(mode==='stack'?positions[i][0]:0,mode==='stack'?positions[i][1]:0,0);base.position.set(mode==='layout'?-45:0,0,0);pad.position.set(mode==='layout'?45:0,0,mode==='layout'?0:dims.seat_z_mm+e)});
  fullStone.visible=mode==='stack'&&$('stone').checked;cornerStone.visible=mode==='single'&&$('stone').checked;
  const z=dims.height_under_paver_mm+dims.paver_reference_thickness_mm/2+e*1.5;
  fullStone.position.set(0,0,z);cornerStone.position.set(48-dims.width_mm/2,48-dims.width_mm/2,z);
  [baseMaterial,padMaterial,stoneMaterial].forEach(m=>{m.clippingPlanes=$('cut').checked?[clip]:[];m.needsUpdate=true});
  grid.scale.setScalar(mode==='stack'?1:.4);$('explode').disabled=mode==='layout';$('stone').disabled=mode==='layout';
  ['single','stack','layout'].forEach(id=>$(id).setAttribute('aria-pressed',String(mode===id)));
 }
 function reset(){const stack=mode==='stack';camera.position.set(stack?650:145,stack?-750:-180,stack?550:140);controls.target.set(0,0,stack?35:20);controls.update()}
 ['single','stack','layout'].forEach(id=>$(id).onclick=()=>{mode=id;if(id==='stack')$('stone').checked=true;update();reset()});
 $('reset').onclick=reset;$('top').onclick=()=>{camera.position.set(0,-.01,mode==='stack'?1050:mode==='layout'?320:240);controls.target.set(0,0,10);controls.update()};
 ['explode','stone','cut'].forEach(id=>$(id).addEventListener('input',update));
 new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}).observe(host);
 update();reset();$('loading').remove();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
}catch(e){$('loading').textContent='The 3D view could not load. CAD downloads and the rendered views below remain available.';console.error(e)}
