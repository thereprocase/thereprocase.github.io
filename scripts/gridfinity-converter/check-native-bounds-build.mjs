import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const [folder,mode='check']=process.argv.slice(2);if(!folder||!['check','write'].includes(mode))throw Error('Usage: node check-native-bounds-build.mjs converter-folder [check|write]');
const loader=await fs.readFile(path.join(folder,'native-kernel.js'),'utf8');
const threaded=loader.match(/import\(verifier \? ['"]([^'"]+)['"]/);
const single=loader.match(/initializeSingle = verifier \? \(await import\(['"]([^'"]+)['"]/);
assert.ok(threaded&&single,'Cannot identify verifier loader imports');
const files={},actual={};
for(const [key,glue] of Object.entries({pthread:threaded[1],single:single[1]})){
 const gluePath=path.resolve(folder,glue.split('?')[0]);const code=await fs.readFile(gluePath,'utf8');
 const wasm=[...code.matchAll(/["']([^"']+\.wasm)["']/g)].map(m=>m[1]);assert.equal(new Set(wasm).size,1,'Expected one literal WASM filename');
 const file=path.resolve(path.dirname(gluePath),wasm[0]);assert.ok(file.startsWith(path.resolve(folder,'vendor/export-verifier')+path.sep),'Verifier artifact outside expected directory');
 files[key]=path.relative(folder,file);actual[key]=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
const target=path.join(folder,'native-bounds-build.js');
if(mode==='write')await fs.writeFile(target,'// Generated from the verifier WASM files; regenerate when either kernel changes.\nexport const BOUNDS_KERNELS = '+JSON.stringify(actual)+';\n');
else{const source=await fs.readFile(target,'utf8');const match=source.match(/export const BOUNDS_KERNELS\s*=\s*(\{[^;]+\});/);assert.ok(match,'Expected static JSON kernel hash mapping');assert.deepEqual(JSON.parse(match[1]),actual,'Bounds worker kernel hashes must match the served verifier bytes');}
console.log(JSON.stringify({passed:true,mode,files,kernels:actual}));
