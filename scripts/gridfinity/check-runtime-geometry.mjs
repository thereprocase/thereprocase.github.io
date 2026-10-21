import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,binarySTL} from '../../public/gridfinity-drawers/kernel.js';
const baseline=process.argv[2];if(!baseline)throw Error('Pass baseline public directory');
const before=await import(pathToFileURL(path.resolve(baseline,'gridfinity-drawers/kernel.js')));
const m=await Module();m.setup();
for(const bottom of ['closed','open'])for(const tiling of ['none','manual','auto']){
 const input={width:90,depth:90,columns:2,rows:2,bottom,tiling,cutsX:'45',cutsY:'45',bedX:65,bedY:65};
 const progress=[],a=before.build(m,input),b=build(m,input,p=>progress.push(p));
 assert.equal(a.totalVolume,b.totalVolume);assert.equal(a.maxFootOverlap,b.maxFootOverlap);assert.equal(a.tiles.length,b.tiles.length);assert.equal(progress.length,b.tiles.length);
 for(let i=0;i<a.tiles.length;i++)assert.deepEqual(new Uint8Array(binarySTL(a.tiles[i])),new Uint8Array(binarySTL(b.tiles[i])));
}
for(const file of ['gridfinity-shelves/kernel.js','gridfinity-shelves/solid-exports.js','gridfinity-shelves/reinforcement.js','gridfinity-shelves/vendor/manifold.js','gridfinity-shelves/vendor/manifold.wasm'])assert.deepEqual(await fs.readFile(path.resolve(baseline,file)),await fs.readFile(new URL('../../public/'+file,import.meta.url)));
console.log('Six drawer cases byte-identical STL; shelf geometry, export writer and Manifold artifacts unchanged: PASS');
