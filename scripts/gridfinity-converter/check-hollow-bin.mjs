// Private input fixture: never copy uploaded models into the public site.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {
  importSolid,
  detect,
  align,
  convert,
  checkMesh,
  binarySTL,
} from '../../public/gridfinity-converter/kernel.js';
const [file, out = '/tmp/gridfinity-hollow-bin-checks'] = process.argv.slice(2);
if (!file)
  throw Error('Usage: check-hollow-bin.mjs input.stl [output-directory]');
const b = fs.readFileSync(file),
  count = b.readUInt32LE(80);
assert.equal(b.length, 84 + 50 * count);
const vertices = new Float32Array(count * 9),
  triangles = Uint32Array.from({ length: count * 3 }, (_, i) => i);
for (let i = 0; i < count; i++)
  for (let j = 0; j < 9; j++)
    vertices[i * 9 + j] = b.readFloatLE(84 + i * 50 + 12 + j * 4);
const m = await Module();
m.setup();
const body = importSolid(m, { vertices, triangles }).bodies[0],
  d = detect(m, body),
  source = align(m, body, d);
assert.equal(d.grid.matched, 1);
assert.equal(
  d.feet[0].screwCount,
  0,
  'Hollow interior mislabeled as screw holes',
);
const evidence = [];
fs.mkdirSync(out, { recursive: true });
for (const style of ['plain', 'magnets', 'screws', 'both']) {
  const r = convert(m, source, { feet: d.feet, style, fitScrewDepth: true });
  checkMesh(r.geometry);
  assert.equal(r.report.connectedSolids, 1);
  assert.ok(r.report.outsideChange < 0.001);
  if (['screws', 'both'].includes(style)) {
    assert.equal(r.report.screwDepth, 3.9);
    assert.equal(r.report.minimumRoof, 0.8);
    assert.throws(
      () => convert(m, source, { feet: d.feet, style, screwDepth: 6 }),
      /roof/,
    );
  }
  fs.writeFileSync(
    out + '/' + style + '.stl',
    Buffer.from(binarySTL(r.geometry)),
  );
  evidence.push(r.report);
  console.log(style, 'PASS', r.report.screwDepth);
}
fs.writeFileSync(
  out + '/checks.json',
  JSON.stringify(evidence, null, 2) + '\n',
);
