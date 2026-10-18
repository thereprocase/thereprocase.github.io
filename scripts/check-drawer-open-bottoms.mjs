import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from '../public/gridfinity-shelves/vendor/manifold.js';
import {build,parameters,binarySTL} from '../public/gridfinity-drawers/kernel.js';
const out=process.argv[2]||'/tmp/drawer-open-checks';fs.mkdirSync(out,{recursive:true});
const m=await Module();m.setup();const reports=[];
const cases=[['single',{width:46,depth:46,columns:1,rows:1,tiling:'none'}],['cross-cell',{width:90,depth:90,columns:2,rows:2,tiling:'manual',cutsX:'24,66',cutsY:'24,66'}],['minimum',{width:90,depth:90,columns:2,rows:2,floor:.8,jointDepth:1.5,clearance:.2,tiling:'manual',cutsX:'24,66',cutsY:'24,66',glueGap:.3,stockX:-.2,stockY:.2}],['asymmetric',{width:160,depth:140,columns:3,rows:2,xMode:'near',xValue:3,yMode:'offset',yValue:10,tiling:'manual',cutsX:'35,105',cutsY:'50'}],['automatic',{width:180,depth:140,columns:4,rows:3,bedX:90,bedY:90}],['default',{}]];
const mesh=t=>new m.Manifold(new m.Mesh({numProp:3,vertProperties:t.vertices,triVerts:t.triangles}));
for(const [name,input] of cases){
 const open=build(m,{...input,bottom:'open'}),closed=build(m,{...input,bottom:'closed'}),p=open.parameters;
 assert(open.totalVolume<closed.totalVolume);assert(open.maxFootOverlap<=.003);
 let maxLandMissing=0;
 for(const t of open.tiles){const local=mesh(t),tile=local.translate(t.origin);local.delete();const pieces=tile.decompose();assert.equal(pieces.length,1);pieces.forEach(x=>x.delete());
  if(p.tiling==='auto')assert(t.fitsBed);
  const xs=[0,...p.xCuts,p.width],ys=[0,...p.yCuts,p.depth];
  for(const z of [.08,p.floor/2,p.floor-.08]){
   const z0=z-.01,z1=z+.01,v=zz=>p.jointDepth*(1-Math.abs(2*zz/p.height-1));
   for(const [axis,cuts,index,stock,low,high] of [['X',xs,t.col,p.stockX,ys[t.row]+1,ys[t.row+1]-1],['Y',ys,t.row,p.stockY,xs[t.col]+1,xs[t.col+1]-1]]){
    for(const [side,at] of [['near',index?cuts[index]:null],['far',index<cuts.length-2?cuts[index+1]:null]]){
     if(at===null)continue;const sign=side==='near'?1:-1,edge=zz=>at+v(zz)+sign*(p.glueGap-stock)/2;
     const start=side==='near'?Math.max(edge(z0),edge(z1))+.002:Math.min(edge(z0),edge(z1))-2.392;
     const core=axis==='X'?m.Manifold.cube([2.39,high-low,.02]).translate([start,low,z0]):m.Manifold.cube([high-low,2.39,.02]).translate([low,start,z0]);
     const missing=core.subtract(tile);maxLandMissing=Math.max(maxLandMissing,missing.volume());assert(missing.volume()<.002,`${name} ${t.name} ${axis}/${side} missing seam land ${missing.volume()}`);missing.delete();core.delete();
    }
   }
  }
  if(name==='cross-cell')fs.writeFileSync(path.join(out,t.name+'.stl'),new Uint8Array(binarySTL(t)));
  tile.delete();
 }
 // Opening cutters may remove material only below the original pocket floor.
 const oneOpen=build(m,{...input,bottom:'open',tiling:'none'}),oneClosed=build(m,{...input,bottom:'closed',tiling:'none'}),a=mesh(oneOpen.tiles[0]),b=mesh(oneClosed.tiles[0]),diff=b.subtract(a),added=a.subtract(b),top=m.Manifold.cube([p.width,p.depth,p.height]).translate([0,0,p.floor+.03]),above=diff.intersect(top);
 assert(added.volume()<.01);assert(above.volume()<.01,`${name}: seat profile changed`);
 reports.push({name,tiles:open.tiles.length,openVolume:open.totalVolume,closedVolume:closed.totalVolume,savedPercent:100*(1-open.totalVolume/closed.totalVolume),maxSeamLandMissing:maxLandMissing,seatMaterialRemovedAboveFloor:above.volume(),footOverlap:open.maxFootOverlap,pass:true});
 for(const x of [a,b,diff,added,top,above])x.delete();
}
assert.equal(parameters({}).bottom,'closed');assert.throws(()=>parameters({bottom:'other'}));
const report={cases:reports,closedDefault:true,scope:'Open/closed volume, connected closed meshes, automatic bed fit, shaped seam lands, original seat preservation and reference foot; physical fit/glue untested'};
fs.writeFileSync(path.join(out,'open-bottoms.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
