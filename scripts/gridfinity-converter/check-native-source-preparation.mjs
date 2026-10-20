import assert from 'node:assert/strict';
import {
  nativeFoot,
  prepareNativeSource,
} from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const oc = cad.getOC(),
  analyzer = oc.BRepCheck_Analyzer,
  repair = oc.BRepLib.SameParameter;
let checks = 0;
oc.BRepCheck_Analyzer = function (...args) {
  checks++;
  return new analyzer(...args);
};
try {
  const box = cad.makeBox([0, 0, 0], [10, 10, 10]);
  box.mesh({ tolerance: 0.1, angularTolerance: 0.3 });
  const prepared = await prepareNativeSource(box);
  assert.equal(checks, 1, 'supported valid source receives one exact check');
  assert.match(
    prepared.source.serialize(),
    /Triangulations 6\b/,
    'source preview triangulations retained',
  );
  assert.ok(Math.abs(cad.measureVolume(prepared.source) - 1000) < 1e-9);
  prepared.source.delete();
  // A preparation exception must not discard an already-valid source.
  oc.BRepLib.SameParameter = () => {
    throw Error('injected preparation failure');
  };
  checks = 0;
  const fallback = await prepareNativeSource(
    cad.makeBox([0, 0, 0], [10, 10, 10]),
  );
  assert.equal(checks, 1);
  assert.equal(fallback.sourceCurveRepair, null);
  assert.ok(Math.abs(cad.measureVolume(fallback.source) - 1000) < 1e-9);
  fallback.source.delete();
  oc.BRepLib.SameParameter = repair;
  // Failure of the prepared exact check must also validate the original.
  checks = 0;
  oc.BRepCheck_Analyzer = function (...args) {
    checks++;
    return checks === 1
      ? { IsValid: () => false, delete() {} }
      : new analyzer(...args);
  };
  const afterFailure = await prepareNativeSource(
    cad.makeBox([0, 0, 0], [10, 10, 10]),
  );
  assert.equal(checks, 2);
  assert.equal(afterFailure.sourceCurveRepair, null);
  afterFailure.source.delete();
  // Neither representation valid: never return an unchecked body.
  oc.BRepCheck_Analyzer = function () {
    return { IsValid: () => false, delete() {} };
  };
  await assert.rejects(
    prepareNativeSource(cad.makeBox([0, 0, 0], [10, 10, 10])),
    /original solid also fails strict/,
  );
  console.log(JSON.stringify({ passed: true, cases: 4 }));
} finally {
  oc.BRepCheck_Analyzer = analyzer;
  oc.BRepLib.SameParameter = repair;
}
