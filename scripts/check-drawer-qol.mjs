import assert from 'node:assert/strict';
import Module from '../public/gridfinity-shelves/vendor/manifold.js';
import {parameters,build} from '../public/gridfinity-drawers/kernel.js';
import {facetedSTEP} from '../public/gridfinity-shelves/solid-exports.js';
const m=await Module();m.setup();
for(const bottom of ['open','closed'])for(const tiling of ['none','manual','auto']){
 const r=build(m,{width:90,depth:90,columns:2,rows:2,clearance:-.1,bottom,tiling,cutsX:'45',cutsY:'45',bedX:65,bedY:65});
 assert(r.maxFootOverlap<=.003);if(tiling==='auto')assert(r.tiles.every(t=>t.fitsBed));
 const tile=r.tiles[0],stepResult={parts:[{...tile,name:'Drawer_tile_PRINT'}]},text=facetedSTEP(stepResult,m);
 assert(text.includes("FACETED_BREP('Drawer_tile_PRINT'"));assert(text.includes('Faceted Gridfinity drawer tile'));assert.equal(stepResult.stepNormalization.length,1);
}
const a=parameters({bedX:180,bedY:180}),b=parameters({bedX:350,bedY:350});assert(a.tileCount>b.tileCount);assert.equal(a.startX,b.startX);assert.equal(a.startY,b.startY);assert.equal(a.width,b.width);
for(const size of [180,220,256,300,350,1000]){const p=parameters({tiling:'manual',cutsX:'150',cutsY:'200',bedX:size,bedY:size});assert.deepEqual(p.xCuts,[150]);assert.deepEqual(p.yCuts,[200]);}
assert.throws(()=>parameters({clearance:-.101}));assert.equal(parameters({clearance:-.1}).clearance,-.1);
console.log('Six tight-seat geometry/STEP cases, bed-driven divisions, preserved manual cuts and clearance bounds: PASS');
