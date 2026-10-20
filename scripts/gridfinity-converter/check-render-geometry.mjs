import assert from 'node:assert/strict';
import { illustrationGeometry } from '../../public/gridfinity-converter/render-geometry.js';
const square = {
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  triangles: new Uint32Array([0, 1, 2, 0, 2, 3]),
};
const before = {
  vertices: square.vertices.slice(),
  triangles: square.triangles.slice(),
};
const flat = illustrationGeometry(square.vertices, square.triangles);
assert.equal(
  flat.edges.length / 6,
  4,
  'coplanar triangle diagonal is not inked',
);
assert.deepEqual(square, before, 'presentation does not alter source arrays');
for (let i = 0; i < flat.normals.length; i += 3)
  assert.deepEqual([...flat.normals.slice(i, i + 3)], [0, 0, 1]);
const weighted = illustrationGeometry(
  new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0]),
  new Uint32Array([0, 1, 2, 3, 4, 5]),
);
assert.deepEqual(
  weighted.normals.slice(0, 3),
  weighted.normals.slice(9, 12),
  'split CAD seam is welded for hull normals',
);
assert(Math.abs(weighted.normals[1] - 1 / Math.sqrt(17)) < 1e-7);
assert(Math.abs(weighted.normals[2] - 4 / Math.sqrt(17)) < 1e-7);
const nonmanifold = illustrationGeometry(
  new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1]),
  new Uint32Array([0, 1, 2, 1, 0, 3, 0, 1, 4]),
);
assert.equal(
  nonmanifold.edges.length / 6,
  7,
  'nonmanifold adjacency remains visible',
);
for (const degrees of [25, 35]) {
  const angle = (degrees * Math.PI) / 180;
  const creaseMesh = illustrationGeometry(
    new Float32Array([
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      -Math.cos(angle),
      Math.sin(angle),
    ]),
    new Uint32Array([0, 1, 2, 1, 0, 3]),
  );
  assert.equal(
    creaseMesh.edges.length / 6,
    degrees < 30 ? 4 : 5,
    '30 degree crease threshold',
  );
}
console.log(
  'Render adjacency: coplanar diagonal omitted, welded area-weighted normals, nonmanifold edges, input arrays unchanged.',
);
