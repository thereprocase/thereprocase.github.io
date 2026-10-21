import assert from 'node:assert/strict';
import {
  certifyNativeBoundsMatch,
  extremaBracketMatches,
} from '../../public/gridfinity-converter/native-bounds-match.js';
import initOC from '../../public/gridfinity-converter/vendor/replicad/replicad_single.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
const expected = { min: [0, 0, 0], max: [10, 10, 10] },
  outer = [
    [-0.01, -0.01, -0.01],
    [10.01, 10.01, 10.01],
  ],
  inner = [
    [0, 0, 0],
    [10, 10, 10],
  ];
assert.equal(extremaBracketMatches(outer, inner, expected), true);
assert.equal(
  extremaBracketMatches(
    [
      [-1, 0, 0],
      [10, 10, 10],
    ],
    inner,
    expected,
  ),
  false,
  'loose outer bound must not certify',
);
assert.equal(
  extremaBracketMatches(
    outer,
    [
      [1, 0, 0],
      [9, 10, 10],
    ],
    expected,
  ),
  false,
  'outer box alone cannot witness extrema',
);
assert.equal(
  extremaBracketMatches(outer, inner, { min: [1, 0, 0], max: [11, 10, 10] }),
  false,
  'translated model mismatch',
);
assert.equal(
  extremaBracketMatches(outer, inner, { min: [0, 0, 0], max: [20, 20, 20] }),
  false,
  'scaled model mismatch',
);
assert.equal(
  extremaBracketMatches(
    [
      [NaN, 0, 0],
      [10, 10, 10],
    ],
    inner,
    expected,
  ),
  false,
);
const oc = await initOC();
cad.setOC(oc);
const box = cad.makeBox([0, 0, 0], [10, 10, 10]);
const certificate = certifyNativeBoundsMatch(oc, box, expected);
assert.equal(certificate.matches, true);
assert.equal(certificate.vertexTraversalComplete, false);
assert.ok(certificate.uniqueVertexCount < certificate.vertexCount);
const collisions = { ...oc, ReplicadShapeHasher: { HashCode: () => 1 } };
assert.equal(certifyNativeBoundsMatch(collisions, box, expected).matches, true,
  'Hash collisions must compare actual vertex identity');
assert.throws(() => certifyNativeBoundsMatch({
  ...oc, ReplicadShapeHasher: { HashCode: () => { throw new WebAssembly.RuntimeError('injected trap'); } },
}, box, expected), WebAssembly.RuntimeError, 'A trapped kernel must not retry an exact fallback');
assert.equal(
  certifyNativeBoundsMatch(oc, box, { min: [2, 0, 0], max: [12, 10, 10] })
    .matches,
  false,
);
assert.equal(
  certifyNativeBoundsMatch(oc, box, { min: [0, 0, 0], max: [20, 20, 20] })
    .matches,
  false,
);
box.delete();
console.log(JSON.stringify({ passed: true, checks: 13 }));
