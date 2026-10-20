import assert from 'node:assert/strict';
import { preservedRepairGeometry as check } from '../../public/gridfinity-converter/repair-signature.js';
// Minimal section/record fixture for this guard; actual solid validity remains
// an independent mandatory kernel check in convertNative.
const before = `
CASCADE Topology V3, (c) Open Cascade
Locations 1
1
1 0 0 0
0 1 0 0
0 0 1 0
Curve2ds 1
1 0 0 1 0
Curves 1
7 0 0 3 4 2 0 0 0 1 0 0 2 0 0 3 0 0
0 4 1 4
Polygon3D 0
PolygonOnTriangulations 0
Surfaces 1
1 0 0 0 0 0 1 1 0 0 0 1 0
Triangulations 0
TShapes 2
Ve
0.0001
0 0 0
0 0

0101101
*
Ed
0.0001 1 1 0
1  1 0 0 1
2  1 1 0 0 1
0

0101000
+2 0 *

+1 0
`;
const after = before
  .replace('Curve2ds 1\n1 0 0 1 0', 'Curve2ds 1\n1 0 0 0.999999 0')
  .replaceAll('0.0001', '0.0002')
  .replace('1  1 0 0 1\n', '1  1 0 0 1.0000000000000002\n');
assert.equal(check(before, after).preserved, true);
const mutations = [
  ['version', (s) => s.replace('Topology V3', 'Topology V2')],
  ['curve point', (s) => s.replace('3 0 0\n0 4', '4 0 0\n0 4')],
  ['surface', (s) => s.replace('Surfaces 1\n1 0', 'Surfaces 1\n1 1')],
  ['orientation', (s) => s.replace('+2 0 *', '-2 0 *')],
  ['vertex', (s) => s.replace('Ve\n0.0002\n0 0 0', 'Ve\n0.0002\n1 0 0')],
  ['range', (s) => s.replace('1.0000000000000002', '1.01')],
  ['reference', (s) => s.replace('1  1 0 0', '1  2 0 0')],
  ['negative tolerance', (s) => s.replace('Ve\n0.0002', 'Ve\n-1')],
  ['degenerated', (s) => s.replace('0.0002 1 1 0', '0.0002 1 1 1')],
  ['count', (s) => s.replace('TShapes 2', 'TShapes 3')],
  ['location scale', (s) => s.replace('1\n1 0 0 0', '1\n2 0 0 0')],
];
for (const [label, mutate] of mutations) {
  const changed = mutate(after);
  assert.notEqual(changed, after, label);
  assert.equal(check(before, changed).preserved, false, label);
}
// Same unsupported features before and after still take the conservative path.
for (const [from, to] of [
  ['7 0 0 3', '7 1 0 3'],
  ['7 0 0 3', '7 0 1 3'],
  ['0 4 1 4', '0 3 1 4'],
])
  assert.equal(
    check(before.replace(from, to), after.replace(from, to)).preserved,
    false,
  );
console.log(
  JSON.stringify({
    passed: true,
    corruptionCases: mutations.length,
    unsupportedSplineCases: 3,
  }),
);
// Selecting a STEP solid adds an OCCT location composed of earlier locations.
const withComposition = (s) =>
  s
    .replace('Locations 1', 'Locations 2')
    .replace('Curve2ds 1', '2 1 1 1 -1 0\nCurve2ds 1');
assert.equal(
  check(withComposition(before), withComposition(after)).preserved,
  true,
);
for (const line of ['2 2 1 0', '2 1 0.5 0', '2 1 1', '2 0']) {
  const bad = (s) => withComposition(s).replace('2 1 1 1 -1 0', line);
  assert.equal(check(bad(before), bad(after)).preserved, false, line);
}
