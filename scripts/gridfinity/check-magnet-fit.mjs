import assert from 'node:assert/strict';import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,parameters,binarySTL} from '../../public/gridfinity-shelves/kernel.js';
import {footprintHull,placementAtAngle} from '../../public/gridfinity-shelves/bed-placement.js';
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url))),table=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/width-precomputed.json',import.meta.url)));
const evidence=[],styles=['magnets','both','open-magnets','open-both','weighted','weighted-magnets'];
for(const base_type of styles){const results={};for(const magnet_fit of ['snug','glue','press']){
 const r=build(m,inputs,{columns:1,base_type,magnet_fit});results[magnet_fit]=r;
 assert.equal(new DataView(binarySTL(r)).getUint32(80,true),r.trianglesCount);
 const own=[],keep=x=>(own.push(x),x);
 try{
  let shape=keep(new m.Manifold(new m.Mesh({numProp:3,vertProperties:r.vertices,triVerts:r.triangles})));
  assert.equal(shape.status(),'NoError');const bodies=shape.decompose();bodies.forEach(keep);assert.equal(bodies.length,1);
  shape=keep(shape.translate([0,0,-r.printZShift]));shape=keep(shape.rotate([-r.printRotation*180/Math.PI,0,0]));shape=keep(shape.translate([0,-.15,-r.hinge]));shape=keep(shape.rotate([-r.parameters.angle,0,0]));shape=keep(shape.translate([0,.15,5.72]));
  const probe=(x,y,z,solid)=>{const box=keep(keep(m.Manifold.cube([.1,.1,.1])).translate([x-.05,y-.05,z-.05])),volume=keep(shape.intersect(box)).volume();assert(solid?Math.abs(volume-.001)<1e-6:volume<1e-6,`${base_type} ${magnet_fit} ${x},${y},${z} ${volume}`);};
  for(const dx of [-13,13])for(const dy of [-13,13]){
   probe(dx+2.7,28.55+dy,0,false); // Inside both pocket sizes.
   probe(dx+3.17,28.55+dy,0,magnet_fit!=='glue'); // Separates Official from the two closer fits.
   probe(dx+3.5,28.55+dy,0,true); // Outer support retained.
   probe(dx+2,28.55+dy,-1.6,true); // Pocket bottom unchanged.
   probe(dx+2,28.55+dy,-1.2,false);
  }
  if(base_type.startsWith('open-'))probe(0,28.55,0,false);
  const hull=footprintHull(r.vertices);
  for(const angle of [0,17,45,91,155]){const a=placementAtAngle(hull,256,256,angle),b=placementAtAngle(table.hulls[1],256,256,angle);assert(Math.abs(a.width-b.width)<1e-4);assert(Math.abs(a.depth-b.depth)<1e-4);}
 }finally{own.reverse().forEach(x=>x.delete());}
 evidence.push({base_type,magnet_fit,volume:r.volume,triangles:r.trianglesCount,pegDelta:r.pegDelta,maxFootOverlap:r.maxFootOverlap,pocketAndFloorProbes:true,precomputedFootprintUnchanged:true});console.log('PASS',base_type,magnet_fit);
 }
 // Exact 96-sided cylinder area difference, four 2.4-mm-deep pockets.
 for(const [fit,radius] of [['snug',3.1],['press',3]]){const expected=48*Math.sin(2*Math.PI/96)*(3.25**2-radius**2)*2.4*4;assert(Math.abs(results[fit].volume-results.glue.volume-expected)<.02,base_type+fit);}
}
const frame=build(m,inputs,{columns:1});const old=table.hulls[1],h=footprintHull(frame.vertices);assert.deepEqual(h,old);
for(const value of ['invalid','toString',null,5])assert.throws(()=>parameters({magnet_fit:value}));assert.equal(parameters({}).magnet_fit,'snug');
fs.writeFileSync('/tmp/magnet-fit-checks.json',JSON.stringify({pass:true,cases:evidence,defaultFit:'snug',frameHullUnchanged:true},null,2)+'\n');
