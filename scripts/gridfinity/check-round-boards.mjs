import fs from 'node:fs';import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,buildCoupon,binarySTL,parameters} from '../../public/gridfinity-shelves/kernel.js';
import {boards} from '../../public/gridfinity-shelves/boards.js';
const out=process.argv[2]||'/tmp/gridfinity-round-boards';fs.mkdirSync(out,{recursive:true});
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url))),rows=[];
function panelCheck(r){const all=[],keep=o=>(all.push(o),o),M=m.Manifold,p=r.parameters,b=boards[p.board_system],face=Math.fround(.15),cube=(s,v)=>keep(keep(M.cube(s)).translate(v));try{
 const shape=keep(keep(keep(new M(new m.Mesh({numProp:3,vertProperties:r.vertices,triVerts:r.triangles}))).translate([0,0,-r.printZShift])).rotate([-r.printRotation*180/Math.PI,0,0]));
 const bb=shape.boundingBox(),holes=p.mountSites.map(({x,z})=>b.mode==='square'?cube([p.hole_diameter,p.board_thickness+2,p.hole_diameter],[x-p.hole_diameter/2,face-p.board_thickness-1,z-p.hole_diameter/2]):keep(keep(keep(M.cylinder(p.board_thickness+2,p.hole_diameter/2,p.hole_diameter/2,96)).rotate([90,0,0])).translate([x,face+1,z])));
 const panel=keep(cube([p.frameWidth+40,p.board_thickness,bb.max[2]-bb.min[2]+40],[-p.frameWidth/2-20,face-p.board_thickness,bb.min[2]-20]).subtract(keep(M.union(holes))));
 const intrusion=keep(shape.intersect(panel)).volume(),magnitude=Math.max(1,...bb.min.map(Math.abs),...bb.max.map(Math.abs)),tolerance=.00001+2*2**(Math.floor(Math.log2(magnitude))-23);
 const innerHoles=p.mountSites.map(({x,z})=>b.mode==='square'?cube([p.hole_diameter+2*tolerance,p.board_thickness+2,p.hole_diameter+2*tolerance],[x-p.hole_diameter/2-tolerance,face-p.board_thickness-1,z-p.hole_diameter/2-tolerance]):keep(keep(keep(M.cylinder(p.board_thickness+2,p.hole_diameter/2+tolerance,p.hole_diameter/2+tolerance,96)).rotate([90,0,0])).translate([x,face+1,z])));
 const interior=keep(cube([p.frameWidth+40,p.board_thickness-2*tolerance,bb.max[2]-bb.min[2]+40],[-p.frameWidth/2-20,face-p.board_thickness+tolerance,bb.min[2]-20]).subtract(keep(M.union(innerHoles))));
 const inside=keep(shape.intersect(interior)).volume(),sx=p.frameWidth+40,sz=bb.max[2]-bb.min[2]+40,surface=2*(sx*sz+sx*p.board_thickness+sz*p.board_thickness)+p.mountSites.length*4*p.hole_diameter*p.board_thickness,skinBound=surface*tolerance;
 assert(inside<1e-6,`${p.board_system} panel interior intersection ${inside}`);assert(intrusion<=skinBound+1e-6,`${p.board_system} board intersection exceeds float32 skin bound`);return {rawIntersection:intrusion,interiorIntersection:inside,float32Tolerance:tolerance,skinBound};
 }finally{for(let i=all.length-1;i>=0;i--)all[i].delete();}}
for(const system of ['us_small','us_large','wall_control','metric25','bott_perfo']){
 for(const config of [...(system==='bott_perfo'?[{columns:12,angle:5,mount_rows:4}]:[]),{columns:1},{columns:2},{columns:2,rows:2,mount_rows:4,angle:5},{columns:2,mount_rows:3,angle:-30},{columns:1,mount_rows:1,backplate:false},{columns:2,board_thickness:.5,hole_diameter:4,slot_clearance:.1,lower_clearance:.1,board_gap:.1},{columns:2,board_thickness:8,hole_diameter:10,slot_clearance:.5,lower_clearance:.5,board_gap:.6}]){
  const r=build(m,inputs,{board_system:system,...config}),p=r.parameters;assert(r.pegDelta<.01);assert(r.maxFootOverlap<.002);for(const a of p.mountSites)for(const c of p.mountSites){assert(Math.abs((a.x-c.x)/boards[system].pitchX-Math.round((a.x-c.x)/boards[system].pitchX))<1e-7);assert(Math.abs((a.z-c.z)/boards[system].pitchZ-Math.round((a.z-c.z)/boards[system].pitchZ))<1e-7);}
  rows.push({system,config,kind:'shelf',boardIntrusion:panelCheck(r),pegDelta:r.pegDelta,maxFootOverlap:r.maxFootOverlap,triangles:r.trianglesCount,exportNormalization:r.exportNormalization??null});if(Object.keys(config).length===1)fs.writeFileSync(out+'/'+system+'-shelf.stl',new Uint8Array(binarySTL(r)));console.log(system,config,'PASS');
 }
 const r=buildCoupon(m,inputs,{board_system:system});rows.push({system,kind:'coupon',boardIntrusion:panelCheck(r),pegDelta:r.pegDelta,triangles:r.trianglesCount});fs.writeFileSync(out+'/'+system+'-coupon.stl',new Uint8Array(binarySTL(r)));assert.equal(parameters({board_system:system}).hole_diameter,boards[system].hole);
}
fs.writeFileSync(out+'/round-boards.json',JSON.stringify({gridfinityPitch:42,tests:rows,scope:'Connected and closed geometry, board-hole placement and static panel clearance; no physical test or installation sweep claim.'},null,2)+'\n');
