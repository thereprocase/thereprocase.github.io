import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nativeFoot } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
import {
  createFaceMeshCache,
  disposeFaceMeshCache,
  meshWithFaceCache,
  transformFaceMeshCache,
  isRigidMatrix,
} from '../../public/gridfinity-converter/native-mesh-cache.js';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {
  importSolid,
  meshData,
  checkMesh,
} from '../../public/gridfinity-converter/kernel.js';
await nativeFoot();
const oc = cad.getOC(),
  m = await Module();
m.setup();
function extract(shape, t = 0.1, a = 0.35) {
  const raw = oc.ReplicadMeshExtractor.extract(shape.wrapped, t, a, true);
  try {
    return {
      vertices: new Float32Array(
        oc.wasmMemory.buffer,
        raw.getVerticesPtr(),
        raw.getVerticesSize(),
      ).slice(),
      triangles: new Uint32Array(
        oc.wasmMemory.buffer,
        raw.getTrianglesPtr(),
        raw.getTrianglesSize(),
      ).slice(),
    };
  } finally {
    raw.delete();
  }
}
function closed(geometry) {
  const { bodies } = importSolid(m, geometry);
  try {
    assert.equal(bodies.length, 1);
    checkMesh(meshData(bodies[0]));
  } finally {
    bodies.forEach((b) => b.delete());
  }
}
const source = (await nativeFoot()).fuse(
  cad.makeBox([-20.75, -20.75, 4.75], [20.75, 20.75, 12]),
);
const initial = extract(source),
  cache = createFaceMeshCache(oc, source, initial, 0.1, 0.35);
initial.vertices.fill(NaN); // Worker transfer/mutation must not affect retained buffers.
const result = source.cut(cad.makeCylinder(3.25, 2.4, [-13, -13, 0]));
const reused = meshWithFaceCache(oc, result, cache, 0.1, 0.35, 1000000);
assert(reused.reusedFaces > 0);
closed(reused);
assert.throws(
  () => meshWithFaceCache(oc, result, cache, 0.05, 0.25, 1000000),
  /parameters differ/,
);
assert.throws(
  () => meshWithFaceCache(oc, result, cache, 0.1, 0.35, 1),
  /budget/,
);
const r = [0, -1, 0, 1, 0, 0, 0, 0, 1],
  t = [50, -30, 10];
assert(isRigidMatrix(r, t));
assert(!isRigidMatrix([2, 0, 0, 0, 1, 0, 0, 0, 1], t));
const tr = new oc.gp_Trsf();
tr.SetValues(0, -1, 0, 50, 1, 0, 0, -30, 0, 0, 1, 10);
const builder = new oc.BRepBuilderAPI_Transform(
    source.wrapped,
    tr,
    false,
    false,
  ),
  placed = cad.cast(builder.Shape());
builder.delete();
tr.delete();
const placedCache = transformFaceMeshCache(oc, cache, placed, r, t),
  placedMesh = meshWithFaceCache(oc, placed, placedCache, 0.1, 0.35, 1000000);
assert(placedMesh.reusedFaces > 0);
closed(placedMesh);
const other = cad.makeBox([100, 100, 100], [110, 110, 110]);
assert.throws(
  () => meshWithFaceCache(oc, other, cache, 0.1, 0.35, 1000000),
  /no reusable/,
);
extract(source, 0.2, 0.5);
assert.throws(
  () => meshWithFaceCache(oc, source, cache, 0.1, 0.35, 1000000),
  /no reusable/,
);
const report = {
  reusedFaces: reused.reusedFaces,
  changedFaces: reused.changedFaces,
  placedFaces: placedMesh.reusedFaces,
  closed: true,
  independentBuffers: true,
  parameterFallback: true,
  budgetFallback: true,
  unrelatedShapeFallback: true,
  staleTriangulationFallback: true,
  scaleRejected: true,
};
disposeFaceMeshCache(cache);
disposeFaceMeshCache(placedCache);
assert.equal(cache.faces.size, 0);
fs.mkdirSync('/tmp/gridfinity-converter-checks', { recursive: true });
fs.writeFileSync(
  '/tmp/gridfinity-converter-checks/native-mesh-cache.json',
  JSON.stringify(report, null, 2),
);
console.log(report);
