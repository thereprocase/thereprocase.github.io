import fs from 'node:fs';import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,buildCoupon,binarySTL,parameters} from '../../public/gridfinity-shelves/kernel.js';
import {makeBoardPegs,skadisDimensions} from '../../public/gridfinity-shelves/boards.js';
const out=process.argv[2]||'/tmp/gridfinity-boards';fs.mkdirSync(out,{recursive:true});
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url)));inputs.fitLibrary=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/fit-inputs.json',import.meta.url)));
const results=[];
for(const options of [{columns:1},{columns:2},{columns:2,rows:2},{columns:1,mount_rows:1},{columns:2,mount_rows:4,angle:5},{columns:2,mount_rows:3,angle:-30},{columns:1,backplate:false},{columns:2,slot_clearance:.1,board_thickness:4,board_gap:.1,retainer_depth:2},{columns:2,slot_clearance:.5,board_thickness:6.5,board_gap:.6,retainer_depth:4}]){
 const p={...options,board_system:'skadis'};const started=Date.now();const r=build(m,inputs,p);assert(r.pegDelta<.01);assert(r.maxFootOverlap<.002);const sites=r.parameters.mountSites;
 for(const a of sites){assert(Math.abs(a.x)+5<=r.parameters.frameWidth/2+1e-6);for(const b of sites){assert(Math.abs((a.z-b.z)/20-Math.round((a.z-b.z)/20))<1e-7);assert(Math.abs((a.x-b.x+a.z-b.z)/40-Math.round((a.x-b.x+a.z-b.z)/40))<1e-7);}}
 fs.writeFileSync(out+`/skadis-${options.columns}x${options.rows||1}-${options.mount_rows||2}-${options.angle||0}-${options.slot_clearance||.2}.stl`,new Uint8Array(binarySTL(r)));results.push({parameters:options,sites,pegDelta:r.pegDelta,binFootOverlap:r.maxFootOverlap,triangles:r.trianglesCount,seconds:(Date.now()-started)/1000});console.log('shelf',options,'PASS');
}
for(const fit of [{slot_clearance:.1},{slot_clearance:.2},{slot_clearance:.5},{slot_clearance:.1,board_thickness:4,board_gap:.1,retainer_depth:2},{slot_clearance:.5,board_thickness:6.5,board_gap:.6,retainer_depth:4}]){
 const c=fit.slot_clearance;
 const p=parameters({board_system:'skadis',...fit});const r=buildCoupon(m,inputs,{board_system:'skadis',...fit});assert(r.pegDelta<.01);fs.writeFileSync(out+`/skadis-coupon-${c}.stl`,new Uint8Array(binarySTL(r)));
 // Model the actual 5 x 15 mm capsule slots in a board slab. Check the whole
 // insertion translation, including the retainer passing through the slot.
 const all=[],keep=o=>(all.push(o),o),{upper}=makeBoardPegs(m,p,keep),d=skadisDimensions(p),M=m.Manifold;
 const box=(s,v)=>keep(keep(M.cube(s)).translate(v));
 const cylinder=(z)=>keep(keep(M.cylinder(p.board_thickness+2,2.5,2.5,96)).rotate([90,0,0]).translate([0,1.15,z]));
 const slot=keep(M.union([box([5,p.board_thickness+2,10],[-2.5,-p.board_thickness-.85,-5]),cylinder(-5),cylinder(5)]));
 const board=keep(box([24,p.board_thickness,45],[-12,.15-p.board_thickness,-22.5]).subtract(slot));
 let intrusion=0;for(let i=0;i<=40;i++){const raised=keep(upper.translate([0,0,d.insertLift*i/40]));intrusion=Math.max(intrusion,keep(raised.intersect(board)).volume());}
 for(let i=0;i<=40;i++){const moved=keep(upper.translate([0,(p.board_thickness+p.board_gap+p.retainer_depth+2)*i/40,d.insertLift]));intrusion=Math.max(intrusion,keep(moved.intersect(board)).volume());}
 assert(intrusion<.001,`slot intrusion ${intrusion}`);results.push({couponFit:fit,slotSweepPoses:82,maxBoardIntrusion:intrusion,insertLift:d.insertLift,pegDelta:r.pegDelta});for(let i=all.length-1;i>=0;i--)all[i].delete();console.log('coupon+sweep',c,'PASS');
}
assert.throws(()=>parameters({board_system:'unknown'}));assert.throws(()=>parameters({board_system:'skadis',board_thickness:0}));assert.equal(parameters({board_system:'original',board_thickness:0}).board_system,'original');assert.equal(parameters({board_system:'skadis',hook_grip:NaN}).hook_grip,0);
fs.writeFileSync(out+'/board-systems.json',JSON.stringify({system:'skadis',gridfinityPitch:42,tests:results},null,2)+'\n');
