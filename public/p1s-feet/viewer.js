import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {STLLoader} from './vendor/STLLoader.js';
const $=id=>document.getElementById(id),host=$('viewer');
try{
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.localClippingEnabled=true;host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e8e8');
 const camera=new THREE.PerspectiveCamera(36,1,.1,1500);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=500;controls.minDistance=70;
 scene.add(new THREE.HemisphereLight(0xffffff,0x59616c,2.5));
 const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(80,-90,150);scene.add(light);
 const fill=new THREE.DirectionalLight(0xffffff,1.2);fill.position.set(-100,40,60);scene.add(fill);
 const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),0);
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.75,metalness:0,side:THREE.DoubleSide});
 const grid=new THREE.GridHelper(220,22,0xa8adb3,0xc8ccd0);grid.rotation.x=Math.PI/2;grid.position.z=-.1;scene.add(grid);
 const loader=new STLLoader();
 const geometry=await fetch('./p02/geometry.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()});const dimensions=geometry.assembly;
 const [b,c]=await Promise.all([loader.loadAsync('./p02/base.stl'),loader.loadAsync('./p02/cradle.stl')]);
 const base=new THREE.Mesh(b,material(0x66717e)),cradle=new THREE.Mesh(c,material(0x008e9c));scene.add(base,cradle);
 const ball=new THREE.Mesh(new THREE.SphereGeometry(20,48,32),new THREE.MeshStandardMaterial({color:0x20252c,roughness:.85,transparent:true,opacity:.72}));scene.add(ball);
 let layout=false;
 function update(){const e=+$('explode').value;
  base.position.set(layout?-45:0,0,0);cradle.position.set(layout?45:0,0,layout?0:dimensions.seat_z_mm+e);ball.position.set(0,0,dimensions.ball_center_z_mm+e*1.7);ball.visible=$('ball').checked&&!layout;
  [base,cradle,ball].forEach(m=>{m.material.clippingPlanes=$('cut').checked?[plane]:[];m.material.needsUpdate=true});
  $('assembled').setAttribute('aria-pressed',String(!layout));$('layout').setAttribute('aria-pressed',String(layout));$('explode').disabled=layout;
 }
 function reset(){camera.position.set(115,-145,115);controls.target.set(0,0,20);controls.update()}
 $('assembled').onclick=()=>{layout=false;update();reset()};$('layout').onclick=()=>{layout=true;update();camera.position.set(145,-190,180);controls.target.set(0,0,0);controls.update()};
 $('top').onclick=()=>{camera.position.set(0,-.01,layout?280:210);controls.target.set(0,0,10);controls.update()};$('reset').onclick=reset;
 ['explode','ball','cut'].forEach(id=>$(id).addEventListener('input',update));
 new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}).observe(host);
 reset();update();$('loading').remove();
 renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
}catch(e){$('loading').textContent='3D view could not load. The STL and STEP downloads below remain available.';console.error(e)}
