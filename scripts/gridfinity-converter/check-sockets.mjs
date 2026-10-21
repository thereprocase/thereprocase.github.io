import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build} from '../../public/gridfinity-drawers/kernel.js';
import {detect,align,convert,checkMesh} from '../../public/gridfinity-converter/kernel.js';
import {SOCKET_STYLES} from '../../public/gridfinity-converter/socket-profile.js';
const m=await Module();m.setup();const evidence=[];
for(const bottom of ['closed','open']){
 const tile=build(m,{width:90,depth:90,columns:2,rows:2,tiling:'none',bottom}).tiles[0];
 const source=new m.Manifold(new m.Mesh({numProp:3,vertProperties:tile.vertices,triVerts:tile.triangles}));
 for(const rotated of [false,true]){
 const shape=rotated?source.rotate([24,41,13]).translate([14,-8,71]):source;
 const d=detect(m,shape);assert.equal(d.interfaceType,'female');assert.equal(d.grid.matched,4);
 const aligned=align(m,shape,d);
 for(const style of Object.keys(SOCKET_STYLES)){
  const r=convert(m,aligned,{interfaceType:'female',feet:d.feet,style,height:6.2});checkMesh(r.geometry);assert.ok(r.report.outsideChange<.001);evidence.push({bottom,rotated,style,report:r.report});console.log(bottom,rotated,style,'PASS');
 }
 aligned.delete();if(rotated)shape.delete();
 }source.delete();
}
for(const size of [[84,84,20],[84,84,2],[42,42,5]]){const shape=m.Manifold.cube(size);const d=detect(m,shape);assert.equal(d.feet.length,0);shape.delete();}
fs.writeFileSync(process.argv[2]||'/tmp/socket-checks.json',JSON.stringify(evidence,null,2));
