import assert from 'node:assert/strict';import fs from 'node:fs';
import {footprintHull,placementAtAngle,bestPlacement} from '../../public/gridfinity-shelves/bed-placement.js';
import {build,parameters} from '../../public/gridfinity-shelves/kernel.js';
import {reinforce} from '../../public/gridfinity-shelves/reinforcement.js';
import {modifier3MF} from '../../public/gridfinity-shelves/solid-exports.js';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
const dir=process.argv[2]??'/tmp/gridfinity-diagonal';fs.mkdirSync(dir,{recursive:true});const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url))),rows=[];
for(const columns of [7,15]){
 const r=build(m,inputs,{columns,rows:1}),h=footprintHull(r.vertices),straight=placementAtAngle(h,256,256),best=bestPlacement(h,256,256);
 assert(!straight.fits);assert(Math.abs(best.angle-45)<.01);assert.equal(best.fits,columns===7);assert(best.width<straight.width);
 // Independent all-vertex transform confirms hull-based placement and exact bed centering.
 for(const angle of [0,17.31,45,80,90]){const p=placementAtAngle(h,250,210,angle),rad=angle*Math.PI/180;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(let i=0;i<r.vertices.length;i+=3){const x=Math.cos(rad)*r.vertices[i]-Math.sin(rad)*r.vertices[i+1]+p.x,y=Math.sin(rad)*r.vertices[i]+Math.cos(rad)*r.vertices[i+1]+p.y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}assert(Math.abs((minX+maxX)/2-125)<1e-8);assert(Math.abs((minY+maxY)/2-105)<1e-8);assert(Math.abs(maxX-minX-p.width)<1e-8);assert(Math.abs(maxY-minY-p.depth)<1e-8);}
 r.helpers=reinforce(m,inputs,r);const bed={width:256,depth:256,rotationDeg:best.angle};fs.writeFileSync(`${dir}/${columns}x1.3mf`,modifier3MF(r,bed));
 rows.push({columns,straight,best,helpers:r.helpers.length,sourceVolume:r.volume,pegDelta:r.pegDelta});
}
const rectangle=new Float32Array([0,0,0,300,0,0,300,50,0,0,50,0]),h=footprintHull(rectangle);
assert(bestPlacement(h,320,100).fits);assert(bestPlacement(h,100,320).fits);assert(bestPlacement(h,100,320).angle>80);
assert.throws(()=>parameters({columns:33}));assert.throws(()=>parameters({columns:32,rows:3}));assert.equal(parameters({columns:32,rows:1}).columns,32);
fs.writeFileSync(dir+'/placement.json',JSON.stringify({cases:rows,pass:true},null,2));console.log(JSON.stringify(rows,null,2));
