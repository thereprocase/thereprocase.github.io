import assert from 'node:assert/strict';
import Module from '../public/gridfinity-shelves/vendor/manifold.js';
import {build,defaults} from '../public/gridfinity-drawers/kernel.js';
const m=await Module();m.setup();const rows=[];
assert.equal(defaults.glueGap,.15);assert.equal(defaults.stockX,0);assert.equal(defaults.stockY,0);
for(const axis of ['X','Y'])for(const bottom of ['open','closed']){
 const p=axis==='X'?{width:90,depth:46,columns:2,rows:1,cutsX:'45'}:{width:46,depth:90,columns:1,rows:2,cutsY:'45'};
 const r=build(m,{...p,bottom,tiling:'manual'}),full=build(m,{...p,bottom,tiling:'none'});
 const make=t=>{const a=new m.Manifold(new m.Mesh({numProp:3,vertProperties:t.vertices,triVerts:t.triangles})),b=a.translate(t.origin);a.delete();return b;};
 const parts=r.tiles.map(make),assembly=m.Manifold.union(parts),whole=make(full.tiles[0]);
 const h=r.parameters.height,d=r.parameters.jointDepth,g=r.parameters.glueGap,at=45;
 const poly=[[at-g/2,0],[at+d-g/2,h/2],[at-g/2,h],[at+g/2,h],[at+d+g/2,h/2],[at+g/2,0]];
 const other=axis==='X'?p.depth:p.width;
 const a=m.Manifold.extrude([poly],other+2),b=a.rotate([90,0,0]),c=b.translate([0,other+1,0]);a.delete();b.delete();let cut=c;
 if(axis==='Y'){const rotated=c.rotate([0,0,90]);cut=rotated.translate([p.width,0,0]);rotated.delete();c.delete();}
 const target=whole.subtract(cut),extra=assembly.subtract(target),missing=target.subtract(assembly);
 assert(extra.volume()<.02&&missing.volume()<.02,`${axis}/${bottom}: parts moved or relief differs: +${extra.volume()} -${missing.volume()}`);
 rows.push({axis,bottom,relief:g,stockX:r.parameters.stockX,stockY:r.parameters.stockY,addedComparedToCut:extra.volume(),missingComparedToCut:missing.volume(),pass:true});
 for(const v of [...parts,assembly,whole,cut,target,extra,missing])v.delete();
}
console.log(JSON.stringify({scope:'Independent 0.15 mm V-strip subtraction from the finished grid versus exported tiles reassembled at their original coordinates; no tile translation and no added stock.',cases:rows},null,2));
