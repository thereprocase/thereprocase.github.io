import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  nativeFoot,
  previewNative,
} from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {
  importSolid,
  detect,
} from '../../public/gridfinity-converter/kernel.js';

const foot = await nativeFoot();
const source = foot.fuse(
  cad.makeBox([-20.75, -20.75, 4.75], [20.75, 20.75, 25]),
);
const m = await Module();
m.setup();
const checks = [];
for (const [name, shape, bodyCount] of [
  ['single', source, 1],
  ['rotated', source.clone().rotate(37, [0, 0, 0], [1, 1, 0]), 1],
  [
    'assembly',
    cad.makeCompound([source.clone(), source.clone().translate([100, 0, 0])]),
    2,
  ],
]) {
  for (const format of ['step', 'brep']) {
    const buffer =
      format === 'step'
        ? await shape.blobSTEP().arrayBuffer()
        : new TextEncoder().encode(shape.serialize()).buffer;
    const progress = [];
    const p = await previewNative({
      buffer,
      format,
      onProgress: (message, info) => progress.push({ message, ...info }),
    });
    const mesh = p.result.meshes[0];
    const loaded = importSolid(m, {
      vertices: mesh.attributes.position.array,
      triangles: mesh.index.array,
    });
    assert.equal(loaded.bodies.length, bodyCount);
    for (const body of loaded.bodies) {
      assert.equal(detect(m, body).grid.matched, 1);
      body.delete();
    }
    assert.equal(p.preview.nativeReadCount, 1);
    assert.ok(p.preview.faces > 0);
    assert.ok(
      [1, 2, 3].every((stage) => progress.some((p) => p.stage === stage)),
    );
    checks.push({ name, format, bodyCount, ...p.preview });
  }
}
fs.mkdirSync('/tmp/gridfinity-converter-checks', { recursive: true });
fs.writeFileSync(
  '/tmp/gridfinity-converter-checks/native-preview.json',
  JSON.stringify(checks, null, 2) + '\n',
);
console.log(
  'Native STEP/BREP preview: single, rotated and assembly cases PASS',
);
