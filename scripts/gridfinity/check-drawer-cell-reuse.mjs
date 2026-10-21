import fs from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';import {build} from '../../public/gridfinity-drawers/kernel.js';
const root=new URL('../../public/gridfinity-drawers/kernel.js',import.meta.url);
const source=execFileSync('git',['show','43ffa8c:public/gridfinity-drawers/kernel.js'],{encoding:'utf8'}).replace(/from '([^']+)'/g,(_,name)=>'from '+JSON.stringify(new URL(name,root).href));
const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const m=await Module();m.setup();const make=t=>new m.Manifold(new m.Mesh({numProp:3,vertProperties:t.vertices,triVerts:t.triangles})),reports=[];
const small={width:90,depth:90,columns:2,rows:2,magnets:true,screws:true,tiling:'manual',cutsX:'45',cutsY:'45'};
const cases=[['closed',small],['open',{...small,bottom:'open'}],['weighted',{...small,weighted:true}],['tight',{...small,clearance:-.1}],['clearance-fallback',{...small,clearance:.2}],['open-through-cells',{...small,bottom:'open',cutsX:'24,66',cutsY:'24,66'}],['full-default',{magnets:true,screws:true,weighted:true}]];
for(const [name,input] of cases){
 let start=performance.now();const old=baseline.build(m,input),oldMS=performance.now()-start;start=performance.now();const r=build(m,input),newMS=performance.now()-start;assert.equal(r.tiles.length,old.tiles.length);
 let maxChangedVolume=0,maxBoundsDelta=0,maxQuantizationBudget=0;
 for(let i=0;i<r.tiles.length;i++){
  const a=make(old.tiles[i]),b=make(r.tiles[i]),added=b.subtract(a),removed=a.subtract(b),change=added.volume()+removed.volume();maxChangedVolume=Math.max(maxChangedVolume,change);
  // A one-ULP coordinate displacement bounds a thin changed-volume band by
  // surface area × diagonal displacement. Record the actual change separately.
  const bounds=a.boundingBox(),magnitude=Math.max(1,...bounds.min.map(Math.abs),...bounds.max.map(Math.abs)),ulp=2**(Math.floor(Math.log2(magnitude))-23),budget=Math.max(a.surfaceArea(),b.surfaceArea())*Math.sqrt(3)*ulp;
  maxQuantizationBudget=Math.max(maxQuantizationBudget,budget);assert(change<budget,`${name} tile ${i} changed ${change}, budget ${budget}`);
  const aa=a.boundingBox(),bb=b.boundingBox();for(const k of ['min','max'])for(let j=0;j<3;j++)maxBoundsDelta=Math.max(maxBoundsDelta,Math.abs(aa[k][j]-bb[k][j]));
  for(const o of [a,b,added,removed])o.delete();
 }
 assert(maxBoundsDelta<.0001);assert(r.maxFootOverlap<=.003);
 if(name==='clearance-fallback')assert.equal(r.construction,'whole-plate');else assert.equal(r.construction,'translated-cell');
 const item={name,oldMS,newMS,timings:r.timings,construction:r.construction,referenceValidation:r.referenceValidation,maxChangedVolume,maxQuantizationBudget,maxBoundsDelta,tiles:r.tiles.length,maxFootOverlap:r.maxFootOverlap};reports.push(item);console.log(JSON.stringify(item));
}
fs.writeFileSync('/tmp/drawer-cell-reuse.json',JSON.stringify({pass:true,baseline:'43ffa8c',cases:reports,scope:'Float32 symmetric-difference volume and bounds; reference-foot containment upper bound; full default all-options timing. No tessellation reduction.'},null,2)+'\n');
