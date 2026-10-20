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
// Curve repair must not turn an open shell into an accepted solid.
{
  const oc = cad.getOC(),
    shell = new oc.TopoDS_Shell(),
    builder = new oc.TopoDS_Builder();
  const box = cad.makeBox([0, 0, 0], [40, 40, 20]);
  builder.MakeShell(shell);
  for (const face of box.faces.slice(0, -1)) builder.Add(shell, face.wrapped);
  const maker = new oc.BRepBuilderAPI_MakeSolid();
  maker.Add(shell);
  const broken = cad.cast(maker.Solid());
  await assert.rejects(
    () =>
      convertNative({
        buffer: new TextEncoder().encode(broken.serialize()),
        format: 'brep',
        detection: {},
        options: {},
      }),
    /after automatic curve repair/,
  );
  checks.push({ test: 'open-native-shell', exportBlocked: true });
  broken.delete();
  maker.delete();
  builder.delete();
  shell.delete();
  box.delete();
}

for (const style of ['plain', 'magnets', 'screws', 'both']) {
  const r = convert(m, aligned, { feet: d.feet, style });
  const native = await convertNative({
    buffer,
    format: 'step',
    detection: d,
    options: r.report,
  });
  assert.equal(native.report.nativeValid, true);
  assert.equal(native.report.stepRoundTripValid, true);
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

// A STEP serializer that changes geometry must not expose that file. The
// native fallback must independently round-trip and preserve the body.
{
  const wrong = cad.makeBox([0, 0, 0], [1, 1, 1]);
  const wrongStep = wrong.blobSTEP();
  const originalWriter = Object.getOwnPropertyDescriptor(
    cad.Shape.prototype,
    'blobSTEP',
  );
  const originalSerializer = Object.getOwnPropertyDescriptor(
    cad.Shape.prototype,
    'serialize',
  );
  const wrongBrep = wrong.serialize();
  const plan = convert(m, aligned, { feet: d.feet, style: 'plain' });
  let converted;
  try {
    cad.Shape.prototype.blobSTEP = async () => wrongStep;
    converted = await convertNative({
      buffer,
      format: 'step',
      detection: d,
      options: plan.report,
    });
    cad.Shape.prototype.serialize = () => wrongBrep;
    await assert.rejects(
      () =>
        convertNative({
          buffer,
          format: 'step',
          detection: d,
          options: plan.report,
        }),
      /BREP export changed/,
    );
  } finally {
    Object.defineProperty(cad.Shape.prototype, 'blobSTEP', originalWriter);
    Object.defineProperty(cad.Shape.prototype, 'serialize', originalSerializer);
    wrong.delete();
  }
  assert.equal(converted.step, undefined);
  assert.equal(converted.report.stepRoundTripValid, false);
  assert.equal(converted.report.brepRoundTripValid, true);
  assert.match(converted.report.stepExportError, /changed/);
  const oc = cad.getOC();
  for (const bytes of [converted.brep, converted.sourceBrep]) {
    const reopened = cad.cast(
      oc.BRepToolsWrapper.Read(new TextDecoder().decode(bytes)),
    );
    const check = new oc.BRepCheck_Analyzer(
      reopened.wrapped,
      true,
      false,
      true,
    );
    assert.equal(check.IsValid(), true);
    assert.equal(reopened.solids.length, 1);
    assert.ok(
      Math.abs(cad.measureVolume(reopened) - converted.report.convertedVolume) <
        0.001,
    );
    check.delete();
    reopened.delete();
  }
  checks.push({
    test: 'invalid-step-native-brep-fallback',
    invalidBrepBlocked: true,
    ...converted.report,
  });
  console.log('Native BREP fallback PASS');
}

// BREP with user-selected inch units must retain the returned scaled shape.
{
  const inchSource = source.clone().scale(1 / 25.4);
  const plan = convert(m, aligned, { feet: d.feet, style: 'plain' });
  const converted = await convertNative({
    buffer: new TextEncoder().encode(inchSource.serialize()),
    format: 'brep',
    scale: 25.4,
    detection: d,
    options: plan.report,
  });
  assert.equal(converted.report.stepRoundTripValid, true);
  checkMesh(converted.geometry);
  assert.ok(
    Math.abs(converted.report.originalVolume - cad.measureVolume(source)) <
      0.001,
  );
  checks.push({
    test: 'inch-native-source',
    nativeValid: true,
    stepRoundTripValid: true,
  });
  inchSource.delete();
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
    input = { buffer, format, detection: d, options: r.report };
  const converted = await convertNative(input);
  assert.equal(converted.report.nativeValid, true);
  assert.equal(converted.report.stepRoundTripValid, true);
  assert.ok(converted.report.nativeCoordinateAdjustmentMM <= 0.0000051);
  checkMesh(converted.geometry);
  const reopened = await cad.importSTEP(new Blob([converted.sourceStep]));
  assert.equal(reopened.solids.length, 1);
  const before = rotated.boundingBox.bounds,
    after = reopened.boundingBox.bounds;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 3; j++)
      assert.ok(Math.abs(before[i][j] - after[i][j]) < 0.0001);
  fs.writeFileSync(
    '/tmp/gridfinity-converter-checks/native-rotated-' + format + '.step',
    Buffer.from(converted.sourceStep),
  );
  checks.push({
    test: 'rotated-' + format,
    nativeValid: true,
    stepRoundTripValid: true,
    nativeCoordinateAdjustmentMM: converted.report.nativeCoordinateAdjustmentMM,
  });
  console.log('Native rotated export PASS:', format);
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
