import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import { checkMesh, meshData } from '../../public/gridfinity-converter/kernel.js';
import { checkNativeDisplayMesh } from '../../public/gridfinity-converter/native-display-check.js';
const m = await Module();
m.setup();
const cube = m.Manifold.cube([10, 10, 10]);
const base = meshData(cube);
cube.delete();
const accepts = (fn, mesh) => { try { fn(mesh); return true; } catch { return false; } };
const fixtures = [base,
  { ...base, triangles: base.triangles.slice(3) },
  { ...base, triangles: Uint32Array.from([...base.triangles, ...base.triangles]) },
  { ...base, triangles: Uint32Array.from([...base.triangles, 0, 0, 1]) },
  { ...base, triangles: Uint32Array.from([...base.triangles, 999, 1, 2]) },
  { ...base, vertices: Float32Array.from(base.vertices, (x, i) => i ? x : NaN) },
];
// Distinct indices at exactly equal coordinates still share a geometric edge.
fixtures.push({ vertices: Float32Array.from([...base.triangles].flatMap(i => [...base.vertices.slice(i * 3, i * 3 + 3)])), triangles: Uint32Array.from(base.triangles, (_, i) => i) });
// All single-triangle winding reversals and missing triangles must fail.
for (let i = 0; i < base.triangles.length; i += 3) {
  const triangles = base.triangles.slice();
  [triangles[i], triangles[i + 1]] = [triangles[i + 1], triangles[i]];
  fixtures.push({ ...base, triangles });
}
// Exercise edge keys above uint32 range without expensive geometry.
const padding = 70000;
const padded = new Float32Array((padding + base.vertices.length / 3) * 3);
for (let i = 0; i < padding; i++) padded[i * 3] = 100 + i;
padded.set(base.vertices, padding * 3);
fixtures.push({ vertices: padded, triangles: Uint32Array.from(base.triangles, i => i + padding) });
// Repeatable malformed connectivity combinations, compared against the original.
let seed = 672;
for (let n = 0; n < 100; n++) {
  const triangles = base.triangles.slice();
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  triangles[seed % triangles.length] = (seed >>> 8) % (base.vertices.length / 3);
  fixtures.push({ ...base, triangles });
}
for (const fixture of fixtures) assert.equal(accepts(checkNativeDisplayMesh, fixture), accepts(checkMesh, fixture));
assert(accepts(checkNativeDisplayMesh, fixtures[0]));
assert(accepts(checkNativeDisplayMesh, fixtures[6]));
const sphere = m.Manifold.sphere(30, 512);
const large = meshData(sphere);
sphere.delete();
const timings = {};
for (const [name, fn] of [['previousMS', checkMesh], ['packedMS', checkNativeDisplayMesh]]) {
  const start = performance.now(); fn(large); timings[name] = Math.round(performance.now() - start);
}
console.log(JSON.stringify({fixtures:fixtures.length, triangles:large.triangles.length / 3, ...timings}));
