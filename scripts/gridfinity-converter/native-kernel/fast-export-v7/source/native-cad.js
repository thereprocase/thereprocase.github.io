import { withStepRepairFallback } from './step-repair-fallback.js?v=fast-export-20261021-025000';
import { BOUNDS_KERNELS } from './native-bounds-build.js?v=fast-export-20261021-025000';
import { boundsInputIdentity, validateBoundsReply } from './native-parallel-source-bounds.js?v=fast-export-20261021-025000';
import { readVerifierSTEP } from './step-verifier-reader.js?v=fast-export-20261021-025000';
import { issueSourceCertificate, verifySourceCertificate } from './native-source-certificate.js?v=fast-export-20261021-025000';
import { assertVerifierSource, verifierTolerances, claimKernelPurpose, writeVerifierSTEP, verifierExactBounds, assertFiniteStepMetrics } from './step-verifier-policy.js?v=fast-export-20261021-025000';
import { castOwned, ownedSolids } from './native-owned-shape.js?v=fast-export-20261021-025000';
import { copyNativeArray } from './native-buffer.js?v=fast-export-20261021-025000';
import { createFaceMeshCache, disposeFaceMeshCache, cacheMatchesSource, isRigidMatrix, transformFaceMeshCache, meshWithFaceCache } from './native-mesh-cache.js?v=fast-export-20261021-025000';
import { prepareNativeLocalEdit } from './native-local-edit.js?v=fast-export-20261021-025000';
import { certifyNativeBoundsMatch } from './native-bounds-match.js?v=fast-export-20261021-025000';
import { preservedRepairGeometry } from './repair-signature.js?v=fast-export-20261021-025000';
import { proveNativePreservation } from './native-preservation.js?v=fast-export-20261021-025000';
import { equivalentBrepTokens } from './brep-equivalence.js?v=fast-export-20261021-025000';
/** Preserve STEP/BREP boundary representations; meshes are display/export derivatives. */
import { initNativeKernel, nativeKernelInfo } from './native-kernel.js?v=fast-export-20261021-025000';
import * as cad from './vendor/replicad/replicad.js?v=fast-export-20261021-025000';
let ready, OC, kernelPurpose;
let displayFaceCache = null;
const retainedDisplayCaches = new Set();
let conversionShapes = null;
function ownConversionShape(shape) {
  conversionShapes?.add(shape);
  return shape;
}
/** Drop construction handles; output TShapes keep their own shared references. */
function releaseConstructionShapes(checkpoint, retained) {
  let releasedArenaEntries = 0;
  for (const shape of conversionShapes) {
    if (checkpoint.has(shape) || retained.has(shape)) continue;
    // Replicad WrappingObj.delete() is explicitly idempotent; some contact
    // probes were already deleted immediately after use.
    shape.delete();
    conversionShapes.delete(shape);
    releasedArenaEntries++;
  }
  return { releasedArenaEntries, retainedArenaEntries: conversionShapes.size };
}
const nativeBox = (...args) => ownConversionShape(cad.makeBox(...args));
const nativeCylinder = (...args) => ownConversionShape(cad.makeCylinder(...args));
function disposePreparedDocuments() {
  for (const record of preparedNativeDocuments.values()) {
    record.source.delete();
    record.localClip?.shape.delete();
    if (record.displayCache) {
      retainedDisplayCaches.delete(record.displayCache);
      if (record.displayCache !== displayFaceCache) disposeFaceMeshCache(record.displayCache);
    }
  }
  preparedNativeDocuments.clear();
}
const nativeDocuments = new Map();
let nextNativeDocument = 0;
const preparedNativeDocuments = new Map();
let nextPreparedNativeDocument = 0;
/** Transfer ownership once. The worker is discarded after conversion. */
export function takeNativeDocument(id) {
  const source = nativeDocuments.get(id);
  nativeDocuments.delete(id);
  return source ?? null;
}
function retainNativeDocument(source) {
  disposePreparedDocuments();
  for (const previous of nativeDocuments.values()) previous.delete();
  nativeDocuments.clear();
  const id = `native-document-${++nextNativeDocument}`;
  nativeDocuments.set(id, source);
  return id;
}
const volumeCache = new WeakMap();
const signedVolumeCache = new WeakMap();
const boundsCache = new WeakMap();
function exactBounds(shape) {
  if (boundsCache.has(shape)) return boundsCache.get(shape);
  const box = shape.boundingBox;
  try {
    const bounds = box.bounds;
    boundsCache.set(shape, bounds);
    return bounds;
  } finally {
    box.delete();
  }
}
async function kernel(purpose = 'model') {
  kernelPurpose = claimKernelPurpose(kernelPurpose, purpose);
  if (!ready)
    ready = initNativeKernel({purpose}).then((oc) => {
      OC = oc;
      cad.setOC(oc);
      return oc;
    });
  return ready;
}
export async function previewNative({
  buffer,
  format,
  previewTriangleBudget = 1000000,
  initialDeflection,
  retainSource = false,
  onProgress = () => {},
}) {
  const started = performance.now();
  onProgress('Loading the CAD engine…', { stage: 1, total: 5 });
  const oc = await kernel();
  const engineReadyMS = performance.now() - started;
  onProgress('Reading native CAD…', { stage: 2, total: 5 });
  const source =
    format === 'brep'
      ? castOwned(cad, oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
      : await cad.importSTEP(new Blob([buffer]));
  let nativeDocumentId = null;
  try {
    const nativeReadMS = performance.now() - started - engineReadyMS;
    // This label counts face occurrences, not distinct TShapes. Replicad's
    // source.faces deduplicates with an O(n²) IsSame scan across the WASM boundary.
    const explorer = new oc.TopExp_Explorer(
      source.wrapped,
      oc.TopAbs_ShapeEnum.TopAbs_FACE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    let faceCount = 0;
    try {
      while (explorer.More()) {
        faceCount++;
        explorer.Next();
      }
    } finally {
      explorer.delete();
    }
    const faceCountMS =
      performance.now() - started - engineReadyMS - nativeReadMS;
    const levels = [
      [0.025, 0.15],
      [0.05, 0.25],
      [0.1, 0.35],
      [0.2, 0.5],
      [0.4, 0.65],
      [0.8, 0.8],
    ];
    let nextDeflection = initialDeflection ?? (faceCount > 2000 ? 0.1 : 0.025),
      attempts = 0,
      previousTriangles;
    for (const [index, [deflection, angle]] of levels.entries()) {
      if (deflection < nextDeflection) continue;
      attempts++;
      onProgress(
        `Building preview from ${faceCount.toLocaleString()} CAD faces…`,
        {
          stage: 3,
          total: 5,
          detail:
            `Preview attempt ${attempts} · ${deflection} mm` +
            (previousTriangles
              ? ` · Previous attempt: ${previousTriangles.toLocaleString()} triangles; limit ${previewTriangleBudget.toLocaleString()}`
              : ''),
        },
      );
      if (index) oc.BRepTools.Clean(source.wrapped, false);
      // Mesh the same parsed CAD body on retries. Copy only the two buffers
      // actually used by detection/viewing, and only once an attempt fits.
      const raw = oc.ReplicadMeshExtractor.extract(
        source.wrapped,
        deflection,
        angle,
        true,
      );
      try {
        const triangles = raw.getTrianglesSize() / 3;
        if (triangles <= previewTriangleBudget) {
          const vertices = copyNativeArray(Float32Array,
            oc.wasmMemory.buffer,
            raw.getVerticesPtr(),
            raw.getVerticesSize(),
          );
          const indices = copyNativeArray(Uint32Array,
            oc.wasmMemory.buffer,
            raw.getTrianglesPtr(),
            raw.getTrianglesSize(),
          );
          onProgress('CAD preview ready.', {
            stage: 3,
            total: 5,
            detail: `${faceCount.toLocaleString()} faces · ${triangles.toLocaleString()} triangles · ${attempts} preview attempt${attempts === 1 ? '' : 's'}`,
          });
          if (retainSource) {
            disposeFaceMeshCache(displayFaceCache);
            displayFaceCache = null;
            if (deflection === 0.1 && angle === 0.35) {
              try {
                displayFaceCache = createFaceMeshCache(oc, source, { vertices, triangles: indices }, deflection, angle);
                // The branch above cleans every nonzero level before extracting.
                // Only those paths prove that all polygons came from our mesher.
                displayFaceCache.nativeGeneratedMesh = index > 0;
              }
              catch { /* Optional display cache; ordinary meshing remains available. */ }
            }
            nativeDocumentId = retainNativeDocument(source);
          }
          return {
            nativeDocumentId,
            result: {
              success: true,
              meshes: [
                {
                  attributes: { position: { array: vertices } },
                  index: { array: indices },
                },
              ],
            },
            preview: {
              nativeKernel: nativeKernelInfo(oc),
              deflectionMM: deflection,
              angularDeflection: angle,
              triangles,
              faces: faceCount,
              attempts,
              nativeReadCount: 1,
              adapted: index > 0,
              engineReadyMS,
              nativeReadMS,
              faceCountMS,
              readAndMeshMS: performance.now() - started - engineReadyMS,
            },
          };
        }
        previousTriangles = triangles;
        nextDeflection = Math.min(
          0.8,
          (deflection * triangles) / previewTriangleBudget,
        );
      } finally {
        raw.delete();
      }
    }
    throw Error(
      'This CAD file exceeds browser preview capacity. The original CAD has not been changed.',
    );
  } finally {
    if (!nativeDocumentId) source.delete();
  }
}
function volume(s) {
  if (volumeCache.has(s)) return volumeCache.get(s);
  const signed = s.isNull ? 0 : cad.measureVolume(s);
  signedVolumeCache.set(s, signed);
  const measured = Math.abs(signed);
  volumeCache.set(s, measured);
  return measured;
}
function boolean(kind, a, b) {
  // The two-shape constructor already builds. Configure an empty operation
  // first so the requested tolerance applies to one, and only one, build.
  const op = new OC['BRepAlgoAPI_' + kind]();
  const argumentsList = new OC.NCollection_List_TopoDS_Shape();
  const toolsList = new OC.NCollection_List_TopoDS_Shape();
  try {
    argumentsList.Append(a.wrapped);
    toolsList.Append(b.wrapped);
    op.SetArguments(argumentsList);
    op.SetTools(toolsList);
    // Inputs are reused for later hole and preservation checks. OCCT must
    // copy topology it needs to modify instead of changing those inputs.
    op.SetNonDestructive(true);
    if (nativeKernelInfo(OC).threads > 1) op.SetRunParallel(true);
    op.SetFuzzyValue(0.00001);
    op.Build();
    if (!op.IsDone())
      throw Error(`Native CAD ${kind} operation did not finish.`);
    return ownConversionShape(castOwned(cad, op.Shape()));
  } finally {
    op.delete();
    argumentsList.delete();
    toolsList.delete();
  }
}
const cut = (a, b) => boolean('Cut', a, b),
  fuse = (a, b) => boolean('Fuse', a, b),
  intersect = (a, b) => boolean('Common', a, b);
function union(shapes) {
  return shapes.reduce((a, b) => (a ? fuse(a, b) : b), null);
}
// Replicad's getter creates owning wrappers even when only length is needed.
// Dispose those wrappers immediately so a retained worker does not pin solids.
function solidCount(shape) {
  const solids = ownedSolids(OC, cad, shape);
  try { return solids.length; }
  finally { for (const solid of solids) solid.delete(); }
}
function valid(oc, s) {
  const c = new oc.BRepCheck_Analyzer(s.wrapped, true, nativeKernelInfo(oc).threads > 1, true);
  try {
    return c.IsValid();
  } finally {
    c.delete();
  }
}
/** Exact CAD validation of an identity copy; display polygons are not CAD. */
export function validateNativeGeometryWithoutDisplay(oc, shape) {
  const copy = nativeGeometryCopy(oc, shape);
  try { return valid(oc, copy); }
  finally { copy.delete(); }
}
function hasGeneratedDisplayMesh(shape) {
  return displayFaceCache?.nativeGeneratedMesh === true && cacheMatchesSource(displayFaceCache, shape);
}
function transform(oc, s, d, inverse = false) {
  const r = d.rotation,
    t = d.translation,
    tr = new oc.gp_Trsf();
  tr.SetValues(
    r[0],
    r[1],
    r[2],
    t[0],
    r[3],
    r[4],
    r[5],
    t[1],
    r[6],
    r[7],
    r[8],
    t[2],
  );
  const tf = new cad.Transformation(tr);
  if (inverse) tf.inverse();
  let out;
  if (!inverse && isRigidMatrix(r, t) && cacheMatchesSource(displayFaceCache, s)) {
    // A direct rigid placement preserves native geometry and existing meshes.
    const builder = new oc.BRepBuilderAPI_Transform(s.wrapped, tr, false, false);
    try { out = castOwned(cad, builder.Shape()); } finally { builder.delete(); }
    const previousCache = displayFaceCache;
    displayFaceCache = null;
    try {
      displayFaceCache = transformFaceMeshCache(oc, previousCache, out, r, t);
      displayFaceCache.nativeGeneratedMesh = previousCache.nativeGeneratedMesh === true;
    }
    catch { /* Cache mismatch falls back to fresh display meshing. */ }
    finally { if (!retainedDisplayCaches.has(previousCache)) disposeFaceMeshCache(previousCache); }
  } else {
    const builder = new oc.BRepBuilderAPI_Transform(s.wrapped, tf.wrapped, true, false);
    try { out = castOwned(cad, builder.ModifiedShape(s.wrapped)); }
    finally { builder.delete(); }
  }
  // Orientation changes are rigid, so volume is invariant.
  if (volumeCache.has(s)) volumeCache.set(out, volumeCache.get(s));
  if (signedVolumeCache.has(s)) signedVolumeCache.set(out, signedVolumeCache.get(s));
  tf.delete();
  return ownConversionShape(out);
}
export async function nativeFoot(
  x = 0,
  y = 0,
  bottom = 0,
  height = 4.75,
  fit = 0,
) {
  await kernel();
  const sections = [
    [0, 35.6, 0.8],
    [0.8, 37.2, 1.6],
    [2.6, 37.2, 1.6],
    [4.75, 41.5, 3.75],
  ];
  if (height > 4.75) sections.push([height, 41.5, 3.75]);
  const sketches = sections.map(([z, w, r]) =>
    cad
      .drawRoundedRectangle(w + 2 * fit, w + 2 * fit, r + fit)
      .sketchOnPlane('XY', [x, y, bottom + z]),
  );
  return ownConversionShape(sketches[0].loftWith(sketches.slice(1), { ruled: true }));
}
export async function tessellateNative(
  shape,
  triangleBudget = 1000000,
  { label = 'CAD body', onProgress = () => {}, initialDeflection = 0.01, includeVolume = true, useFaceCache = false } = {},
) {
  const oc = await kernel();
  const levels = [
    [0.01, 0.1], [0.025, 0.15], [0.05, 0.25], [0.1, 0.35],
    [0.2, 0.5], [0.4, 0.65], [0.8, 0.8],
  ];
  const started = performance.now(), attempts = [];
  const candidates = levels.filter(([tolerance]) => tolerance >= initialDeflection);
  let meshSource = shape;
  try {
  for (const [index, [tolerance, angularTolerance]] of candidates.entries()) {
    const previous = attempts.at(-1);
    onProgress(`Meshing ${label}: attempt ${index + 1} of ${candidates.length} · ${tolerance} mm${previous ? ` · Previous: ${previous.triangles.toLocaleString()} triangles` : ''}…`);
    const attemptStart = performance.now();
    let cacheFallback;
    if (useFaceCache && index === 0 && displayFaceCache) {
      try {
        onProgress('Reusing unchanged CAD display faces…');
        const mesh = meshWithFaceCache(oc, shape, displayFaceCache, tolerance, angularTolerance, triangleBudget);
        return { vertices: mesh.vertices, triangles: mesh.triangles,
          ...(includeVolume ? { volume: volume(shape) } : {}),
          tessellationDeflectionMM: tolerance,
          tessellation: { attempts: [{ deflectionMM: tolerance, triangles: mesh.triangles.length / 3, elapsedMS: mesh.elapsedMS }],
            elapsedMS: performance.now() - started, reusedFaces: mesh.reusedFaces, changedFaces: mesh.changedFaces },
        };
      } catch (error) {
        // A native trap is not a cache mismatch. Retrying on the same kernel
        // can obscure the first failure and allocate into damaged memory.
        if (error instanceof WebAssembly.RuntimeError) throw error;
        cacheFallback = error.message;
      }
    }
    // Keep the existing finest-fitting tolerance policy. Reject oversized
    // attempts before copying any buffers; normals/face groups are not used.
    // Fresh meshing clears polygon caches on shared TShapes. Isolate this
    // path when an original source is retained, preserving its reusable mesh.
    // Successful face-cache reuse above never needs this geometry copy.
    if (retainedDisplayCaches.size && meshSource === shape)
      meshSource = nativeGeometryCopy(oc, shape);
    if (index) oc.BRepTools.Clean(meshSource.wrapped, false);
    const raw = oc.ReplicadMeshExtractor.extract(meshSource.wrapped, tolerance, angularTolerance, true);
    try {
      const triangles = raw.getTrianglesSize() / 3;
      attempts.push({ deflectionMM: tolerance, triangles, elapsedMS: performance.now() - attemptStart, ...(cacheFallback ? { cacheFallback } : {}) });
      if (triangles <= triangleBudget) {
        const vertices = copyNativeArray(Float32Array, oc.wasmMemory.buffer, raw.getVerticesPtr(), raw.getVerticesSize());
        const indices = copyNativeArray(Uint32Array, oc.wasmMemory.buffer, raw.getTrianglesPtr(), raw.getTrianglesSize());
        return {
          vertices, triangles: indices, ...(includeVolume ? { volume: volume(shape) } : {}),
          tessellationDeflectionMM: tolerance,
          tessellation: { attempts, elapsedMS: performance.now() - started },
        };
      }
    } finally { raw.delete(); }
  }
  throw Error('The CAD result exceeds browser mesh capacity after automatic preview adaptation.');
  } finally {
    if (meshSource !== shape) meshSource.delete();
  }
}

function createNativeExportChecks(oc, { preferPreservedCurves = false, verifier = false, trustedSource = null, parallelSourceBounds = null, onProgress = () => {} } = {}) {
  const certificates = new WeakMap();
  const exportBounds=shape=>{
    if(verifier)return verifierExactBounds(oc,shape.wrapped);
    const box=shape.boundingBox;
    try{return box.bounds.map(row=>[...row]);}finally{box.delete();}
  };
  const timedMetric=(stage,fn)=>{const t=performance.now();const value=fn();onProgress('Checking STEP geometry…',{diagnostic:'step-export-verifier',stage,elapsedMS:performance.now()-t});return value;};
  const sourceCertificate = shape => {
    if (certificates.has(shape)) return certificates.get(shape);
    const began = performance.now();
    if (verifier) timedMetric('source-flags',()=>assertVerifierSource(oc, shape.wrapped));
    const bounds = trustedSource?.shape === shape && trustedSource.metrics.bounds ? trustedSource.metrics.bounds : parallelSourceBounds ? undefined : timedMetric('source-bounds',()=>exportBounds(shape));
    const metrics = { bounds, volume: trustedSource?.shape === shape ? trustedSource.metrics.signedVolume : timedMetric('source-volume-cached',()=>volume(shape)), tolerances: verifier ? timedMetric('source-tolerances',()=>verifierTolerances(oc, shape.wrapped)) : null };
    if (bounds) assertFiniteStepMetrics(metrics,verifier);
    else if (!Number.isFinite(metrics.volume) || !Array.isArray(metrics.tolerances) || metrics.tolerances.length!==3 || !metrics.tolerances.every(v=>Number.isFinite(v)&&v>=0)) throw Error('Invalid STEP source metrics.');
    certificates.set(shape, metrics);
    onProgress('Prepared STEP source checks…', { diagnostic:'step-export-verifier', stage:'source-metrics', elapsedMS:performance.now()-began });
    return metrics;
  };
  // Validate the serialized file, not only the in-memory boolean result.
  const serializeAndCheck = async (shape, mode, repairPolicy = 'full') => {
    const expected = sourceCertificate(shape);
    const serializeStarted = performance.now();
    // Validate both supported representations of optional surface curves.
    const precision=verifier ? Math.max(...expected.tolerances) : undefined;
    let blob;
    if(verifier)blob=await writeVerifierSTEP(oc,shape.wrapped,precision);
    else {
      // Preserve the existing generic export path and its writer initialization.
      const previousMode=oc.Interface_Static.IVal('write.surfacecurve.mode');
      try{oc.Interface_Static.SetIVal('write.surfacecurve.mode',mode);blob=await shape.blobSTEP();}
      finally{oc.Interface_Static.SetIVal('write.surfacecurve.mode',previousMode);}
    }
    onProgress('STEP writer policy applied…',{diagnostic:'step-export-verifier',stage:'writer-policy',surfaceCurves:mode,precision});
    onProgress('Reopening exported STEP…', {diagnostic:'step-export-verifier',stage:'serialize',elapsedMS:performance.now()-serializeStarted});
    const reopenStarted = performance.now();
    const reopened = verifier ? await readVerifierSTEP(oc, blob, raw => cad.cast(raw), onProgress, {selectiveRepair: repairPolicy === 'selective'}) : await cad.importSTEP(blob);
    onProgress('Checking exported STEP…', {diagnostic:'step-export-verifier',stage:'reopen',elapsedMS:performance.now()-reopenStarted});
    try {
      if (!expected.bounds) {
        try {
          const outcome=await parallelSourceBounds.task;
          if(outcome.error)throw Error(outcome.error);
          const identityOutcome=await parallelSourceBounds.identity;
          if(identityOutcome.error)throw Error(identityOutcome.error);
          expected.bounds=validateBoundsReply(outcome.value,identityOutcome.value,nativeKernelInfo(oc));
          onProgress('Parallel source bounds accepted…',{diagnostic:'parallel-source-bounds',stage:'accepted',capacityBytes:outcome.value.capacityBytes,mainCapacityBytes:oc.wasmMemory.buffer.byteLength});
        } catch(error) {
          onProgress('Computing source bounds locally…',{diagnostic:'parallel-source-bounds',stage:'fallback',reason:error.message});
          expected.bounds=timedMetric('source-bounds',()=>exportBounds(shape));
        }
        assertFiniteStepMetrics(expected,verifier);
      }
      const checkStarted = performance.now();
      if (!valid(oc, reopened) || solidCount(reopened) !== 1)
        throw Error(
          'The exported STEP fails strict CAD validation when reopened. STEP export blocked.',
        );
      onProgress('Checking exported STEP geometry…', {diagnostic:'step-export-verifier',stage:'exact-check',elapsedMS:performance.now()-checkStarted});
      const metricsStarted = performance.now();
      const actualTolerances=verifier ? timedMetric('reopened-tolerances',()=>verifierTolerances(oc,reopened.wrapped)) : null;
      onProgress('Comparing STEP tolerance ceilings…',{diagnostic:'step-export-verifier',stage:'compare-tolerances',expected:expected.tolerances,actual:actualTolerances});
      if (verifier) assertFiniteStepMetrics({bounds:expected.bounds,volume:expected.volume,tolerances:actualTolerances},true);
      if (verifier && actualTolerances.some((value,i)=>value > expected.tolerances[i] + 1e-12)) throw Error('STEP export changed native tolerance ceilings. Export blocked.');
      const actualVolume=timedMetric('reopened-volume',()=>volume(reopened));
      const changed = Math.abs(expected.volume - actualVolume);
      const actualBounds = timedMetric('reopened-bounds',()=>exportBounds(reopened));
      assertFiniteStepMetrics({bounds:actualBounds,volume:actualVolume,tolerances:actualTolerances},verifier);
      const boundsChanged = expected.bounds.some((row, i) =>
        row.some(
          (value, j) => Math.abs(value - actualBounds[i][j]) > 0.00001,
        ),
      );
      onProgress('Comparing STEP geometry…',{diagnostic:'step-export-verifier',stage:'compare-geometry',expectedVolume:expected.volume,actualVolume,volumeDelta:actualVolume-expected.volume,expectedBounds:expected.bounds,actualBounds,expectedTolerances:expected.tolerances,actualTolerances});
      if (boundsChanged || changed > Math.max(0.001, expected.volume * 1e-8))
        throw Error(
          'STEP export changed the solid geometry when reopened. Export blocked.',
        );
      onProgress('STEP checks complete…', {diagnostic:'step-export-verifier',stage:'volume-bounds-ceilings',elapsedMS:performance.now()-metricsStarted});
      return await blob.arrayBuffer();
    } finally {
      reopened.delete();
    }
  };
  const checkedStep = async (shape, label) => {
    // Repaired sources need their corrected pcurves retained when possible.
    // Some other shapes serialize more reliably with reconstructed pcurves.
    const modes = verifier ? [1] : preferPreservedCurves ? [1, 0] : [0, 1];
    let failure;
    for (const mode of modes) {
      const surfaceCurves = mode ? 'preserved' : 'reconstructed-on-import';
      onProgress(`Validating ${label} STEP (${surfaceCurves} surface curves)…`);
      try {
        const verified = await withStepRepairFallback({enabled: verifier && typeof oc.nativeSetStepReadFixMode === 'function', attempt: policy => serializeAndCheck(shape, mode, policy), onProgress});
        return { buffer: verified.value, repairPolicy: verified.repairPolicy, repairRetried: verified.repairRetried, surfaceCurves, precision: verifier ? Math.max(...sourceCertificate(shape).tolerances) : undefined };
      } catch (error) {
        if (
          error instanceof WebAssembly.RuntimeError || !/exported STEP fails strict|STEP export changed/.test(error.message)
        )
          throw error;
        failure = error;
      }
    }
    throw failure;
  };
  const checkedBrep = (shape, label) => {
    onProgress(`Validating ${label} native BREP export…`);
    const checkStarted = performance.now();
    // Serialize exact CAD from an identity copy without carrying display
    // triangles into the native file or clearing the viewer cache.
    const text = nativeGeometrySnapshot(oc, shape);
    const serializedMS = performance.now() - checkStarted;
    const reopened = castOwned(cad, oc.BRepToolsWrapper.Read(text));
    const readMS = performance.now() - checkStarted - serializedMS;
    try {
      if (!valid(oc, reopened) || solidCount(reopened) !== 1)
        throw Error('Native BREP export fails validation when reopened.');
      // Reopening may renormalize direction vectors by a few floating-point
      // ulps. When every serialized topology token and geometric parameter
      // survives within this narrow guard, computing optimal BSpline bounds
      // twice adds no useful preservation evidence. Exact validity and volume
      // checks remain mandatory. Other representations take the original path.
      const validationMS = performance.now() - checkStarted - serializedMS - readMS;
      const equivalent = equivalentBrepTokens(text, reopened.serialize());
      onProgress(`Checking ${label} native BREP geometry…`, {
        diagnostic: 'brep-roundtrip',
        serializedMS,
        readMS,
        validationMS,
        equivalence: equivalent,
      });
      let boundsChanged = false;
      if (!equivalent.equivalent) {
        const expectedBounds = exactBounds(shape);
        const actualBounds = exactBounds(reopened);
        boundsChanged = expectedBounds.some((row, i) =>
          row.some(
            (value, j) => Math.abs(value - actualBounds[i][j]) > 0.00001,
          ),
        );
      }
      if (
        boundsChanged ||
        Math.abs(volume(shape) - volume(reopened)) >
          Math.max(0.001, volume(shape) * 1e-8)
      )
        throw Error(
          'Native BREP export changed the solid geometry when reopened.',
        );
      return new TextEncoder().encode(text).buffer;
    } finally {
      reopened.delete();
    }
  };
  return { checkedStep, checkedBrep };
}
/** Independently check an exact candidate while its owner checks the live solid.
 * Unsupported token representations require the original bounds-aware path.
 */
export async function warmNativeBrepValidator({ certificateBounds = false } = {}) { await kernel(certificateBounds ? 'step-export-verifier' : 'model'); }
export async function validateNativeBrepCandidate({ candidateText, expectedVolume, issueCertificate = false, certificateBounds = false, onProgress = () => {}, onReady = () => {} }) {
  if (typeof candidateText !== 'string' || !candidateText.length || !Number.isFinite(expectedVolume) || expectedVolume <= 0)
    throw Error('Native BREP candidate requires geometry and a positive expected volume.');
  const oc = await kernel(certificateBounds ? 'step-export-verifier' : 'model');
  const started = performance.now(), startedAtMS = Date.now();
  const stageMS = {}, wasmCapacitySamples = [];
  const sample = stage => wasmCapacitySamples.push({ stage, elapsedMS: performance.now() - started, capacityBytes: oc.wasmMemory.buffer.byteLength });
  sample('before-read');
  onReady({ startedAtMS });
  onProgress('Validating native BREP export in parallel…');
  let stageStarted = performance.now();
  const reopened = castOwned(cad, oc.BRepToolsWrapper.Read(candidateText));
  stageMS.read = performance.now() - stageStarted;
  sample('after-read');
  try {
    stageStarted = performance.now();
    const exactValid = valid(oc, reopened);
    stageMS.exactValidity = performance.now() - stageStarted;
    sample('after-exact-validity');
    stageStarted = performance.now();
    const oneSolid = exactValid && solidCount(reopened) === 1;
    stageMS.solidCount = performance.now() - stageStarted;
    if (!oneSolid)
      throw Error('Native BREP export fails validation when reopened.');
    stageStarted = performance.now();
    const actualVolume = volume(reopened);
    stageMS.volume = performance.now() - stageStarted;
    sample('after-volume');
    if (!Number.isFinite(actualVolume) || Math.abs(expectedVolume - actualVolume) > Math.max(0.001, expectedVolume * 1e-8))
      throw Error('Native BREP export changed the solid geometry when reopened.');
    stageStarted = performance.now();
    const roundTripText = reopened.serialize();
    stageMS.serialize = performance.now() - stageStarted;
    sample('after-serialize');
    stageStarted = performance.now();
    const equivalent = equivalentBrepTokens(candidateText, roundTripText);
    stageMS.equivalence = performance.now() - stageStarted;
    sample('after-equivalence');
    const report = { validationMS: performance.now() - started, startedAtMS, finishedAtMS: Date.now(), equivalence: equivalent,
      stageMS, nativeKernel: nativeKernelInfo(oc), candidateCharacters: candidateText.length, wasmMemoryMetric: 'linear-memory-capacity-not-live-allocation', wasmCapacitySamples };
    if (!equivalent.equivalent) return { fallbackRequired: true, report };
    stageStarted = performance.now();
    const buffer = new TextEncoder().encode(candidateText).buffer;
    stageMS.encode = performance.now() - stageStarted;
    sample('after-encode');
    let sourceCertificate;
    if (issueCertificate) {
      stageStarted=performance.now();
      const signedVolume=signedVolumeCache.get(reopened);
      // Negative/unsupported cases keep full export checks; never attest abs(volume).
      if(Number.isFinite(signedVolume) && signedVolume>0) {
        const bounds=certificateBounds ? verifierExactBounds(oc,reopened.wrapped) : undefined;
        sourceCertificate=await issueSourceCertificate({buffer,signedVolume,bounds,strictValid:exactValid,solidCount:1});
      }
      stageMS.sourceCertificate=performance.now()-stageStarted;
      report.validationMS=performance.now()-started;report.finishedAtMS=Date.now();
    }
    return { buffer, report, sourceCertificate };
  } finally { reopened.delete(); }
}
/** Mesh a validated native export on demand, independently of its display mesh. */
export async function nativeMeshExport({ buffer, format, onProgress = () => {}, displayOnly = false }) {
  const oc = await kernel();
  onProgress('Opening native geometry for mesh export…');
  const source = format === 'brep' || format === 'brp'
    ? castOwned(cad, oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
    : await cad.importSTEP(new Blob([buffer]));
  try {
    const geometry = await tessellateNative(source, 1000000, { label: 'mesh export', onProgress, includeVolume: false, initialDeflection: displayOnly ? 0.1 : 0.01 });
    return {
      geometry,
      report: {
        tessellationDeflectionMM: geometry.tessellationDeflectionMM,
        meshTessellation: geometry.tessellation,
      },
    };
  } finally { source.delete(); }
}
/** Exact identity only: even a tiny requested coordinate change needs its own export. */
export function nativePosesIdentical(detection) {
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return Array.isArray(detection.rotation) && detection.rotation.length === 9 &&
    detection.rotation.every((value, index) => value === identity[index]) &&
    Array.isArray(detection.translation) && detection.translation.length === 3 &&
    detection.translation.every((value) => value === 0);
}
/** Validate a requested pose only when it is downloaded; input bytes remain untouched. */
export async function exportNativeOriginalPose({ buffer, format, transform: pose,
  requestedFormat = format, outputPose = 'original', preferredSurfaceCurves, sourceCertificate: privateCertificate, sourceBoundsTask = null, onProgress = () => {} }) {
  if(!['base-down','original'].includes(outputPose)) throw Error('Unsupported output pose.');
  if(outputPose==='base-down' && !nativePosesIdentical(pose)) throw Error('Base-down export requires an identity transform.');
  const rotation = pose?.rotation, translation = pose?.translation;
  if (!Array.isArray(rotation) || rotation.length !== 9 ||
      !Array.isArray(translation) || translation.length !== 3 ||
      ![...rotation, ...translation].every(Number.isFinite))
    throw Error('Original-pose transform is missing or invalid.');
  for (let row = 0; row < 3; row++)
    for (let other = 0; other < 3; other++) {
      const dot = [0, 1, 2].reduce((sum, column) =>
        sum + rotation[row * 3 + column] * rotation[other * 3 + column], 0);
      if (Math.abs(dot - (row === other ? 1 : 0)) > 1e-9)
        throw Error('Original-pose transform must be rigid.');
    }
  const r = rotation;
  const determinant = r[0] * (r[4] * r[8] - r[5] * r[7]) -
    r[1] * (r[3] * r[8] - r[5] * r[6]) + r[2] * (r[3] * r[7] - r[4] * r[6]);
  if (Math.abs(determinant - 1) > 1e-9)
    throw Error('Original-pose transform must preserve orientation.');
  if (![format, requestedFormat].every(value => ['step', 'brep'].includes(value))) throw Error('Unsupported native export format.');
  onProgress('Opening the validated native export…');
  const kernelStarted = performance.now();
  const oc = await kernel(format === 'brep' && requestedFormat === 'step' ? 'step-export-verifier' : 'model');
  onProgress('Native export engine ready…', {diagnostic:'step-export-verifier',stage:'kernel',elapsedMS:performance.now()-kernelStarted,purpose:kernelPurpose,...nativeKernelInfo(oc)});
  const readStarted=performance.now();
  const source = format === 'brep'
    ? castOwned(cad, oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
    : await cad.importSTEP(new Blob([buffer]));
  onProgress('Native source opened…',{diagnostic:'step-export-verifier',stage:'source-read',elapsedMS:performance.now()-readStarted});
  let restored;
  try {
    const certificateStarted=performance.now();
    const trustedMetrics=await verifySourceCertificate({certificate:privateCertificate,buffer,format,pose});
    onProgress('Checking saved source validation…',{diagnostic:'step-export-verifier',stage:'source-certificate',reused:!!trustedMetrics,elapsedMS:performance.now()-certificateStarted});
    onProgress(outputPose==='base-down' ? 'Checking the base-down native export…' : 'Checking the native export before restoring its pose…');
    const sourceCheckStarted=performance.now();
    if (!trustedMetrics && (!valid(oc, source) || solidCount(source) !== 1))
      throw Error('Original-pose export requires one valid positive native solid.');
    onProgress('Native source is valid…',{diagnostic:'step-export-verifier',stage:'source-exact',reused:!!trustedMetrics,elapsedMS:performance.now()-sourceCheckStarted});
    const sourceVolumeStarted=performance.now();
    if(trustedMetrics) signedVolumeCache.set(source,trustedMetrics.signedVolume);
    else volume(source);
    if (!(Number.isFinite(signedVolumeCache.get(source)) && signedVolumeCache.get(source)>0)) throw Error('Original-pose export requires one valid positive native solid.');
    onProgress('Native source volume checked…',{diagnostic:'step-export-verifier',stage:'source-volume',reused:!!trustedMetrics,elapsedMS:performance.now()-sourceVolumeStarted});
    const identical = nativePosesIdentical(pose);
    if (identical && requestedFormat === format) return { buffer, format, report: {
      pose: outputPose, nativeKernel: nativeKernelInfo(oc), nativeValid: true, nativeExportFormat: format,
      stepRoundTripValid: format === 'step', brepRoundTripValid: format === 'brep',
      originalPoseExportReused: true,
    } };
    restored = identical ? source : transform(oc, source, pose, true);
    const { checkedStep, checkedBrep } = createNativeExportChecks(oc, {
      verifier: format === 'brep' && requestedFormat === 'step',
      trustedSource: trustedMetrics ? {shape:restored,metrics:trustedMetrics} : null,
      parallelSourceBounds: sourceBoundsTask && format==='brep' && requestedFormat==='step' ? {task:sourceBoundsTask,identity:boundsInputIdentity(buffer,pose).then(value=>({value}),error=>({error:error.message??String(error)}))} : null,
      preferPreservedCurves: preferredSurfaceCurves === 'preserved', onProgress,
    });
    let bytes, outputFormat = requestedFormat, stepExportError, surfaceCurves, stepWriterPrecision, stepRepairPolicy, stepRepairRetried, stepValidationPolicy;
    if (requestedFormat === 'step') {
      try {
        const exported = await checkedStep(restored, outputPose==='base-down' ? 'base-down' : 'original-pose');
        bytes = exported.buffer; surfaceCurves = exported.surfaceCurves; stepWriterPrecision=exported.precision; stepRepairPolicy=exported.repairPolicy; stepRepairRetried=exported.repairRetried;
        stepValidationPolicy = {
          toleranceCeiling: { enabled: format === 'brep', formula: 'actual[i] <= source[i] + absoluteAllowanceMM', absoluteAllowanceMM: 1e-12, order: ['vertex', 'edge', 'face'] },
          bounds: { formula: 'abs(actual[i][j] - source[i][j]) <= absoluteAllowanceMM', absoluteAllowanceMM: 1e-5 },
          volume: { formula: 'abs(actual - source) <= max(absoluteAllowanceMM3, source * relativeAllowance)', absoluteAllowanceMM3: 0.001, relativeAllowance: 1e-8 },
          strictNativeValidity: true, requiredSolidCount: 1,
        };
      } catch (error) {
        if (error instanceof WebAssembly.RuntimeError || !/exported STEP fails strict|STEP export changed/.test(error.message)) throw error;
        stepExportError = error.message;
        outputFormat = 'brep';
      }
    }
    if (outputFormat === 'brep') bytes = checkedBrep(restored, outputPose==='base-down' ? 'base-down' : 'original-pose');
    return { buffer: bytes, format: outputFormat, report: {
      pose: outputPose, nativeKernel: nativeKernelInfo(oc), nativeValid: true, nativeExportFormat: outputFormat,
      stepRoundTripValid: outputFormat === 'step', brepRoundTripValid: outputFormat === 'brep',
      sourceCertificateReused:!!trustedMetrics, stepExportError, stepRepairPolicy, stepRepairRetried, stepWriterPrecision, stepValidationPolicy, stepSurfaceCurves: surfaceCurves, originalPoseExportReused: false,
    } };
  } finally { if (restored !== source) restored?.delete(); source.delete(); }
}
/** Snapshot native geometry without clearing preview triangles on shared faces. */
function nativeGeometryCopy(oc, source) {
  const identity = new oc.gp_Trsf();
  const builder = new oc.BRepBuilderAPI_Transform(source.wrapped, identity, true, false);
  try { return castOwned(cad, builder.Shape()); }
  finally { builder.delete(); identity.delete(); }
}
export function nativeGeometrySnapshot(oc, source) {
  const copy = nativeGeometryCopy(oc, source);
  try { return copy.serialize(); }
  finally { copy.delete(); }
}
/** Prepare curves before one final exact check; never assume the input is invalid. */
export async function prepareNativeSource(source, onProgress = () => {}) {
  const oc = await kernel();
  // Unmodified, exact-valid CAD needs no parameter reconstruction. Require
  // matching edge parameter flags as well; validity alone is not that contract.
  const flags = new oc.TopExp_Explorer(source.wrapped, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let consistent = true;
  try {
    while (flags.More()) {
      const raw = flags.Current(); let edge;
      try {
        edge = oc.TopoDS.Edge(raw);
        if (!oc.BRep_Tool.Degenerated(edge) && (!oc.BRep_Tool.SameParameter(edge) || !oc.BRep_Tool.SameRange(edge))) { consistent = false; break; }
      } finally { edge?.delete(); raw.delete(); }
      flags.Next();
    }
  } finally { flags.delete(); }
  if (consistent) {
    onProgress('Checking original native CAD before preparation…');
    const sourceValid = hasGeneratedDisplayMesh(source)
      ? validateNativeGeometryWithoutDisplay(oc, source) : valid(oc, source);
    if (sourceValid) {
      onProgress('Original native CAD is already valid; preserving its curves unchanged.', { diagnostic: 'source-preparation', originalValid: true, repairSkipped: true });
      return { source, sourceCurveRepair: null };
    }
  }
  onProgress('Preparing native curve consistency…');
  const beforeVolume = volume(source);
  const beforeRepresentation = nativeGeometrySnapshot(oc, source);
  const maxTolerance = shape => Math.max(
    oc.BRep_Tool.MaxTolerance(shape.wrapped, oc.TopAbs_ShapeEnum.TopAbs_EDGE),
    oc.BRep_Tool.MaxTolerance(shape.wrapped, oc.TopAbs_ShapeEnum.TopAbs_VERTEX),
  );
  const beforeTolerance = maxTolerance(source);
  let original = null;
  const originalShape = () => original ??= castOwned(cad, oc.BRepToolsWrapper.Read(beforeRepresentation));
  let originalValid;
  const restoreValidOriginal = () => {
    const saved = originalShape();
    originalValid ??= valid(oc, saved);
    if (!originalValid) return null;
    source.delete();
    original = null;
    return { source: saved, sourceCurveRepair: null };
  };
  let repairGeometry, afterRepresentation, afterTolerance, volumeChange, repairedSnapshot;
  try {
    onProgress('Rebuilding native edge parameters…');
    try {
      oc.BRepLib.SameParameter(source.wrapped, 0.00001, true);
    } finally {
      volumeCache.delete(source);
      signedVolumeCache.delete(source);
      boundsCache.delete(source);
    }
    repairedSnapshot = nativeGeometryCopy(oc, source);
    afterRepresentation = repairedSnapshot.serialize();
    repairGeometry = preservedRepairGeometry(beforeRepresentation, afterRepresentation);
    afterTolerance = maxTolerance(source);
    volumeChange = Math.abs(volume(source) - beforeVolume);
    if (volumeChange > Math.max(0.001, beforeVolume * 1e-8))
      throw Error('preparation changed the solid volume');
    if (afterTolerance > Math.max(beforeTolerance, 0.00001) + 1e-7)
      throw Error('preparation required looser edge tolerances');
    if (!repairGeometry.preserved) {
      // Unsupported inputs that were already valid retain their original CAD.
      const restored = restoreValidOriginal();
      if (restored) return restored;
      // Preserve the established conservative repair path for invalid inputs
      // whose representation is outside the narrow signature grammar.
      const beforeBounds = exactBounds(originalShape()), afterBounds = exactBounds(source);
      if (beforeBounds.some((row,i) => row.some((v,j) => Math.abs(v-afterBounds[i][j]) > 0.00001)))
        throw Error('preparation changed the solid bounds');
    }
    onProgress('Validating prepared native CAD…', {
      diagnostic: 'repair-preservation', geometryCheck: repairGeometry,
    });
    const meshFreeCheck = hasGeneratedDisplayMesh(source);
    onProgress('Checking exact native geometry…', {
      diagnostic: 'native-validation', meshFreeDisplayCopy: meshFreeCheck,
    });
    if (!(meshFreeCheck ? valid(oc, repairedSnapshot) : valid(oc, source)))
      throw Error('prepared solid fails strict CAD validation');
    return { source, sourceCurveRepair: beforeRepresentation === afterRepresentation ? null : {
      method: 'curve-consistency-preparation',
      geometryCheck: repairGeometry.preserved ? 'preserved-3d-geometry-and-bounded-edge-ranges' : 'optimal-bounds',
      geometryCheckFallbackReason: repairGeometry.preserved ? undefined : repairGeometry.reason,
      maximumEdgeRangeMovementMM: repairGeometry.preserved ? repairGeometry.maxMovementMM : undefined,
      volumeChange, beforeToleranceMM: beforeTolerance, afterToleranceMM: afterTolerance, strictValid: true,
    }};
  } catch (error) {
    if (error instanceof WebAssembly.RuntimeError) throw error;
    onProgress('Checking the original native CAD after preparation could not be used…');
    const restored = restoreValidOriginal();
    if (restored) return restored;
    throw Error(`Native curve preparation failed: ${error.message}. The original solid also fails strict CAD validation. Conversion stopped.`);
  } finally {
    original?.delete();
    repairedSnapshot?.delete();
  }
}
/** Consume a retained source and retain its exact-validated selected solid. */
export async function prepareNativeDocument({ documentId, bodyIndex = 0, onProgress = () => {} }) {
  const started = performance.now();
  if (!Number.isInteger(bodyIndex) || bodyIndex < 0) throw Error('Invalid native body index.');
  const document = nativeDocuments.get(documentId);
  if (!document) throw Error('The native source document is no longer available.');
  const bodies = ownedSolids(OC, cad, document).sort((a,b) => volume(b)-volume(a));
  const selected = bodies[bodyIndex];
  if (!selected) {
    bodies.forEach(body => body.delete());
    throw Error('The selected native CAD solid was not found.');
  }
  takeNativeDocument(documentId);
  bodies.forEach((body,index) => { if (index !== bodyIndex) body.delete(); });
  document.delete();
  let prepared;
  try {
    prepared = await prepareNativeSource(selected, onProgress);
    // One source file is active per worker. Do not retain obsolete solids.
    disposePreparedDocuments();
    const preparedDocumentId = `prepared-native-document-${++nextPreparedNativeDocument}`;
    const preparationMS = performance.now()-started;
    preparedNativeDocuments.set(preparedDocumentId, { ...prepared, documentId, bodyIndex, preparationMS,
      displayCache: cacheMatchesSource(displayFaceCache, prepared.source) ? displayFaceCache : null,
    });
    return { preparedDocumentId, bodyIndex, preparationMS, sourceCurveRepair: prepared.sourceCurveRepair };
  } catch(error) {
    selected.delete();
    throw error;
  }
}
/** Only immutable, strictly prepared source entries can survive a clean cancellation. */
export function hasPreparedNativeDocument(documentId, bodyIndex = 0) {
  return conversionShapes === null && [...preparedNativeDocuments.values()].some(record =>
    record.documentId === documentId && record.bodyIndex === bodyIndex);
}
export async function convertNative({
  buffer,
  preparedDocumentId,
  documentId,
  retainDocument = false,
  fastDisplay = false,
  deferOriginalPose = false,
  nativeExportPreference = 'auto',
  topologyCopyPrimary = false,
  validateBrepCandidate,
  checkCancelled = () => {},
  waitForCancellation = promise => promise,
  format,
  scale = 1,
  bodyIndex = 0,
  detection,
  options: p,
  onProgress = () => {},
}) {
  const oc = await kernel();
  if (conversionShapes) throw Error('Native conversions must run sequentially.');
  const ownedShapes = new Set();
  const memoryStats = () => {
    if (oc.nativeAllocatorStats) return { allocator: 'dlmalloc', scope: 'whole allocator', ...oc.nativeAllocatorStats() };
    return {
      allocator: 'mimalloc', scope: 'current-thread statistics; backing arena is not live allocation',
      currentThread: oc.nativeMimallocCurrentThreadStats?.(false),
      backing: oc.nativeMimallocBackingStats?.(),
      wasmCapacityBytes: oc.wasmMemory.buffer.byteLength,
    };
  };
  const lifetime = { before: memoryStats() };
  conversionShapes = ownedShapes;
  let retainedRecord = null;
  try {
  let source, sourceCurveRepair, sourcePreparationMS;
  const resolvedPreparedId = preparedDocumentId || (documentId &&
    [...preparedNativeDocuments.entries()].find(([, record]) =>
      record.documentId === documentId && record.bodyIndex === bodyIndex)?.[0]);
  if (resolvedPreparedId) {
    const prepared = preparedNativeDocuments.get(resolvedPreparedId);
    if (!prepared) throw Error('The prepared native document is missing or was already consumed.');
    if (prepared.bodyIndex !== bodyIndex) throw Error('The prepared native document belongs to a different body.');
    if (retainDocument) {
      retainedRecord = prepared;
      if (displayFaceCache && displayFaceCache !== prepared.displayCache && !retainedDisplayCaches.has(displayFaceCache))
        disposeFaceMeshCache(displayFaceCache);
      displayFaceCache = prepared.displayCache;
      if (displayFaceCache) retainedDisplayCaches.add(displayFaceCache);
      // Clone only the wrapper: geometry is immutable throughout conversion.
      // Placements and all boolean operations use non-destructive builders.
      source = ownConversionShape(prepared.source.clone());
      if (volumeCache.has(prepared.source)) volumeCache.set(source, volumeCache.get(prepared.source));
      if (signedVolumeCache.has(prepared.source)) signedVolumeCache.set(source, signedVolumeCache.get(prepared.source));
      if (boundsCache.has(prepared.source)) boundsCache.set(source, boundsCache.get(prepared.source));
    } else {
      preparedNativeDocuments.delete(resolvedPreparedId);
      prepared.localClip?.shape.delete();
      source = ownConversionShape(prepared.source);
      retainedDisplayCaches.delete(prepared.displayCache);
    }
    sourceCurveRepair = prepared.sourceCurveRepair;
    sourcePreparationMS = prepared.preparationMS;
    checkCancelled();
    onProgress('Using the prepared native CAD source…', { diagnostic: 'prepared-native-source', sourcePreparationMS });
  } else {
    if (documentId && !buffer && [...preparedNativeDocuments.values()].some(record => record.documentId === documentId))
      throw Error('The selected body has no prepared native source. Reload the model to select another body.');
    checkCancelled();
    onProgress('Opening native CAD…');
    const document = (documentId && takeNativeDocument(documentId)) ||
      (format === 'brep' || format === 'brp'
        ? castOwned(cad, oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
        : await cad.importSTEP(new Blob([buffer])));
    const bodies = ownedSolids(OC, cad, document).sort((a,b) => volume(b)-volume(a));
    source = bodies[bodyIndex];
    if (source) ownConversionShape(source);
    if (!source) {
      bodies.forEach(body => body.delete()); document.delete();
      throw Error('The selected native CAD solid was not found.');
    }
    bodies.forEach((body,index) => { if (index !== bodyIndex) body.delete(); });
    document.delete();
    const preparationStarted = performance.now();
    const prepared = await prepareNativeSource(source, onProgress);
    source = ownConversionShape(prepared.source);
    sourceCurveRepair = prepared.sourceCurveRepair;
    sourcePreparationMS = performance.now()-preparationStarted;
  }
  if (scale !== 1) {
    const previousVolume = volumeCache.get(source);
    const scaling = new oc.gp_Trsf(), origin = new oc.gp_Pnt(0, 0, 0);
    let builder;
    try {
      scaling.SetScale(origin, scale);
      builder = new oc.BRepBuilderAPI_Transform(source.wrapped, scaling, true, false);
      const scaled = ownConversionShape(castOwned(cad, builder.Shape()));
      source.delete();
      source = scaled;
    } finally {
      builder?.delete();
      origin.delete();
      scaling.delete();
    }
    if (previousVolume !== undefined)
      volumeCache.set(source, previousVolume * Math.abs(scale ** 3));
  }
  source = transform(oc, source, detection);
  // Result faces derive only from this source and native CAD tools. Those tools
  // carry no imported display data; any retained polygons came from our mesher.
  const generatedDisplayMesh = hasGeneratedDisplayMesh(source);
  const expected = detection.geometry.bounds;
  const placementKey = JSON.stringify([scale,detection.rotation,detection.translation]);
  const boundsKey = JSON.stringify([placementKey,expected]);
  const savedBounds = retainedRecord?.boundsProof;
  const sourceBoundsCheck = savedBounds?.key === boundsKey
    ? {...savedBounds.proof,reused:true,elapsedMS:0}
    : certifyNativeBoundsMatch(oc, source, expected, 0.1);
  let boundsMismatch = false;
  if (expected && !sourceBoundsCheck.matches) {
    const actual = exactBounds(source);
    boundsMismatch = actual.some((row, i) =>
      row.some((v, j) => Math.abs(v - (i ? expected.max : expected.min)[j]) > 0.1),
    );
    sourceBoundsCheck.method = 'optimal-bounds';
    sourceBoundsCheck.matches = !boundsMismatch;
  }
  if (retainedRecord && sourceBoundsCheck.matches)
    retainedRecord.boundsProof = {key:boundsKey,proof:{...sourceBoundsCheck}};
  checkCancelled();
  onProgress('Matching native CAD to the detected part…', {
    diagnostic: 'native-source-bounds',
    ...sourceBoundsCheck,
  });
  // The retained source is immutable. Reuse measurements only for this exact
  // scale and placement; a different document/body owns a different record.
  const volumeStarted = performance.now();
  const placementIsFinite = Number.isFinite(scale) && scale > 0 &&
    detection.rotation?.length === 9 && detection.translation?.length === 3 &&
    [...detection.rotation, ...detection.translation].every(Number.isFinite);
  const savedVolume = placementIsFinite ? retainedRecord?.sourceVolume : null;
  const reusedSourceVolume = savedVolume?.key === placementKey &&
    Number.isFinite(savedVolume.signed) && Number.isFinite(savedVolume.absolute) &&
    savedVolume.absolute === Math.abs(savedVolume.signed);
  if (reusedSourceVolume) {
    signedVolumeCache.set(source, savedVolume.signed);
    volumeCache.set(source, savedVolume.absolute);
  }
  const measuredSourceVolume = volume(source);
  const sourceVolumeCheck = {
    reused: Boolean(reusedSourceVolume),
    elapsedMS: performance.now() - volumeStarted,
    method: reusedSourceVolume ? 'retained-exact-placement' : 'native-volume',
  };
  if (
    boundsMismatch ||
    Math.abs(measuredSourceVolume - p.originalVolume) >
      Math.max(0.1, p.originalVolume * 0.005)
  )
    throw Error(
      'Native CAD part does not match the detected mesh part. Export the selected solid separately and retry.',
    );
  if (retainedRecord && placementIsFinite && Number.isFinite(measuredSourceVolume) &&
      Number.isFinite(signedVolumeCache.get(source))) {
    retainedRecord.sourceVolume = { key: placementKey, absolute: measuredSourceVolume,
      signed: signedVolumeCache.get(source) };
  }
  onProgress('Native source volume checked.', { diagnostic: 'native-source-volume', ...sourceVolumeCheck });
  checkCancelled();
  // Mesh detection uses float32 coordinates. Remove sub-tolerance noise before
  // native booleans so nominally coincident edges do not create sliver faces.
  // Source CAD curves and surfaces are unchanged; preservation is checked below.
  let nativeCoordinateAdjustmentMM = 0;
  p = {
    ...p,
    feet: p.feet.map((foot) => {
      const normalized = { ...foot };
      for (const key of ['x', 'y', 'sourceX', 'sourceY']) {
        if (foot[key] === undefined) continue;
        normalized[key] = Math.round(foot[key] * 100000) / 100000;
        nativeCoordinateAdjustmentMM = Math.max(
          nativeCoordinateAdjustmentMM,
          Math.abs(normalized[key] - foot[key]),
        );
      }
      return normalized;
    }),
  };
  const {
    feet,
    style,
    bottom,
    height,
    fit,
    magnetDiameter,
    magnetDepth,
    screwDiameter,
    minimumRoof: roof,
  } = p;
  let screwDepth = p.screwDepth;
  const maximumHoleDepth = Math.max(
    ['magnets','both'].includes(style) ? magnetDepth : 0,
    ['screws','both'].includes(style) ? screwDepth : 0,
  );
  const constructionCheckpoint = new Set(ownedShapes);
  let reusedLocalSource = false;
  const clipSource = (shape, box, bounds) => {
    const key = JSON.stringify([placementKey,bounds]);
    if (retainedRecord?.localClip?.key === key) {
      reusedLocalSource = true;
      return retainedRecord.localClip.shape.clone();
    }
    const clipped = intersect(shape,box);
    if (retainedRecord) {
      const retained = clipped.clone();
      retainedRecord.localClip?.shape.delete();
      retainedRecord.localClip = {key,shape:retained};
    }
    return clipped;
  };
  const localEdit = await prepareNativeLocalEdit({
    cad, source, feet, bottom, height, fit, roof, nativeFoot, checkCancelled,
    maximumHoleDepth, maximumHoleRadius: Math.max(magnetDiameter,screwDiameter)/2,
    cut, fuse, intersect, union, volume, clipSource, own: ownConversionShape, onProgress,
  });
  const holes = [], regions = [...localEdit.regions];
  const roofBody = localEdit.localPlain;
  let result;
  if (p.fitScrewDepth && ['screws', 'both'].includes(style)) {
    const fits = (depth) =>
      feet.every((f) =>
        [-13, 13].every((dx) =>
          [-13, 13].every((dy) => {
            const cover = nativeCylinder(screwDiameter / 2, roof, [
              f.x + dx,
              f.y + dy,
              bottom + depth,
            ]);
            let missing;
            try {
              missing = cut(cover, roofBody);
              return volume(missing) <= Math.max(0.001, volume(cover) * 0.001);
            } finally {
              missing?.delete();
              cover.delete();
            }
          }),
        ),
      );
    if (!fits(screwDepth)) {
      let candidate = Math.floor((screwDepth - 0.001) * 10) / 10;
      while (candidate >= 2 && !fits(candidate)) {
        checkCancelled();
        onProgress(`Fitting native screw depth: ${candidate.toFixed(1)} mm…`);
        candidate = Math.round((candidate - 0.1) * 10) / 10;
      }
      if (candidate < 2)
        throw Error(
          'No screw depth of at least 2 mm fits with the requested solid roof. Choose plain feet or magnets.',
        );
      screwDepth = candidate;
    }
    p = { ...p, screwDepth };
  }
  for (const f of feet)
    for (const dx of [-13, 13])
      for (const dy of [-13, 13]) {
        const dims = [];
        if (['magnets', 'both'].includes(style))
          dims.push([magnetDiameter / 2, magnetDepth]);
        if (['screws', 'both'].includes(style))
          dims.push([screwDiameter / 2, screwDepth]);
        for (const [radius, depth] of dims) {
          const hole = nativeCylinder(radius, depth + 0.02, [
            f.x + dx,
            f.y + dy,
            bottom - 0.02,
          ]);
          holes.push(hole);
          regions.push(hole);
        }
      }
  let roofIndex = 0;
  for (const f of feet)
    for (const dx of [-13, 13])
      for (const dy of [-13, 13]) {
        const dims = [];
        if (['magnets', 'both'].includes(style))
          dims.push([magnetDiameter / 2, magnetDepth]);
        if (['screws', 'both'].includes(style))
          dims.push([screwDiameter / 2, screwDepth]);
        for (const [radius, depth] of dims) {
          checkCancelled();
          onProgress(`Checking hole roof ${++roofIndex} of ${holes.length}…`);
          const cover = nativeCylinder(radius, roof, [
            f.x + dx,
            f.y + dy,
            bottom + depth,
          ]);
          let missing;
          try {
            missing = cut(cover, roofBody);
            if (volume(missing) > Math.max(0.001, volume(cover) * 0.001))
              throw Error(
                'Native CAD hole would break through its solid roof.',
              );
          } finally {
            missing?.delete();
            cover.delete();
          }
        }
      }
  checkCancelled();
  onProgress('Replacing native CAD feet and hardware…');
  result = localEdit.assemble(holes.length ? union(holes) : null);
  // Materialize the preservation mask before retiring its individual tools.
  const allowed = union(regions);
  const constructionRelease = releaseConstructionShapes(constructionCheckpoint,
    new Set([result, allowed, localEdit.localSource, localEdit.editBox]));
  checkCancelled();
  onProgress('Checking native CAD holes and solid validity…', {
    diagnostic: 'native-construction-release', ...constructionRelease,
    wasmMemoryMetric: 'linear-memory-capacity-not-live-allocation',
    wasmCapacityBytes: oc.wasmMemory.buffer.byteLength,
  });
  // The candidate is immutable; booleans below use non-destructive inputs.
  // Capture failures immediately because this worker's exact checks are synchronous.
  let sourceCertificate, parallelBrep, parallelBrepReport, candidateSnapshot, primarySnapshot, primaryStartedAtMS, primaryExactValidation;
  try {
    if (nativeExportPreference === 'brep' && validateBrepCandidate) {
      candidateSnapshot = nativeGeometryCopy(oc, result);
      const candidateText = candidateSnapshot.serialize();
      const expectedVolume = volume(result);
      const candidateTask = validateBrepCandidate({ candidateText, expectedVolume });
      parallelBrep = Promise.resolve(candidateTask)
        .then(value => ({ value }), error => ({ error }));
      // A nested worker may not finish starting until this worker yields.
      // Await its kernel-ready acknowledgement before entering synchronous checks.
      if (candidateTask?.ready) await waitForCancellation(candidateTask.ready);
    }
    primaryStartedAtMS = Date.now();
    const exactStarted = performance.now(), capacityBefore = oc.wasmMemory.buffer.byteLength;
    let exactSucceeded = false, primaryCopyElapsedMS = 0, primaryCopyMethod = !generatedDisplayMesh ? 'original-result' : topologyCopyPrimary && !oc.nativeTopologyCopyWithoutMesh ? 'missing-helper-deep-fallback' : candidateSnapshot ? 'existing-deep-snapshot' : 'fresh-deep-copy';
    checkCancelled();
    onProgress('Checking exact result geometry…', {
      diagnostic: 'native-validation', meshFreeDisplayCopy: generatedDisplayMesh, primaryStartedAtMS,
      wasmMemoryMetric: 'linear-memory-capacity-not-live-allocation', wasmCapacityBeforeBytes: capacityBefore,
    });
    try {
      if (topologyCopyPrimary && generatedDisplayMesh && oc.nativeTopologyCopyWithoutMesh) {
        const copyStarted = performance.now();
        const raw = oc.nativeTopologyCopyWithoutMesh(result.wrapped);
        if (raw.IsNull()) { raw.delete(); primaryCopyMethod = 'unsupported-deep-fallback'; }
        else { primarySnapshot = castOwned(cad, raw); primaryCopyMethod = 'topology-only'; }
        primaryCopyElapsedMS = performance.now() - copyStarted;
      }
      if (!(generatedDisplayMesh ? (primarySnapshot ? valid(oc, primarySnapshot) : candidateSnapshot ? valid(oc, candidateSnapshot) : validateNativeGeometryWithoutDisplay(oc, result)) : valid(oc, result)) || solidCount(result) !== 1 || volume(result) <= 0)
        throw Error('Native CAD result is not one valid solid. Export blocked.');
      exactSucceeded = true;
    } finally {
      primaryExactValidation = { copyMethod: primaryCopyMethod, copyElapsedMS: primaryCopyElapsedMS, elapsedMS: performance.now() - exactStarted, startedAtMS: primaryStartedAtMS, finishedAtMS: Date.now(), passed: exactSucceeded,
        wasmMemoryMetric: 'linear-memory-capacity-not-live-allocation', wasmCapacityBeforeBytes: capacityBefore, wasmCapacityAfterBytes: oc.wasmMemory.buffer.byteLength };
      onProgress('Exact result geometry check finished.', { diagnostic: 'native-validation-complete', ...primaryExactValidation });
    }
  } finally { try { primarySnapshot?.delete(); } finally { candidateSnapshot?.delete(); } }
  checkCancelled();
  onProgress('Preparing the exact edit region…');
  // The shared convex box contains every allowed tool and every roof probe.
  const editBox = localEdit.editBox;
  checkCancelled();
  onProgress('Checking preserved CAD boundary faces…');
  const preservationProof = proveNativePreservation({
    oc, cad, source, result, editBox, cut, validatedSolids: true,
    sourceSignedVolume: signedVolumeCache.get(source),
    resultSignedVolume: signedVolumeCache.get(result),
  });
  let added, removed;
  if (preservationProof.proved) {
    checkCancelled();
    onProgress('Measuring changes within the local CAD region…');
    const localSource = localEdit.localSource;
    const localResult = intersect(result, editBox);
    try {
      added = cut(localResult, localSource);
      removed = cut(localSource, localResult);
    } finally { localSource.delete(); localResult.delete(); }
  } else {
    checkCancelled();
    onProgress('Checking preserved CAD geometry with full solid differences…');
    added = cut(result, source);
    removed = cut(source, result);
  }
  editBox.delete();
  checkCancelled();
  onProgress('Checking material changes outside the allowed edit…');
  const outsideAdded = volume(cut(added, allowed));
  const outsideChange = outsideAdded + volume(cut(removed, allowed));
  if (outsideChange > Math.max(0.001, volume(source) * 1e-8))
    throw Error(
      'Native CAD preservation check failed: ' + outsideChange + ' mm³.',
    );
  const primaryFinishedAtMS = Date.now();
  const { checkedStep, checkedBrep } = createNativeExportChecks(oc, {
    preferPreservedCurves: Boolean(sourceCurveRepair), onProgress,
  });
  const identicalPoses = nativePosesIdentical(detection);
  const restored = identicalPoses ? result : deferOriginalPose ? null : transform(oc, result, detection, true);
  let stepExport, sourceExport, brep, sourceBrep, stepExportError;
  if (nativeExportPreference === 'brep') {
    if (parallelBrep) {
      const outcome = await waitForCancellation(parallelBrep);
      if (outcome.error) throw outcome.error;
      parallelBrepReport = { ...outcome.value?.report, primaryStartedAtMS, primaryFinishedAtMS, fallbackRequired: Boolean(outcome.value?.fallbackRequired) };
      checkCancelled();
      onProgress('Parallel native BREP export validation complete.', { diagnostic: 'parallel-brep', ...parallelBrepReport });
      if (outcome.value?.fallbackRequired) brep = checkedBrep(result, 'base-down');
      else if (outcome.value?.buffer instanceof ArrayBuffer) { brep = outcome.value.buffer; sourceCertificate = outcome.value.sourceCertificate; }
      else throw Error('Parallel native BREP validation returned no validated export.');
    } else brep = checkedBrep(result, 'base-down');
    sourceBrep = identicalPoses ? brep : deferOriginalPose ? undefined : checkedBrep(restored, 'original-pose');
  } else try {
    stepExport = await checkedStep(result, 'base-down');
    sourceExport = identicalPoses ? stepExport : deferOriginalPose ? null : await checkedStep(restored, 'original-pose');
  } catch (error) {
    if (error instanceof WebAssembly.RuntimeError || !/exported STEP fails strict|STEP export changed/.test(error.message))
      throw error;
    stepExportError = error.message;
    stepExport = sourceExport = null;
    // BREP stores the kernel's native curves and topology without STEP
    // translation. It must independently survive serialization and reopening.

    brep = checkedBrep(result, 'base-down');
    sourceBrep = identicalPoses ? brep : deferOriginalPose ? undefined : checkedBrep(restored, 'original-pose');
  }
  checkCancelled();
  onProgress('Preparing CAD preview…');
  const geometry = await tessellateNative(result, 1000000, { label: 'converted body', onProgress, initialDeflection: fastDisplay ? 0.1 : 0.01, useFaceCache: fastDisplay });
  const addedMesh = await tessellateNative(added, 1000000, { label: 'added material', onProgress, initialDeflection: fastDisplay ? 0.1 : 0.01 });
  const removedMesh = await tessellateNative(removed, 1000000, { label: 'removed material', onProgress, initialDeflection: fastDisplay ? 0.1 : 0.01 });
  checkCancelled();
  return {
    nativeDocumentId: retainedRecord?.documentId,
    geometry,
    added: addedMesh,
    removed: removedMesh,
    step: stepExport?.buffer,
    sourceStep: sourceExport?.buffer,
    brep,
    sourceBrep,
    sourceCertificate, // Private trusted worker result; never report/import metadata.
    originalPoseExport: {
      deferred: deferOriginalPose && !identicalPoses,
      transform: { rotation: Array.from(detection.rotation), translation: Array.from(detection.translation) },
      preferredSurfaceCurves: stepExport?.surfaceCurves,
    },
    report: {
      ...p,
      originalVolume: volume(source),
      convertedVolume: volume(result),
      addedVolume: volume(added),
      removedVolume: volume(removed),
      outsideChange,
      nativeEditMethod: 'local-hardware-algebra',
      nativeLifetime: lifetime,
      constructionRelease,
      reusedLocalSource,
      preservationMethod: preservationProof.proved ? preservationProof.method : 'full-solid-difference',
      preservationProof,
      representation: 'native-brep',
      nativeKernel: nativeKernelInfo(oc),
      nativeBooleanToleranceMM: 0.00001,
      sourceCurveRepair,
      sourcePreparationMS,
      usedPreparedSource: Boolean(resolvedPreparedId),
      sourceBoundsCheck,
      sourceVolumeCheck,
      nativeCoordinateResolutionMM: 0.00001,
      nativeCoordinateAdjustmentMM,
      nativeValid: true,
      nativeExportFormat: stepExport ? 'step' : 'brep',
      stepRoundTripValid: Boolean(stepExport),
      brepRoundTripValid: Boolean(brep),
      stepExportError,
      stepExportDeferred: nativeExportPreference === 'brep',
      parallelBrepValidation: parallelBrepReport,
      primaryExactValidation,
      originalPoseExportReused: identicalPoses,
      originalPoseExportDeferred: deferOriginalPose && !identicalPoses,
      stepSurfaceCurves: stepExport?.surfaceCurves,
      sourceStepSurfaceCurves: sourceExport?.surfaceCurves,
      connectedSolids: 1,
      displayOnlyMesh: fastDisplay,
      displayMeshDeflectionMM: geometry.tessellationDeflectionMM,
      meshTessellation: {
        converted: geometry.tessellation,
        added: addedMesh.tessellation,
        removed: removedMesh.tessellation,
      },
      tessellationDeflectionMM: Math.max(
        geometry.tessellationDeflectionMM,
        addedMesh.tessellationDeflectionMM,
        removedMesh.tessellationDeflectionMM,
      ),
    },
  };
  } finally {
    try { for (const shape of ownedShapes) shape.delete(); }
    finally {
    conversionShapes = null;
    if (retainedRecord) {
      if (displayFaceCache && displayFaceCache !== retainedRecord.displayCache && !retainedDisplayCaches.has(displayFaceCache))
        disposeFaceMeshCache(displayFaceCache);
      displayFaceCache = retainedRecord.displayCache;
    }
    lifetime.afterCleanup = memoryStats();
  }
  }
}

/** Bounds-only companion: same source bytes, pose and pinned verifier as export. */
export async function computeNativeSourceBounds({buffer,pose}) {
 const started=performance.now(),identity=await boundsInputIdentity(buffer,pose);
 const oc=await kernel('step-export-verifier'),kernelMS=performance.now()-started;
 let source,restored;try{
  const t=performance.now();source=castOwned(cad,oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)));const readMS=performance.now()-t;
  restored=nativePosesIdentical(pose)?source:transform(oc,source,pose,true);
  const b=performance.now(),bounds=verifierExactBounds(oc,restored.wrapped);
  return {identity,kernelSHA256:BOUNDS_KERNELS[nativeKernelInfo(oc).engine],bounds,timings:{kernelMS,readMS,boundsMS:performance.now()-b,totalMS:performance.now()-started},capacityBytes:oc.wasmMemory.buffer.byteLength};
 }finally{if(restored&&restored!==source)restored.delete();source?.delete();}
}
