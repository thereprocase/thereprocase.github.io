import assert from 'node:assert/strict';
import { nativeFoot, validateNativeBrepCandidate } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const box = cad.makeBox([0,0,0],[10,10,10]);
const candidateText = box.serialize(), expectedVolume = cad.measureVolume(box);
box.delete();
const descriptor = Object.getOwnPropertyDescriptor(cad.Shape.prototype,'solids');
const wrappers = [];
Object.defineProperty(cad.Shape.prototype,'solids',{
  ...descriptor,
  get() { const values = descriptor.get.call(this);wrappers.push(...values);return values; },
});
try {
  const result = await validateNativeBrepCandidate({candidateText,expectedVolume});
  assert.ok(result.buffer);
  assert.equal(wrappers.length,1);
  for(const wrapper of wrappers) assert.throws(()=>wrapper.wrapped,/deleted/);
} finally { Object.defineProperty(cad.Shape.prototype,'solids',descriptor); }
console.log(JSON.stringify({passed:true,solidWrappersReleased:wrappers.length}));
