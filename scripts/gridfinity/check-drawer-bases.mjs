import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,parameters,binarySTL} from '../../public/gridfinity-drawers/kernel.js';
import {baseChoices,magnetFits} from '../../public/gridfinity-shelves/base-options.js';
import {facetedSTEP} from '../../public/gridfinity-shelves/solid-exports.js';
const m=await Module();m.setup();const reports=[];
const make=t=>new m.Manifold(new m.Mesh({numProp:3,vertProperties:t.vertices,triVerts:t.triangles}));
const base={width:46,depth:46,columns:1,rows:1,tiling:'none'};
for(const [name,c] of Object.entries(baseChoices))for(const fit of c.magnets?Object.keys(magnetFits):['snug']){
 const input={...base,bottom:c.closed?'closed':'open',magnets:c.magnets,screws:c.screws,weighted:c.weighted,magnet_fit:fit},r=build(m,input),t=r.tiles[0],shape=make(t),p=r.parameters;
 assert.equal(shape.status(),'NoError');const parts=shape.decompose();assert.equal(parts.length,1);parts.forEach(x=>x.delete());assert(r.maxFootOverlap<.003);
 const probe=(x,y,z,solid)=>{const raw=m.Manifold.cube([.04,.04,.04]),box=raw.translate([x-.02,y-.02,z-.02]),hit=shape.intersect(box);assert(solid?Math.abs(hit.volume()-.000064)<1e-7:hit.volume()<1e-7,`${name}/${fit}: ${x},${y},${z}: ${hit.volume()}`);hit.delete();box.delete();raw.delete();};
 for(const dx of [-13,13])for(const dy of [-13,13]){
  const x=23+dx,y=23+dy;
  if(c.closed||c.magnets||c.screws)probe(x+2,y,p.seatFloor-.2,!c.magnets);
  if(c.closed||c.magnets||c.screws)probe(x,y,.4,!c.screws);
  if(c.magnets){const radius=magnetFits[fit].diameter/2;probe(x+radius-.07,y,p.seatFloor-1,false);probe(x+radius+.07,y,p.seatFloor-1,true);if(!c.screws)probe(x,y,p.seatFloor-2.5,true);}
 }
 probe(23,23,.4,c.closed&&!c.weighted);
 if(c.weighted){probe(23,23,3.9,false);probe(23,23,4.2,true);probe(23,35.125,1,false);}
 assert.equal(new DataView(binarySTL(t)).getUint32(80,true),t.triangles.length/3);
 if(name==='open-both'&&fit==='snug'){
  const step=facetedSTEP({parts:[{...t,name:'hardware_PRINT'}]},m);assert(step.startsWith('ISO-10303-21;'));assert(step.includes('FACETED_BREP'));fs.writeFileSync('/tmp/drawer-hardware.step',step);
 }
 shape.delete();reports.push({name,fit,volume:r.totalVolume,height:p.height,pocketProbes:true,closedConnected:true,footOverlap:r.maxFootOverlap});console.log('PASS',name,fit);
}
// Exercise hardware across grid-aligned and through-cell tile cuts.
for(const weighted of [false,true])for(const bottom of weighted?['closed']:['closed','open'])for(const cuts of ['45','24,66']){
 const r=build(m,{width:90,depth:90,columns:2,rows:2,magnets:true,screws:true,weighted,bottom,tiling:'manual',cutsX:cuts,cutsY:cuts});
 for(const t of r.tiles){const shape=make(t);assert.equal(shape.status(),'NoError');const parts=shape.decompose();assert.equal(parts.length,1);parts.forEach(p=>p.delete());shape.delete();}
 reports.push({tiled:true,weighted,bottom,cuts,tiles:r.tiles.length,footOverlap:r.maxFootOverlap});
}
// Existing no-hardware geometry must remain byte-for-byte unchanged.
const oldSource=execFileSync('git',['show','6da82f1:public/gridfinity-drawers/kernel.js'],{encoding:'utf8'}).replace("'../gridfinity-shelves/kernel.js'",JSON.stringify(new URL('../../public/gridfinity-shelves/kernel.js',import.meta.url).href));
const old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
for(const bottom of ['open','closed']){
 const input={width:90,depth:90,columns:2,rows:2,tiling:'manual',cutsX:'45',cutsY:'45',bottom},a=old.build(m,input),b=build(m,input);
 for(let i=0;i<a.tiles.length;i++){assert.deepEqual(a.tiles[i].vertices,b.tiles[i].vertices);assert.deepEqual(a.tiles[i].triangles,b.tiles[i].triangles);}
}
for(const input of [{bottom:'open',weighted:true},{magnets:'true'},{magnet_fit:'invalid'}])assert.throws(()=>parameters(input));
assert.equal(parameters({}).magnet_fit,'snug');
fs.writeFileSync('/tmp/drawer-bases.json',JSON.stringify({pass:true,cases:reports,legacyMeshIdentical:true,invalidParametersRejected:true,stepExport:true},null,2)+'\n');
