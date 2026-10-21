import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build} from '../../public/gridfinity-shelves/kernel.js';
import {detect,align,convert,binarySTL} from '../../public/gridfinity-converter/kernel.js';
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url)));
const r=build(m,inputs,{columns:2,rows:2,angle:-2});
fs.writeFileSync('/tmp/female-shelf-2x2.stl',Buffer.from(binarySTL(r)));
const source=new m.Manifold(new m.Mesh({numProp:3,vertProperties:r.vertices,triVerts:r.triangles}));
const d=detect(m,source);assert.equal(d.interfaceType,'female');assert.equal(d.grid.matched,4);console.log('shelf detection',d.bottom,d.normal);
const aligned=align(m,source,d);
for(const style of ['plain','magnets']){const converted=convert(m,aligned,{interfaceType:'female',feet:d.feet,bottom:d.bottom,height:6.2,style});assert.ok(converted.report.outsideChange<.001);console.log('shelf',style,'PASS');}
