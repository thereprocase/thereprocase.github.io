import assert from 'node:assert/strict';
import { nativeFoot } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
import { proveNativePreservation, nativeFaces } from '../../public/gridfinity-converter/native-preservation.js';
await nativeFoot();
const oc = cad.getOC();
const cut = (a, b) => a.clone().cut(b.clone());
const source = cad.makeBox([0, 0, 0], [20, 20, 20]);
const allowed = cad.makeBox([-1, -1, -1], [21, 21, 5]);
const result = cut(source, cad.makeCylinder(2, 3, [5, 5, -1]));
const check = (shape, original = source) => {
  const checker = new oc.BRepCheck_Analyzer(shape.wrapped, true, false, true);
  const sourceChecker = new oc.BRepCheck_Analyzer(original.wrapped, true, false, true);
  try {
    return proveNativePreservation({ oc, cad, source: original, result: shape,
      editBox: allowed, cut, validatedSolids: checker.IsValid() && sourceChecker.IsValid() &&
        shape.solids.length === 1 && original.solids.length === 1,
      sourceSignedVolume: cad.measureVolume(original), resultSignedVolume: cad.measureVolume(shape) });
  } finally { checker.delete(); sourceChecker.delete(); }
};
const good = check(result);
assert.equal(good.proved, true, JSON.stringify(good));
const remoteHole = cut(result, cad.makeCylinder(2, 10, [10, 10, 15]));
assert.equal(check(remoteHole).proved, false, 'Remote cavity must not pass');
const reversed = cad.cast(result.wrapped.Reversed());
assert.equal(check(reversed).proved, false, 'Orientation reversal must not pass');
const faces = nativeFaces(oc, cad, result);
const top = faces.findIndex((face) => {
  const box = face.boundingBox, bounds = box.bounds; box.delete();
  return bounds[0][2] > 19.99;
});
assert.ok(top >= 0);
const missingTop = cad.makeCompound(faces.filter((_, i) => i !== top).map((face) => face.clone()));
assert.equal(check(missingTop).proved, false, 'Missing remote face must not pass');
const cavity = cut(source, cad.makeBox([8, 8, 8], [12, 12, 12]));
const cavityEdit = cut(cavity, cad.makeCylinder(2, 3, [5, 5, -1]));
assert.equal(check(cavityEdit, cavity).proved, true, 'Unchanged enclosed cavity must be preserved');
const changedCavity = cut(cavityEdit, cad.makeBox([7, 8, 8], [12, 12, 12]));
assert.equal(check(changedCavity, cavity).proved, false, 'Changing a remote enclosed cavity must fail');
console.log('Exact oriented preservation: local edit accepted; remote hole, missing face, reversed orientation rejected.');
