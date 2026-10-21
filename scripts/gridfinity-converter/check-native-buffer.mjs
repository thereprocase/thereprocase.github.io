import assert from 'node:assert/strict';
import { copyNativeArray } from '../../public/gridfinity-converter/native-buffer.js';
// Reserve virtual address space; touch only the few values around the sign bit.
for (const BufferType of [ArrayBuffer,SharedArrayBuffer]) {
  const buffer = new BufferType(0x80001000);
  for (const Type of [Float32Array,Uint32Array]) {
    const offset = 0x80000010, expected = [1,2,3];
    new Type(buffer,offset,3).set(expected);
    const copy = copyNativeArray(Type,buffer,offset|0,3);
    assert.deepEqual([...copy],expected);
    new Type(buffer,offset,3).fill(0);
    assert.deepEqual([...copy],expected,'Returned buffer owns a copy');
    assert.throws(()=>copyNativeArray(Type,buffer,-1,3),/exceeds/);
    assert.throws(()=>copyNativeArray(Type,buffer,0x100000000,1),/Invalid/);
    assert.throws(()=>copyNativeArray(Type,buffer,2,1),/exceeds/);
    assert.throws(()=>copyNativeArray(Type,buffer,0,-1),/Invalid/);
  }
}
console.log('Signed wasm32 addresses above 2 GiB copied correctly; invalid ranges rejected.');
