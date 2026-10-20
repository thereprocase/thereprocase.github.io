import assert from 'node:assert/strict';
import {
  nativeFoot,
  previewNative,
  prepareNativeDocument,
  convertNative,
} from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const oc = cad.getOC(),
  repair = oc.BRepLib.SameParameter,
  analyzer = oc.BRepCheck_Analyzer;
const box = cad.makeBox([0, 0, 0], [10, 10, 10]);
const buffer = new TextEncoder().encode(box.serialize()).buffer;
box.delete();
async function retained() {
  return (await previewNative({ buffer, format: 'brep', retainSource: true }))
    .nativeDocumentId;
}
let documentId = await retained();
await assert.rejects(
  prepareNativeDocument({ documentId, bodyIndex: 9 }),
  /selected native CAD solid/,
);
const prepared = await prepareNativeDocument({ documentId });
assert.ok(prepared.preparedDocumentId);
assert.equal(prepared.bodyIndex, 0);
assert.ok(prepared.preparationMS >= 0);
await assert.rejects(
  convertNative({
    preparedDocumentId: prepared.preparedDocumentId,
    bodyIndex: 1,
  }),
  /different body/,
);
let used = false;
// Invalid detection intentionally stops immediately after consuming the prepared
// shape; this exercises ownership/queue semantics without a full conversion.
await assert.rejects(
  convertNative({
    documentId,
    bodyIndex: 0,
    detection: {},
    onProgress: (p) => {
      if (p.includes('Using the prepared')) used = true;
    },
  }),
);
assert.equal(used, true, 'queued conversion resolves original document ID');
await assert.rejects(
  convertNative({ preparedDocumentId: prepared.preparedDocumentId }),
  /already consumed/,
);
documentId = await retained();
try {
  oc.BRepLib.SameParameter = () => {
    throw Error('injected failure');
  };
  oc.BRepCheck_Analyzer = function () {
    return { IsValid: () => false, delete() {} };
  };
  await assert.rejects(
    prepareNativeDocument({ documentId }),
    /original solid also fails strict/,
  );
} finally {
  oc.BRepLib.SameParameter = repair;
  oc.BRepCheck_Analyzer = analyzer;
}
await assert.rejects(
  prepareNativeDocument({ documentId }),
  /no longer available/,
);
const last = await prepareNativeDocument({ documentId: await retained() });
await retained();
await assert.rejects(
  convertNative({ preparedDocumentId: last.preparedDocumentId }),
  /missing or was already consumed/,
);
console.log(JSON.stringify({ passed: true, cases: 7 }));
