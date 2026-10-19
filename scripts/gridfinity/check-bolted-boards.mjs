import fs from 'node:fs';import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';import {build,buildCoupon,binarySTL,parameters} from '../../public/gridfinity-shelves/kernel.js';import {boards} from '../../public/gridfinity-shelves/boards.js';
const out=process.argv[2]||'/tmp/gridfinity-bolted';fs.mkdirSync(out,{recursive:true});const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url))),results=[];
function check(r){const all=[],keep=o=>(all.push(o),o),M=m.Manifold,p=r.parameters;try{
 const solid=keep(keep(keep(new M(new m.Mesh({numProp:3,vertProperties:r.vertices,triVerts:r.triangles}))).translate([0,0,-r.printZShift])).rotate([-r.printRotation*180/Math.PI,0,0])),face=Math.fround(.15),bearing=face+5.4-p.counterbore_depth;
 let intrusion=0,missingBearing=0,approachIntrusion=0,chamferIntrusion=0;
 const cyl=(rad,len,y,x,z)=>keep(keep(keep(M.cylinder(len,rad,rad,64)).rotate([90,0,0])).translate([x,y,z]));
 for(const {x,z} of p.mountSites){
  const screw=keep(M.union([cyl(1.5,12,bearing,x,z),cyl(2.75,3,bearing+3,x,z)]));intrusion=Math.max(intrusion,keep(screw.intersect(solid)).volume());
  approachIntrusion=Math.max(approachIntrusion,keep(cyl(2.75,9.98,face+15.4,x,z).intersect(solid)).volume());
  const mouth=keep(keep(keep(M.cylinder(.28,2.75+p.head_clearance+.28,2.75+p.head_clearance,64)).rotate([90,0,0])).translate([x,face+5.39,z]));chamferIntrusion=Math.max(chamferIntrusion,keep(mouth.intersect(solid)).volume());
  const ring=keep(cyl(2.75,bearing-face-.04,bearing-.02,x,z).subtract(cyl(1.5+p.screw_clearance+.02,8,face+6,x,z)));missingBearing=Math.max(missingBearing,keep(ring.subtract(solid)).volume());
 }
 assert(chamferIntrusion<.001,`recess chamfer intrusion ${chamferIntrusion}`);assert(approachIntrusion<.001,`screw-head approach intrusion ${approachIntrusion}`);assert(intrusion<.001,`fastener intrusion ${intrusion}`);assert(missingBearing<.001,`missing screw bearing ${missingBearing}`);assert(5.4-p.counterbore_depth>=2-1e-8);
 for(const a of p.mountSites)for(const b of p.mountSites){const px=boards[p.board_system].pitchX,pz=boards[p.board_system].pitchZ;assert(Math.abs((a.x-b.x)/px-Math.round((a.x-b.x)/px))<1e-7);assert(Math.abs((a.z-b.z)/pz-Math.round((a.z-b.z)/pz))<1e-7);}
 return {chamferIntrusion,approachIntrusion,fastenerIntrusion:intrusion,missingBearing,remainingBackplate:5.4-p.counterbore_depth};
 }finally{for(let i=all.length-1;i>=0;i--)all[i].delete();}}
for(const board_system of ['multiboard','hsw']){
 for(const config of [...(board_system==='hsw'?[{columns:12,angle:5,mount_rows:4}]:[]),{columns:1},{columns:2},{columns:2,rows:2,angle:5,mount_rows:4},{columns:2,angle:-30,mount_rows:3},{columns:1,mount_rows:1,backplate:false},{columns:2,screw_clearance:.1,head_clearance:.1,counterbore_depth:3.1},{columns:2,screw_clearance:.4,head_clearance:.5,counterbore_depth:3.4}]){
 const r=build(m,inputs,{board_system,...config});results.push({board_system,kind:'shelf',config,...check(r),pegDelta:r.pegDelta,maxFootOverlap:r.maxFootOverlap});if(Object.keys(config).length===1)fs.writeFileSync(out+'/'+board_system+'-shelf.stl',new Uint8Array(binarySTL(r)));console.log(board_system,config,'PASS');}
 for(const fit of [{},{screw_clearance:.1,head_clearance:.1,counterbore_depth:3.1},{screw_clearance:.4,head_clearance:.5,counterbore_depth:3.4}]){
 const r=buildCoupon(m,inputs,{board_system,...fit});results.push({board_system,kind:'coupon',fit,...check(r)});if(!Object.keys(fit).length)fs.writeFileSync(out+'/'+board_system+'-coupon.stl',new Uint8Array(binarySTL(r)));}
}
for(const values of [{counterbore_depth:3.5},{screw_clearance:0},{head_clearance:1}])assert.throws(()=>parameters({board_system:'hsw',...values}));
fs.writeFileSync(out+'/bolted-boards.json',JSON.stringify({gridfinityPitch:42,tests:results,scope:'Our screw holes and bearing geometry, not the externally supplied insert or snap retention.'},null,2)+'\n');
