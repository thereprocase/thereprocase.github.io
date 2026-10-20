import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  nativeFoot,
  convertNative,
} from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {
  importSolid,
  detect,
  align,
  convert,
  checkMesh,
  meshData,
} from '../../public/gridfinity-converter/kernel.js';
const a = await nativeFoot(-21),
  b = await nativeFoot(21),
  top = cad.makeBox([-41.75, -20.75, 4.75], [41.75, 20.75, 20]),
  hole = cad.makeCylinder(8, 12, [0, 0, 8]),
  source = top.fuse(a).fuse(b).cut(hole),
  buffer = await source.blobSTEP().arrayBuffer();
fs.writeFileSync(
  'public/converter-test-fixtures/native.step',
  Buffer.from(buffer),
);
const m = await Module();
m.setup();
const mesh = source.mesh({ tolerance: 0.025, angularTolerance: 0.15 }),
  raw = {
    vertices: new Float32Array(mesh.vertices),
    triangles: new Uint32Array(mesh.triangles),
  },
  loaded = importSolid(m, raw),
  d = detect(m, loaded.bodies[0]),
  aligned = align(m, loaded.bodies[0], d);
assert.equal(d.grid.matched, 2);
const checks = [];
for (const style of ['plain', 'magnets', 'screws', 'both']) {
  const r = convert(m, aligned, { feet: d.feet, style });
  const native = await convertNative({
    buffer,
    format: 'step',
    detection: d,
    options: r.report,
  });
  assert.equal(native.report.nativeValid, true);
  assert.ok(native.report.outsideChange < 0.001);
  const imported = importSolid(m, native.geometry);
  assert.equal(imported.bodies.length, 1);
  checkMesh(meshData(imported.bodies[0]));
  fs.writeFileSync(
    '/tmp/gridfinity-converter-checks/native-' + style + '.step',
    Buffer.from(native.step),
  );
  const roundtrip = await cad.importSTEP(new Blob([native.step]));
  assert.equal(roundtrip.solids.length, 1);
  assert.ok(
    Math.abs(cad.measureVolume(roundtrip) - native.report.convertedVolume) <
      0.001,
  );
  checks.push(native.report);
  console.log('Native', style, 'PASS', native.report.outsideChange);
}

const rotated = source
  .clone()
  .rotate(37, [0, 0, 0], [1, 2, 3])
  .translate([91, -33, 48]);
for (const format of ['step', 'brep']) {
  const buffer =
      format === 'step'
        ? await rotated.blobSTEP().arrayBuffer()
        : new TextEncoder().encode(rotated.serialize()).buffer,
    msh = rotated.mesh({ tolerance: 0.025, angularTolerance: 0.15 }),
    b = importSolid(m, {
      vertices: new Float32Array(msh.vertices),
      triangles: new Uint32Array(msh.triangles),
    }).bodies[0],
    d = detect(m, b),
    a = align(m, b, d),
    r = convert(m, a, { feet: d.feet, style: 'both' }),
    n = await convertNative({
      buffer,
      format,
      detection: d,
      options: r.report,
    });
  assert.ok(n.report.outsideChange < 0.001);
  const pose = await cad.importSTEP(new Blob([n.sourceStep]));
  assert.ok(
    Math.abs(cad.measureVolume(pose) - n.report.convertedVolume) < 0.001,
  );
  checks.push({ ...n.report, test: 'rotated-' + format });
  console.log('Native rotated', format, 'PASS');
}
const hollowFoot = await nativeFoot(),
  hollowTop = cad.makeBox([-20.75, -20.75, 4.75], [20.75, 20.75, 25]),
  cavity = cad.makeBox([-17.75, -17.75, 1], [17.75, 17.75, 26]),
  hollow = hollowTop.fuse(hollowFoot).cut(cavity);
const hm = hollow.mesh({ tolerance: 0.025, angularTolerance: 0.15 }),
  hb = importSolid(m, {
    vertices: new Float32Array(hm.vertices),
    triangles: new Uint32Array(hm.triangles),
  }).bodies[0],
  hd = detect(m, hb),
  ha = align(m, hb, hd);
assert.equal(hd.grid.matched, 1);
const hr = convert(m, ha, {
  feet: hd.feet,
  style: 'both',
  fitScrewDepth: true,
});
assert.equal(hr.report.screwDepth, 3.9);
const hn = await convertNative({
  buffer: await hollow.blobSTEP().arrayBuffer(),
  format: 'step',
  detection: hd,
  options: hr.report,
});
assert.equal(hn.report.nativeValid, true);
assert.ok(hn.report.outsideChange < 0.001);
checks.push({ ...hn.report, test: 'hollow-perimeter-contact' });
console.log('Native hollow bin PASS');
const sealed = source.cut(cad.makeBox([-28, -2, 10], [-24, 2, 14])),
  sm = sealed.mesh({ tolerance: 0.025, angularTolerance: 0.15 }),
  sb = importSolid(m, {
    vertices: new Float32Array(sm.vertices),
    triangles: new Uint32Array(sm.triangles),
  });
assert.equal(sb.bodies.length, 1);
const probe = m.Manifold.cube([3, 3, 3]).translate([-27.5, -1.5, 10.5]);
assert.ok(
  sb.bodies[0].intersect(probe).volume() < 1e-5,
  'CAD cavity filled on mesh import',
);
const sd = detect(m, sb.bodies[0]),
  sa = align(m, sb.bodies[0], sd),
  sr = convert(m, sa, { feet: sd.feet, style: 'plain' }),
  sn = await convertNative({
    buffer: await sealed.blobSTEP().arrayBuffer(),
    format: 'step',
    detection: sd,
    options: sr.report,
  });
assert.ok(sn.report.outsideChange < 0.001);
assert.equal(importSolid(m, sn.geometry).bodies.length, 1);
checks.push({ ...sn.report, test: 'enclosed-cavity' });
console.log('Native enclosed cavity PASS');
fs.writeFileSync(
  '/tmp/gridfinity-converter-checks/native.json',
  JSON.stringify(checks, null, 2),
);
