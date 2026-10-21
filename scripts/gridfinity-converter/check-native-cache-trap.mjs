import assert from 'node:assert/strict';
import { nativeFoot, previewNative, takeNativeDocument, tessellateNative } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';

const fixture = await nativeFoot();
const buffer = new TextEncoder().encode(fixture.serialize()).buffer;
fixture.delete();
const preview = await previewNative({ buffer, format: 'brep', retainSource: true, initialDeflection: 0.1 });
const source = takeNativeDocument(preview.nativeDocumentId);
const oc = cad.getOC();
const originalMesher = oc.BRepMesh_IncrementalMesh;
const originalExtract = oc.ReplicadMeshExtractor.extract;
let extractions = 0;
oc.ReplicadMeshExtractor.extract = (...args) => {
  extractions++;
  return originalExtract(...args);
};
// Embind's overload dispatcher reads metadata from its current exported function.
Object.assign(oc.ReplicadMeshExtractor.extract, originalExtract);
const options = { initialDeflection: 0.1, includeVolume: false, useFaceCache: true };
try {
  const trap = new WebAssembly.RuntimeError('injected native allocation trap');
  oc.BRepMesh_IncrementalMesh = function () { throw trap; };
  await assert.rejects(tessellateNative(source, 1000000, options), error => error === trap);
  assert.equal(extractions, 0, 'A native trap must not trigger another allocation-heavy mesh attempt.');

  oc.BRepMesh_IncrementalMesh = function () { throw Error('injected recoverable cache mismatch'); };
  const fallback = await tessellateNative(source, 1000000, options);
  assert.equal(extractions, 1);
  assert(fallback.triangles.length > 0);
  assert.equal(fallback.tessellation.attempts[0].cacheFallback, 'injected recoverable cache mismatch');
  console.log(JSON.stringify({ nativeTrapPreserved: true, noRetryAfterTrap: true, ordinaryCacheFallback: true }));
} finally {
  oc.BRepMesh_IncrementalMesh = originalMesher;
  oc.ReplicadMeshExtractor.extract = originalExtract;
  source.delete();
}
