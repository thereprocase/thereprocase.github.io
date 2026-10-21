import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,parameters,binarySTL} from '../../public/gridfinity-shelves/kernel.js';
import {boards} from '../../public/gridfinity-shelves/boards.js';
import {reinforce} from '../../public/gridfinity-shelves/reinforcement.js';
import {facetedSTEP,modifier3MF} from '../../public/gridfinity-shelves/solid-exports.js';
const m=await Module();m.setup();
const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url)));
const evidence=[];let configIndex=0;
for(const config of [{},{columns:1,beam:5,mount_rows:1},{columns:2,rows:2,angle:-30,mount_rows:4,backplate:false},{columns:3,angle:5,clearance:.2,web:6,beam:20},{columns:1,angle:-30,mount_rows:1,backplate:false},{columns:2,clearance:-.1},...Object.keys(boards).filter(b=>b!=='original').map(board_system=>({board_system,angle:-30}))]){
 if(configIndex++<Number(process.env.SKIP_CONFIGS||0))continue;
 const results={};
 for(const base_type of ['frame','plain','magnets','screws','both','weighted']){
  const r=build(m,inputs,{...config,base_type});results[base_type]=r;
  if(base_type==='weighted'){r.helpers=reinforce(m,inputs,r);assert.ok(r.helpers.length);if(!Object.keys(config).length&&!process.env.SKIP_SOLID_EXPORT){assert.ok(facetedSTEP(r,m).includes('END-ISO-10303-21;'));assert.ok(modifier3MF(r).byteLength>100);}}
  assert.equal(new DataView(binarySTL(r)).getUint32(80,true),r.trianglesCount);
  const owned=[],keep=s=>(owned.push(s),s);
  try{
   let shape=keep(new m.Manifold(new m.Mesh({numProp:3,vertProperties:r.vertices,triVerts:r.triangles})));
   shape=keep(shape.translate([0,0,-r.printZShift]));shape=keep(shape.rotate([-r.printRotation*180/Math.PI,0,0]));
   shape=keep(shape.translate([0,-.15,-r.hinge]));shape=keep(shape.rotate([-r.parameters.angle,0,0]));shape=keep(shape.translate([0,.15,5.72]));
   const p=r.parameters;
   const probe=(x,y,z,solid)=>{
    const box=keep(keep(m.Manifold.cube([.2,.2,.2])).translate([x-.1,y-.1,z-.1]));
    const volume=keep(shape.intersect(box)).volume();
    assert.ok(solid?Math.abs(volume-.008)<1e-5:volume<1e-5,`${base_type} ${JSON.stringify(config)} probe ${x},${y},${z}: ${volume}`);
   };
   for(let j=0;j<p.rows;j++)for(let i=0;i<p.columns;i++){
    const x=(i-(p.columns-1)/2)*42,y=28.55+42*j;
    if(base_type==='weighted'){
     probe(x,y,-4,false); // ballast cavity
     probe(x,y,-1,true); // roof above ballast
     probe(x+10,y,0,true); // floor
     probe(x,y+15,-4,false); // rubber-foot recess
     for(const dx of [-13,13])for(const dy of [-13,13]){
      probe(x+dx+2,y+dy,0,false); // magnet recess
      probe(x+dx+2,y+dy,-2,true); // magnet floor outside screw bore
      probe(x+dx,y+dy,-2,false); // M3 bore
      probe(x+dx+2,y+dy,-4,false); // screw head access
     }
    }else if(base_type==='frame')probe(x,y,0,false);
    else {probe(x,y,0,true);for(const dx of [-13,13])for(const dy of [-13,13]){probe(x+dx,y+dy,0,!['magnets','screws','both'].includes(base_type));probe(x+dx+2,y+dy,0,!['magnets','both'].includes(base_type));}}
   }
  }finally{owned.reverse().forEach(s=>s.delete());}
  evidence.push({parameters:r.parameters,volume:r.volume,pegDelta:r.pegDelta,maxFootOverlap:r.maxFootOverlap,coreInteriorMissing:r.coreInteriorMissing,removedSliverVolume:r.removedSliverVolume,triangles:r.trianglesCount,hardwareProbes:true});
  console.log(base_type,JSON.stringify(config),'PASS');
 }
 assert.ok(results.weighted.volume>results.frame.volume);
}
for(const base_type of ['magnet-light','toString','',null,2])assert.throws(()=>parameters({base_type}));
assert.equal(parameters({}).base_type,'frame');
fs.writeFileSync(process.argv[2]||'/tmp/gridfinity-base-types-checks.json',JSON.stringify(evidence,null,2)+'\n');
