import Module from './vendor/manifold.js';
import {build,parameters} from './kernel.js?v=female-bases-2';
import {footprintHull,bestPlacement} from './bed-placement.js?v=diagonal-1';
self.onmessage=async({data})=>{try{
 const p=parameters({...data.parameters,columns:1}),{width,depth}=data.bed;
 if(!Number.isFinite(width)||!Number.isFinite(depth)||width<25||depth<25||width>2000||depth>2000)throw Error('Invalid bed dimensions.');
 // A shelf's full-width rear edge cannot exceed the bed diagonal at any angle.
 const upper=Math.min(32,Math.floor(64/p.rows),Math.floor((Math.hypot(width,depth)-4+1e-6)/42));
 if(upper<1){self.postMessage({result:{columns:0,rows:p.rows,tested:0}});return;}
 const [module,inputs]=await Promise.all([Module().then(m=>{m.setup();return m;}),fetch('./inputs.json?v=backplate-4').then(r=>{if(!r.ok)throw Error('Could not load connector geometry.');return r.json();})]);
 if((!p.board_system||p.board_system==='original')&&(p.peg_clearance||p.hook_grip||p.hoop_firmness))inputs.fitLibrary=await fetch('./fit-inputs.json?v=fit-7').then(r=>{if(!r.ok)throw Error('Could not load peg-fit geometry.');return r.json();});
 let tested=0;for(let columns=upper;columns>=1;columns--){self.postMessage({progress:{columns,rows:p.rows,tested,total:upper}});const r=build(module,inputs,{...data.parameters,columns}),placement=bestPlacement(footprintHull(r.vertices),width,depth);tested++;if(placement.fits){self.postMessage({result:{columns,rows:p.rows,placement,tested}});return;}}
 self.postMessage({result:{columns:0,rows:p.rows,tested}});
}catch(e){self.postMessage({error:e.message});}};
