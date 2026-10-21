import assert from 'node:assert/strict';import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,parameters,binarySTL} from '../../public/gridfinity-shelves/kernel.js';
import {baseChoices,baseTypeFor} from '../../public/gridfinity-shelves/base-options.js';
import {footprintHull,placementAtAngle} from '../../public/gridfinity-shelves/bed-placement.js';
import {reinforce} from '../../public/gridfinity-shelves/reinforcement.js';
import {facetedSTEP,modifier3MF} from '../../public/gridfinity-shelves/solid-exports.js';
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url)));
const evidence=[],reference={};
const cases=[{}, {columns:1,angle:-30,mount_rows:1,backplate:false}, {columns:2,rows:2,angle:5,clearance:-.1}, {columns:1,board_system:'multiboard',angle:-30}];
for(const [ci,config] of cases.entries())for(const [base_type,options] of Object.entries(baseChoices)){
 if(ci&&['frame','plain','magnets','screws','both','weighted'].includes(base_type))continue;
 const r=build(m,inputs,{...config,base_type});assert.equal(baseTypeFor(options),base_type);
 assert.equal(new DataView(binarySTL(r)).getUint32(80,true),r.trianglesCount);
 const owned=[],keep=s=>(owned.push(s),s);
 try{
  let shape=keep(new m.Manifold(new m.Mesh({numProp:3,vertProperties:r.vertices,triVerts:r.triangles})));
  assert.equal(shape.status(),'NoError');const bodies=shape.decompose();bodies.forEach(keep);assert.equal(bodies.length,1);
  shape=keep(shape.translate([0,0,-r.printZShift]));shape=keep(shape.rotate([-r.printRotation*180/Math.PI,0,0]));shape=keep(shape.translate([0,-.15,-r.hinge]));shape=keep(shape.rotate([-r.parameters.angle,0,0]));shape=keep(shape.translate([0,.15,5.72]));
  const probe=(x,y,z,solid)=>{const box=keep(keep(m.Manifold.cube([.16,.16,.16])).translate([x-.08,y-.08,z-.08]));const volume=keep(shape.intersect(box)).volume();assert(solid?Math.abs(volume-.004096)<1e-5:volume<1e-5,`${base_type} ${JSON.stringify(config)} ${x},${y},${z} solid=${solid} volume=${volume}`);};
  for(let j=0;j<r.parameters.rows;j++)for(let i=0;i<r.parameters.columns;i++){
   const x=(i-(r.parameters.columns-1)/2)*42,y=28.55+42*j;
   probe(x,y,0,options.closed); // actual open center, not a blind recess
   if(!options.closed)probe(x,y,-2,false);
   if(options.weighted){probe(x,y,-4,false);probe(x,y,-1,true);}
   if(base_type!=='frame')for(const dx of [-13,13])for(const dy of [-13,13]){
    probe(x+dx,y+dy,0,!(options.magnets||options.screws));
    probe(x+dx+2,y+dy,0,!options.magnets);
    if(options.magnets){probe(x+dx+2,y+dy,-2,true);probe(x+dx+4.4*Math.sign(dx),y+dy,0,true);}
    if(options.weighted){probe(x+dx,y+dy,-2,!options.screws);probe(x+dx+2,y+dy,-4,!options.screws);}
   }
  }
  if(ci===0){
   const h=footprintHull(r.vertices),spans=Array.from({length:180},(_,a)=>placementAtAngle(h,256,256,a));
   if(base_type==='frame')reference.spans=spans;
   for(let i=0;i<180;i++){assert(Math.abs(spans[i].width-reference.spans[i].width)<1e-4);assert(Math.abs(spans[i].depth-reference.spans[i].depth)<1e-4);}
   if(base_type==='open-both'){
    r.helpers=reinforce(m,inputs,r);assert(r.helpers.length);const step=facetedSTEP(r,m),three=modifier3MF(r);assert(step.includes('END-ISO-10303-21;'));assert(three.byteLength>100);
    fs.writeFileSync('/tmp/base-controls-open-both.step',step);fs.writeFileSync('/tmp/base-controls-open-both.3mf',Buffer.from(three));
   }
  }
 }finally{owned.reverse().forEach(s=>s.delete());}
 evidence.push({config,base_type,volume:r.volume,triangles:r.trianglesCount,pegDelta:r.pegDelta,maxFootOverlap:r.maxFootOverlap,hardwareProbes:true,defaultFootprintMatchesFrame:ci===0});console.log('PASS',base_type,JSON.stringify(config));
}
assert.throws(()=>baseTypeFor({closed:false,magnets:false,screws:false,weighted:true}));
for(const bad of ['not-a-base','toString',null])assert.throws(()=>parameters({base_type:bad}));
fs.writeFileSync('/tmp/base-controls-checks.json',JSON.stringify({pass:true,cases:evidence},null,2)+'\n');
