import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {
  foot,
  detect,
  align,
  convert,
  meshData,
  importSolid,
  binarySTL,
  checkMesh,
  fitGrid,
  conversionParameters,
} from '../../public/gridfinity-converter/kernel.js';
import { demo } from '../../public/gridfinity-converter/demo.js';
const m = await Module();
m.setup();
const out = process.argv[2] ?? '/tmp/gridfinity-converter-checks';
fs.mkdirSync(out, { recursive: true });
const evidence = [];
function model(data) {
  const mesh = new m.Mesh({
    numProp: 3,
    vertProperties: data.vertices,
    triVerts: data.triangles,
  });
  mesh.merge();
  return new m.Manifold(mesh);
}
const source = model(demo(m));
for (const [name, shape] of [
  ['demo', source],
  ['rotated', source.rotate([37, -21, 61]).translate([114, -18, 71])],
  ['sideways', source.rotate([0, 90, 0])],
]) {
  const d = detect(m, shape);
  assert.equal(d.grid.matched, 2, name);
  assert.ok(
    Math.abs(Math.abs(d.feet[0].x - d.feet[1].x) - 42) < 0.001 ||
      Math.abs(Math.abs(d.feet[0].y - d.feet[1].y) - 42) < 0.001,
  );
  const s = align(m, shape, d);
  for (const style of ['plain', 'magnets', 'screws', 'both']) {
    const r = convert(m, s, { feet: d.feet, style });
    assert.equal(r.report.connectedSolids, 1);
    assert.ok(r.report.outsideChange < 0.001);
    checkMesh(r.geometry);
    const roundtrip = importSolid(m, r.geometry);
    assert.equal(roundtrip.bodies.length, 1);
    roundtrip.bodies.forEach((b) => b.delete());
    const redetected = detect(m, model(r.geometry), { orientation: '-z' });
    assert.equal(redetected.grid.matched, 2);
    for (const p of redetected.feet) {
      assert.equal(
        p.magnetCount,
        ['magnets', 'both'].includes(style) ? 4 : 0,
        `${name} ${style} magnets`,
      );
      assert.equal(
        p.screwCount,
        ['screws', 'both'].includes(style) ? 4 : 0,
        `${name} ${style} screws`,
      );
    }
    fs.writeFileSync(
      `${out}/${name}-${style}.stl`,
      Buffer.from(binarySTL(r.geometry)),
    );
    evidence.push({ name, style, grid: d.grid, report: r.report });
    console.log(name, style, 'PASS');
  }
  const subset = convert(m, s, { feet: [d.feet[0]], style: 'both' });
  const changed = model(subset.geometry),
    p = d.feet[1],
    probe = m.Manifold.cube([41.8, 41.8, 4.7]).translate([
      p.x - 20.9,
      p.y - 20.9,
      0.01,
    ]),
    a = s.intersect(probe),
    b = changed.intersect(probe),
    ab = a.subtract(b),
    ba = b.subtract(a);
  assert.ok(ab.volume() + ba.volume() < 0.001, 'Unselected foot changed');
  [probe, a, b, ab, ba, changed, s].forEach((x) => x.delete());
  if (shape !== source) shape.delete();
}
for (const missing of [false, true]) {
  const cells = [];
  for (let x = 0; x < 3; x++)
    for (let y = 0; y < 2; y++)
      if (!missing || x !== 2 || y !== 1) cells.push(foot(m, x * 42, y * 42));
  const top = m.Manifold.cube([125.5, 83.5, 4]).translate([
      -20.75, -20.75, 4.75,
    ]),
    array = m.Manifold.union([top, ...cells]),
    d = detect(m, array);
  assert.equal(d.grid.matched, missing ? 5 : 6);
  const a = align(m, array, d),
    r = convert(m, a, { feet: d.feet, style: 'both' });
  checkMesh(r.geometry);
  assert.equal(r.report.feet.length, cells.length);
  [...cells, top, array, a].forEach((s) => s.delete());
  console.log(missing ? 'Irregular array PASS' : '3 × 2 array PASS');
}
const d = detect(m, source),
  s = align(m, source, d);
assert.throws(
  () =>
    convert(m, s, {
      feet: [d.feet[0], { ...d.feet[1], x: d.feet[1].x + 1 }],
      style: 'plain',
    }),
  /42 mm/,
);
assert.throws(
  () => convert(m, s, { feet: d.feet, style: 'both', screwDepth: 8 }),
  /roof/,
);
assert.throws(
  () => convert(m, s, { feet: [{ x: 400, y: 400 }], style: 'plain' }),
  /material/,
);
assert.throws(() => convert(m, s, { feet: [], style: 'plain' }), /Select/);
assert.throws(
  () => convert(m, s, { feet: d.feet, style: 'female' }),
  /supported/,
);
const block = m.Manifold.cube([41.5, 41.5, 12]);
assert.equal(detect(m, block).feet.length, 0, 'Flat block falsely identified');
const ring = foot(m).subtract(
  m.Manifold.cube([32, 32, 8]).translate([-16, -16, -1]),
);
assert.equal(
  detect(m, ring).feet.length,
  0,
  'Female/open frame falsely identified',
);
const gridFeet = [
    { x: 0, y: 0, confidence: 1 },
    { x: 42.1, y: 0.1, confidence: 1 },
    { x: 84, y: 0, confidence: 1 },
    { x: 12, y: 19, confidence: 0.8 },
  ],
  g = fitGrid(gridFeet);
assert.equal(g.matched, 3);
assert.equal(gridFeet[1].x - gridFeet[0].x, 42);
assert.equal(gridFeet[3].gridMatch, false);
const open = meshData(source);
open.triangles = open.triangles.slice(3);
assert.throws(() => importSolid(m, open), /closed solid/);
const feetOnly = foot(m),
  cap = m.Manifold.cube([41.5, 41.5, 1]).translate([-20.75, -20.75, 4.75]),
  thin = feetOnly.add(cap);
assert.throws(
  () => convert(m, thin, { feet: [{ x: 0, y: 0 }], style: 'screws' }),
  /roof/,
);
// Enclosed cavities are void boundaries, not separate material bodies.
const outer = m.Manifold.cube([20, 20, 20]),
  voidTool = m.Manifold.cube([10, 10, 10]).translate([5, 5, 5]),
  hollowSolid = outer.subtract(voidTool);
let imported = importSolid(m, meshData(hollowSolid));
assert.equal(imported.bodies.length, 1);
assert.ok(Math.abs(imported.bodies[0].volume() - 7000) < 1e-6);
assert.ok(imported.bodies[0].intersect(voidTool).volume() < 1e-6);
imported.bodies.forEach((b) => b.delete());
const island = m.Manifold.cube([2, 2, 2]).translate([9, 9, 9]),
  nested = hollowSolid.add(island);
imported = importSolid(m, meshData(nested));
assert.equal(imported.bodies.length, 2);
assert.ok(
  Math.abs(imported.bodies.reduce((v, b) => v + b.volume(), 0) - 7008) < 1e-6,
);
imported.bodies.forEach((b) => b.delete());
const second = hollowSolid.translate([30, 0, 0]),
  pair = hollowSolid.add(second);
imported = importSolid(m, meshData(pair));
assert.equal(imported.bodies.length, 2);
assert.ok(imported.bodies.every((b) => Math.abs(b.volume() - 7000) < 1e-6));
imported.bodies.forEach((b) => b.delete());
const withHoles = convert(m, s, { feet: d.feet, style: 'both' }),
  reimport = importSolid(m, withHoles.geometry),
  again = convert(m, reimport.bodies[0], { feet: d.feet, style: 'plain' }),
  againImported = importSolid(m, again.geometry);
assert.equal(againImported.bodies.length, 1);
assert.ok(
  Math.abs(againImported.bodies[0].volume() - again.report.convertedVolume) <
    0.001,
);
checkMesh(again.geometry);
[
  ...reimport.bodies,
  ...againImported.bodies,
  outer,
  voidTool,
  hollowSolid,
  island,
  nested,
  second,
  pair,
].forEach((s) => s.delete());
console.log('Cavities, nested islands and reconversion PASS');
fs.writeFileSync(
  out + '/checks.json',
  JSON.stringify(
    {
      cases: evidence,
      negativeTests: [
        'off-grid',
        'too-deep-holes',
        'no-attachment',
        'empty-selection',
        'unknown-style',
        'flat-block',
        'female-frame',
        'grid-outlier',
        'open-mesh',
        'thin-roof',
      ],
      fixedPitch: 42,
      cavityChecks: [
        'single enclosed cavity',
        'island inside cavity',
        'two hollow bodies',
        'both-to-plain reconversion',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('Negative cases and fixed pitch PASS');

for (const fit of [0.21, 0.5, -0.51]) {
  assert.throws(() => conversionParameters({ feet: [{ x: 0, y: 0 }], fit }), /fit allowance/);
}

// Both ends of the friction range must produce valid connected geometry.
for (const fit of [-0.5, 0.2]) {
  const d = detect(m, source);
  const s = align(m, source, d);
  const r = convert(m, s, { feet: d.feet, style: 'plain', fit });
  assert.equal(r.report.connectedSolids, 1);
  console.log('Friction endpoint passed:', fit);
  s.delete();
}

[source, s, block, ring, feetOnly, cap, thin].forEach((s) => s.delete());
