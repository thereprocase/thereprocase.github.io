import { createFaceMeshCache, disposeFaceMeshCache, cacheMatchesSource, isRigidMatrix, transformFaceMeshCache, meshWithFaceCache } from './native-mesh-cache.js?v=native-local-20261020-1';
import { prepareNativeLocalEdit } from './native-local-edit.js?v=native-local-20261020-1';
import { certifyNativeBoundsMatch } from './native-bounds-match.js?v=native-local-20261020-1';
import { preservedRepairGeometry } from './repair-signature.js?v=native-local-20261020-1';
import { proveNativePreservation } from './native-preservation.js?v=native-local-20261020-1';
import { equivalentBrepTokens } from './brep-equivalence.js?v=native-local-20261020-1';
/** Preserve STEP/BREP boundary representations; meshes are display/export derivatives. */
import initOC from './vendor/replicad/replicad_single.js';
import * as cad from './vendor/replicad/replicad.js';
let ready, OC;
let displayFaceCache = null;
const retainedDisplayCaches = new Set();
let conversionShapes = null;
function ownConversionShape(shape) {
  conversionShapes?.add(shape);
  return shape;
}
const nativeBox = (...args) => ownConversionShape(cad.makeBox(...args));
const nativeCylinder = (...args) => ownConversionShape(cad.makeCylinder(...args));
function disposePreparedDocuments() {
  for (const record of preparedNativeDocuments.values()) {
    record.source.delete();
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
async function kernel() {
  if (!ready)
    ready = initOC().then((oc) => {
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
      ? cad.cast(oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
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
          const vertices = new Float32Array(
            oc.wasmMemory.buffer,
            raw.getVerticesPtr(),
            raw.getVerticesSize(),
          ).slice();
          const indices = new Uint32Array(
            oc.wasmMemory.buffer,
            raw.getTrianglesPtr(),
            raw.getTrianglesSize(),
          ).slice();
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
    op.SetFuzzyValue(0.00001);
    op.Build();
    if (!op.IsDone())
      throw Error(`Native CAD ${kind} operation did not finish.`);
    return ownConversionShape(cad.cast(op.Shape()));
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
  const solids = shape.solids;
  try { return solids.length; }
  finally { for (const solid of solids) solid.delete(); }
}
function valid(oc, s) {
  const c = new oc.BRepCheck_Analyzer(s.wrapped, true, false, true);
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
    try { out = cad.cast(builder.Shape()); } finally { builder.delete(); }
    const previousCache = displayFaceCache;
    displayFaceCache = null;
    try {
      displayFaceCache = transformFaceMeshCache(oc, previousCache, out, r, t);
      displayFaceCache.nativeGeneratedMesh = previousCache.nativeGeneratedMesh === true;
    }
    catch { /* Cache mismatch falls back to fresh display meshing. */ }
    finally { if (!retainedDisplayCaches.has(previousCache)) disposeFaceMeshCache(previousCache); }
  } else out = cad.cast(tf.transform(s.wrapped));
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
      } catch (error) { cacheFallback = error.message; }
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
        const vertices = new Float32Array(oc.wasmMemory.buffer, raw.getVerticesPtr(), raw.getVerticesSize()).slice();
        const indices = new Uint32Array(oc.wasmMemory.buffer, raw.getTrianglesPtr(), raw.getTrianglesSize()).slice();
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

function createNativeExportChecks(oc, { preferPreservedCurves = false, onProgress = () => {} } = {}) {
  // Validate the serialized file, not only the in-memory boolean result.
  const serializeAndCheck = async (shape, mode) => {
    // Validate both supported representations of optional surface curves.
    const previousMode = oc.Interface_Static.IVal('write.surfacecurve.mode');
    let blob;
    try {
      oc.Interface_Static.SetIVal('write.surfacecurve.mode', mode);
      blob = await shape.blobSTEP();
    } finally {
      oc.Interface_Static.SetIVal('write.surfacecurve.mode', previousMode);
    }
    const reopened = await cad.importSTEP(blob);
    try {
      if (!valid(oc, reopened) || solidCount(reopened) !== 1)
        throw Error(
          'The exported STEP fails strict CAD validation when reopened. Export blocked; this geometry is not currently supported for native export.',
        );
      const changed = Math.abs(volume(shape) - volume(reopened));
      const expectedBox = shape.boundingBox;
      const actualBox = reopened.boundingBox;
      const boundsChanged = expectedBox.bounds.some((row, i) =>
        row.some(
          (value, j) => Math.abs(value - actualBox.bounds[i][j]) > 0.00001,
        ),
      );
      expectedBox.delete();
      actualBox.delete();
      if (boundsChanged || changed > Math.max(0.001, volume(shape) * 1e-8))
        throw Error(
          'STEP export changed the solid geometry when reopened. Export blocked.',
        );
      return await blob.arrayBuffer();
    } finally {
      reopened.delete();
    }
  };
  const checkedStep = async (shape, label) => {
    // Repaired sources need their corrected pcurves retained when possible.
    // Some other shapes serialize more reliably with reconstructed pcurves.
    const modes = preferPreservedCurves ? [1, 0] : [0, 1];
    let failure;
    for (const mode of modes) {
      const surfaceCurves = mode ? 'preserved' : 'reconstructed-on-import';
      onProgress(`Validating ${label} STEP (${surfaceCurves} surface curves)…`);
      try {
        return { buffer: await serializeAndCheck(shape, mode), surfaceCurves };
      } catch (error) {
        if (
          !/exported STEP fails strict|STEP export changed/.test(error.message)
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
    const reopened = cad.cast(oc.BRepToolsWrapper.Read(text));
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
export async function warmNativeBrepValidator() { await kernel(); }
export async function validateNativeBrepCandidate({ candidateText, expectedVolume, onProgress = () => {}, onReady = () => {} }) {
  if (typeof candidateText !== 'string' || !candidateText.length || !Number.isFinite(expectedVolume) || expectedVolume <= 0)
    throw Error('Native BREP candidate requires geometry and a positive expected volume.');
  const oc = await kernel();
  const started = performance.now(), startedAtMS = Date.now();
  onReady({ startedAtMS });
  onProgress('Validating native BREP export in parallel…');
  const reopened = cad.cast(oc.BRepToolsWrapper.Read(candidateText));
  try {
    if (!valid(oc, reopened) || solidCount(reopened) !== 1)
      throw Error('Native BREP export fails validation when reopened.');
    const actualVolume = volume(reopened);
    if (!Number.isFinite(actualVolume) || Math.abs(expectedVolume - actualVolume) > Math.max(0.001, expectedVolume * 1e-8))
      throw Error('Native BREP export changed the solid geometry when reopened.');
    const equivalent = equivalentBrepTokens(candidateText, reopened.serialize());
    const report = { validationMS: performance.now() - started, startedAtMS, finishedAtMS: Date.now(), equivalence: equivalent };
    if (!equivalent.equivalent) return { fallbackRequired: true, report };
    return { buffer: new TextEncoder().encode(candidateText).buffer, report };
  } finally { reopened.delete(); }
}
/** Mesh a validated native export on demand, independently of its display mesh. */
export async function nativeMeshExport({ buffer, format, onProgress = () => {}, displayOnly = false }) {
  const oc = await kernel();
  onProgress('Opening native geometry for mesh export…');
  const source = format === 'brep' || format === 'brp'
    ? cad.cast(oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
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
  requestedFormat = format, preferredSurfaceCurves, onProgress = () => {} }) {
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
  const oc = await kernel();
  const source = format === 'brep'
    ? cad.cast(oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
    : await cad.importSTEP(new Blob([buffer]));
  let restored;
  try {
    onProgress('Checking the native export before restoring its pose…');
    if (!valid(oc, source) || solidCount(source) !== 1 || !(cad.measureVolume(source) > 0))
      throw Error('Original-pose export requires one valid positive native solid.');
    const identical = nativePosesIdentical(pose);
    if (identical && requestedFormat === format) return { buffer, format, report: {
      pose: 'original', nativeValid: true, nativeExportFormat: format,
      stepRoundTripValid: format === 'step', brepRoundTripValid: format === 'brep',
      originalPoseExportReused: true,
    } };
    restored = identical ? source : transform(oc, source, pose, true);
    const { checkedStep, checkedBrep } = createNativeExportChecks(oc, {
      preferPreservedCurves: preferredSurfaceCurves === 'preserved', onProgress,
    });
    let bytes, outputFormat = requestedFormat, stepExportError, surfaceCurves;
    if (requestedFormat === 'step') {
      try {
        const exported = await checkedStep(restored, 'original-pose');
        bytes = exported.buffer; surfaceCurves = exported.surfaceCurves;
      } catch (error) {
        if (!/exported STEP fails strict|STEP export changed/.test(error.message)) throw error;
        stepExportError = error.message;
        outputFormat = 'brep';
      }
    }
    if (outputFormat === 'brep') bytes = checkedBrep(restored, 'original-pose');
    return { buffer: bytes, format: outputFormat, report: {
      pose: 'original', nativeValid: true, nativeExportFormat: outputFormat,
      stepRoundTripValid: outputFormat === 'step', brepRoundTripValid: outputFormat === 'brep',
      stepExportError, stepSurfaceCurves: surfaceCurves, originalPoseExportReused: false,
    } };
  } finally { if (restored !== source) restored?.delete(); source.delete(); }
}
/** Snapshot native geometry without clearing preview triangles on shared faces. */
function nativeGeometryCopy(oc, source) {
  const identity = new oc.gp_Trsf();
  const builder = new oc.BRepBuilderAPI_Transform(source.wrapped, identity, true, false);
  try { return cad.cast(builder.Shape()); }
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
  onProgress('Preparing native curve consistency…');
  const beforeVolume = volume(source);
  const beforeRepresentation = nativeGeometrySnapshot(oc, source);
  const maxTolerance = shape => Math.max(
    oc.BRep_Tool.MaxTolerance(shape.wrapped, oc.TopAbs_ShapeEnum.TopAbs_EDGE),
    oc.BRep_Tool.MaxTolerance(shape.wrapped, oc.TopAbs_ShapeEnum.TopAbs_VERTEX),
  );
  const beforeTolerance = maxTolerance(source);
  let original = null;
  const originalShape = () => original ??= cad.cast(oc.BRepToolsWrapper.Read(beforeRepresentation));
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
  const bodies = document.solids.sort((a,b) => volume(b)-volume(a));
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
export async function convertNative({
  buffer,
  preparedDocumentId,
  documentId,
  retainDocument = false,
  fastDisplay = false,
  deferOriginalPose = false,
  nativeExportPreference = 'auto',
  validateBrepCandidate,
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
      source = ownConversionShape(prepared.source);
      retainedDisplayCaches.delete(prepared.displayCache);
    }
    sourceCurveRepair = prepared.sourceCurveRepair;
    sourcePreparationMS = prepared.preparationMS;
    onProgress('Using the prepared native CAD source…', { diagnostic: 'prepared-native-source', sourcePreparationMS });
  } else {
    if (documentId && !buffer && [...preparedNativeDocuments.values()].some(record => record.documentId === documentId))
      throw Error('The selected body has no prepared native source. Reload the model to select another body.');
    onProgress('Opening native CAD…');
    const document = (documentId && takeNativeDocument(documentId)) ||
      (format === 'brep' || format === 'brp'
        ? cad.cast(oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
        : await cad.importSTEP(new Blob([buffer])));
    const bodies = document.solids.sort((a,b) => volume(b)-volume(a));
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
    source = ownConversionShape(source.scale(scale));
    if (previousVolume !== undefined)
      volumeCache.set(source, previousVolume * Math.abs(scale ** 3));
  }
  source = transform(oc, source, detection);
  // Result faces derive only from this source and native CAD tools. Those tools
  // carry no imported display data; any retained polygons came from our mesher.
  const generatedDisplayMesh = hasGeneratedDisplayMesh(source);
  const expected = detection.geometry.bounds;
  const sourceBoundsCheck = certifyNativeBoundsMatch(oc, source, expected, 0.1);
  let boundsMismatch = false;
  if (expected && !sourceBoundsCheck.matches) {
    const actual = exactBounds(source);
    boundsMismatch = actual.some((row, i) =>
      row.some((v, j) => Math.abs(v - (i ? expected.max : expected.min)[j]) > 0.1),
    );
    sourceBoundsCheck.method = 'optimal-bounds';
    sourceBoundsCheck.matches = !boundsMismatch;
  }
  onProgress('Matching native CAD to the detected part…', {
    diagnostic: 'native-source-bounds',
    ...sourceBoundsCheck,
  });
  if (
    boundsMismatch ||
    Math.abs(volume(source) - p.originalVolume) >
      Math.max(0.1, p.originalVolume * 0.005)
  )
    throw Error(
      'Native CAD part does not match the detected mesh part. Export the selected solid separately and retry.',
    );
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
  const localEdit = await prepareNativeLocalEdit({
    cad, source, feet, bottom, height, fit, roof, nativeFoot,
    maximumHoleDepth, maximumHoleRadius: Math.max(magnetDiameter,screwDiameter)/2,
    cut, fuse, intersect, union, volume, own: ownConversionShape, onProgress,
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
  onProgress('Replacing native CAD feet and hardware…');
  result = localEdit.assemble(holes.length ? union(holes) : null);
  onProgress('Checking native CAD holes and solid validity…');
  // The candidate is immutable; booleans below use non-destructive inputs.
  // Capture failures immediately because this worker's exact checks are synchronous.
  let parallelBrep, parallelBrepReport, candidateSnapshot, primaryStartedAtMS;
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
      if (candidateTask?.ready) await candidateTask.ready;
    }
    primaryStartedAtMS = Date.now();
    onProgress('Checking exact result geometry…', {
      diagnostic: 'native-validation', meshFreeDisplayCopy: generatedDisplayMesh, primaryStartedAtMS,
    });
    if (!(generatedDisplayMesh ? (candidateSnapshot ? valid(oc, candidateSnapshot) : validateNativeGeometryWithoutDisplay(oc, result)) : valid(oc, result)) || solidCount(result) !== 1 || volume(result) <= 0)
      throw Error('Native CAD result is not one valid solid. Export blocked.');
  } finally { candidateSnapshot?.delete(); }
  onProgress('Preparing the exact edit region…');
  const allowed = union(regions);
  // The shared convex box contains every allowed tool and every roof probe.
  const editBox = localEdit.editBox;
  onProgress('Checking preserved CAD boundary faces…');
  const preservationProof = proveNativePreservation({
    oc, cad, source, result, editBox, cut, validatedSolids: true,
    sourceSignedVolume: signedVolumeCache.get(source),
    resultSignedVolume: signedVolumeCache.get(result),
  });
  let added, removed;
  if (preservationProof.proved) {
    onProgress('Measuring changes within the local CAD region…');
    const localSource = localEdit.localSource;
    const localResult = intersect(result, editBox);
    try {
      added = cut(localResult, localSource);
      removed = cut(localSource, localResult);
    } finally { localSource.delete(); localResult.delete(); }
  } else {
    onProgress('Checking preserved CAD geometry with full solid differences…');
    added = cut(result, source);
    removed = cut(source, result);
  }
  editBox.delete();
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
      const outcome = await parallelBrep;
      if (outcome.error) throw outcome.error;
      parallelBrepReport = { ...outcome.value?.report, primaryStartedAtMS, primaryFinishedAtMS, fallbackRequired: Boolean(outcome.value?.fallbackRequired) };
      onProgress('Parallel native BREP export validation complete.', { diagnostic: 'parallel-brep', ...parallelBrepReport });
      if (outcome.value?.fallbackRequired) brep = checkedBrep(result, 'base-down');
      else if (outcome.value?.buffer instanceof ArrayBuffer) brep = outcome.value.buffer;
      else throw Error('Parallel native BREP validation returned no validated export.');
    } else brep = checkedBrep(result, 'base-down');
    sourceBrep = identicalPoses ? brep : deferOriginalPose ? undefined : checkedBrep(restored, 'original-pose');
  } else try {
    stepExport = await checkedStep(result, 'base-down');
    sourceExport = identicalPoses ? stepExport : deferOriginalPose ? null : await checkedStep(restored, 'original-pose');
  } catch (error) {
    if (!/exported STEP fails strict|STEP export changed/.test(error.message))
      throw error;
    stepExportError = error.message;
    stepExport = sourceExport = null;
    // BREP stores the kernel's native curves and topology without STEP
    // translation. It must independently survive serialization and reopening.

    brep = checkedBrep(result, 'base-down');
    sourceBrep = identicalPoses ? brep : deferOriginalPose ? undefined : checkedBrep(restored, 'original-pose');
  }
  onProgress('Preparing CAD preview…');
  const geometry = await tessellateNative(result, 1000000, { label: 'converted body', onProgress, initialDeflection: fastDisplay ? 0.1 : 0.01, useFaceCache: fastDisplay });
  const addedMesh = await tessellateNative(added, 1000000, { label: 'added material', onProgress, initialDeflection: fastDisplay ? 0.1 : 0.01 });
  const removedMesh = await tessellateNative(removed, 1000000, { label: 'removed material', onProgress, initialDeflection: fastDisplay ? 0.1 : 0.01 });
  return {
    nativeDocumentId: retainedRecord?.documentId,
    geometry,
    added: addedMesh,
    removed: removedMesh,
    step: stepExport?.buffer,
    sourceStep: sourceExport?.buffer,
    brep,
    sourceBrep,
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
      preservationMethod: preservationProof.proved ? preservationProof.method : 'full-solid-difference',
      preservationProof,
      representation: 'native-brep',
      nativeBooleanToleranceMM: 0.00001,
      sourceCurveRepair,
      sourcePreparationMS,
      usedPreparedSource: Boolean(resolvedPreparedId),
      sourceBoundsCheck,
      nativeCoordinateResolutionMM: 0.00001,
      nativeCoordinateAdjustmentMM,
      nativeValid: true,
      nativeExportFormat: stepExport ? 'step' : 'brep',
      stepRoundTripValid: Boolean(stepExport),
      brepRoundTripValid: Boolean(brep),
      stepExportError,
      stepExportDeferred: nativeExportPreference === 'brep',
      parallelBrepValidation: parallelBrepReport,
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
  }
  }
}
