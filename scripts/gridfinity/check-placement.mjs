import assert from 'node:assert/strict';import fs from 'node:fs';
import {parameters,build,buildCoupon,binarySTL} from '../../public/gridfinity-shelves/kernel.js';import Module from '../../public/gridfinity-shelves/vendor/manifold.js';import {reinforce} from '../../public/gridfinity-shelves/reinforcement.js';
const dir=process.argv[2]??'/tmp/gridfinity-placement';fs.mkdirSync(dir,{recursive:true});const specs={original:[25.4,25.4],us_small:[25.4,25.4],us_large:[25.4,25.4],wall_control:[25.4,25.4],metric25:[25,25],bott_perfo:[38.1,38.1],multiboard:[25,25],hsw:[23.6*Math.sqrt(3)/2,23.6],skadis:[40,20]},checks=[];
for(const [board_system,[px,pz]] of Object.entries(specs))for(let columns=1;columns<=12;columns++)for(let mount_rows=1;mount_rows<=4;mount_rows++){
 const p=parameters({board_system,columns,mount_rows}),limit=p.frameWidth/2-5,sites=p.mountSites;assert(sites.length>0);assert.equal(new Set(sites.map(s=>s.x+','+s.z)).size,sites.length);assert(sites.every(s=>Math.abs(s.x)<=limit+1e-7));
 if(board_system==='skadis'){
  const phase=sites[0].x+sites[0].z;
  for(let z=0;z>=p.mountZ.at(-1);z-=20){const expected=[];for(let k=-30;k<=30;k++){const x=phase-z+40*k;if(Math.abs(x)<=limit+1e-7)expected.push(x);}const actual=sites.filter(s=>Math.abs(s.z-z)<1e-7).map(s=>s.x).sort((a,b)=>a-b);assert.deepEqual(actual,expected.sort((a,b)=>a-b));}
 }else{
  const count=Math.floor((p.frameWidth-10)/px)+1;assert.equal(p.mounts.length,count);assert.equal(sites.length,count*mount_rows);
  for(let i=0;i<count;i++){const x=(i-(count-1)/2)*px;assert(Math.abs(p.mounts[i]-x)<1e-7);const col=sites.filter(s=>Math.abs(s.x-x)<1e-7);assert.equal(col.length,mount_rows);for(let row=0;row<mount_rows;row++){const z=-row*pz-(board_system==='hsw'?(i%2)*pz/2:0);assert(col.some(s=>Math.abs(s.z-z)<1e-7&&s.row===row));}}
 }
 checks.push({board_system,columns,mount_rows,sites:sites.length});
}
const six=parameters({columns:6,rows:2});assert.equal(six.mounts.length,10);assert.equal(six.mountSites.length,20);for(let i=1;i<10;i++)assert(Math.abs(six.mounts[i]-six.mounts[i-1]-25.4)<1e-7);
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url))),geometry=[];
for(const board_system of Object.keys(specs)){
 const r=build(m,inputs,{board_system,columns:6,rows:2}),helpers=reinforce(m,inputs,r);assert(r.pegDelta<.01);assert(r.maxFootOverlap<.002);fs.writeFileSync(dir+'/'+board_system+'-6x2.stl',new Uint8Array(binarySTL(r)));geometry.push({board_system,mountColumns:r.parameters.mounts.length,mountSites:r.parameters.mountSites.length,pegDelta:r.pegDelta,binOverlap:r.maxFootOverlap,triangles:r.trianglesCount,helpers:helpers.length,volume:r.volume});console.log(board_system,'6x2 PASS',r.parameters.mountSites.length,'mounts');
}
const coupon=buildCoupon(m,inputs,{board_system:'original',mount_rows:4,columns:6});assert.deepEqual(coupon.parameters.mountSites,[{x:0,z:0,row:0},{x:0,z:-25.4,row:1}]);
fs.writeFileSync(dir+'/placement.json',JSON.stringify({layoutCases:checks.length,allWidthsAndMountHeights:true,cases:checks,geometry,sixByTwo:{columns:six.mounts,sites:six.mountSites}},null,2)+'\n');
