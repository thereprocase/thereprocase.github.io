import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build} from '../../public/gridfinity-drawers/kernel.js';
import {importSolid,detect,align,convert} from '../../public/gridfinity-converter/kernel.js';
const m=await Module();m.setup();const evidence=[];
const tile=build(m,{width:90,depth:90,columns:2,rows:2,tiling:'none',bottom:'closed'}).tiles[0];
const loaded=importSolid(m,tile),source=loaded.bodies[0],d=detect(m,source),aligned=align(m,source,d);
for(const fit of [-.5,0,.02,.2]){
 const r=convert(m,aligned,{interfaceType:'female',feet:[d.feet[0]],style:'magnets',height:6.2,fit});
 assert.equal(r.report.feet.length,1);assert.ok(r.report.outsideChange<.001);evidence.push(r.report);console.log('Partial selection fit',fit,'PASS');
}
assert.throws(()=>convert(m,aligned,{interfaceType:'female',feet:[{...d.feet[0],sourceX:d.feet[0].x+.2}],style:'plain',height:6.2}),/0.1 mm/);
aligned.delete();loaded.bodies.forEach(s=>s.delete());fs.writeFileSync('/tmp/socket-selection-checks.json',JSON.stringify(evidence,null,2));
