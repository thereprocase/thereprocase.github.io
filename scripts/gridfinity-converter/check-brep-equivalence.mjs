import assert from 'node:assert/strict';
import { equivalentBrepTokens as compare } from '../../public/gridfinity-converter/brep-equivalence.js';
const rejected = [
  ['flags', '0100000', '0100001'],
  ['flag layout', '0100000', '100000'],
  ['integer index', '42', '43'],
  ['face orientation', '+4', '-4'],
  ['missing orientation', '+4', '4'],
  ['token deletion', 'A 1 2', 'A 1'],
  ['token insertion', 'A 1', 'A 1 2'],
  ['NaN', '1.0', 'NaN'],
  ['units', 'mm', 'inch'],
  ['surface coordinate', '41.7500000', '41.7500001'],
  ['weight', '0.001', '0.00100000001'],
  ['large coordinate', '10000000000.01', '10000000000.02'],
];
for (const [label, a, b] of rejected)
  assert.equal(compare(a, b).equivalent, false, label);
assert.equal(
  compare('1 0 0.86', '1 -3.0814879110195774e-33 0.8600000000000001')
    .equivalent,
  true,
);
assert.equal(
  compare('CASCADE\nLocations 4', 'CASCADE\nLocations 4').equivalent,
  true,
);
console.log(JSON.stringify({ passed: true, rejectedCases: rejected.length }));
// OCCT emits negative zero after translating and reopening direction vectors.
assert.equal(compare('0 -0 1', '-0 0 1').equivalent, true);
assert.equal(compare('0000000', '-0').equivalent, false);
assert.equal(compare('0', '-1').equivalent, false);
