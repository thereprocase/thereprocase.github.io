import { convertNative, nativeMeshExport, hasPreparedNativeDocument } from './native-cad.js?v=fast-export-20261021-025000';
import { createNativeCancellation } from './native-cancellation.js?v=fast-export-20261021-025000';
import Module from '../gridfinity-shelves/vendor/manifold.js';
import { importSolid, meshData } from './kernel.js?v=fast-export-20261021-025000';
import { checkNativeDisplayMesh } from './native-display-check.js?v=fast-export-20261021-025000';
let warmedValidator;
let displayModule;
function preparedDisplayModule() {
  return displayModule ??= Module().then(value => {
    value.setup();
    return { value };
  }).catch(error => ({ error }));
}
/** Start the child's module before source preparation, then compile concurrently. */
export function prewarmNativeBrepValidator() {
  if (warmedValidator) return warmedValidator.started;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  let child;
  try { child = new Worker(new URL('./native-brep-worker.js?v=fast-export-20261021-025000', import.meta.url), { type: 'module' }); }
  catch { markStarted(); return started; }
  const entry = { child, started, startedAtMS: Date.now(), warmedAtMS: undefined };
  warmedValidator = entry;
  child.onmessage = ({data}) => {
    if (data.warming) markStarted();
    if (data.warm) { entry.warmedAtMS = data.warmedAtMS; markStarted(); }
    if (data.error) fail();
  };
  const fail = () => { child.terminate(); if (warmedValidator === entry) warmedValidator = undefined; markStarted(); };
  child.onerror = fail;
  child.onmessageerror = fail;
  try { child.postMessage({type:'warm',issueCertificate:true}); } catch { fail(); }
  return started;
}
export async function runNativeConversion(data) {
  const post = (payload, transfers) => self.postMessage({ ...payload, requestId: data.requestId }, transfers);
  let stage = 'Starting native CAD conversion';
  const validators = new Set();
  const pendingValidators = new Set();
  const cancellation = createNativeCancellation(data.cancelBuffer,
    data.retainDocument && hasPreparedNativeDocument(data.documentId, data.bodyIndex ?? 0));
  let cancelled = false;
  let validationChildrenStopped = 0;
  // Compile the display validator while the native conversion is running.
  // Handle rejection immediately; it is rethrown when the module is needed.
  const modulePending = preparedDisplayModule();
  const validateBrepCandidate = candidate => {
    let markReady;
    const ready = new Promise(resolve => { markReady = resolve; });
    const task = new Promise((resolve, reject) => {
    const warmed = warmedValidator;
    warmedValidator = undefined;
    let child;
    try {
      child = warmed?.child || new Worker(new URL('./native-brep-worker.js?v=fast-export-20261021-025000', import.meta.url), { type: 'module' });
    } catch {
      markReady();
      resolve({ fallbackRequired: true });
      return;
    }
    const candidatePostedAtMS = Date.now();
    validators.add(child);
    const finish = () => { child.terminate(); validators.delete(child); pendingValidators.delete(stop); };
    const stop = () => { markReady(); finish(); reject(new DOMException('Validator cancelled', 'AbortError')); };
    pendingValidators.add(stop);
    child.onmessage = ({ data }) => {
      if (data.warming) return;
      if (data.warm) { if (warmed) warmed.warmedAtMS = data.warmedAtMS; return; }
      if (data.ready) { markReady(); return; }
      if (data.progress) return;
      markReady();
      finish();
      if (data.error) {
        const error = Error(data.error);
        if (data.stack) error.stack = data.stack;
        reject(error);
      } else {
        if (data.result?.report) Object.assign(data.result.report, { prewarmed: Boolean(warmed), candidatePostedAtMS, candidateStartupWaitMS: data.result.report.startedAtMS - candidatePostedAtMS, prewarmStartedAtMS: warmed?.startedAtMS, warmedAtMS: warmed?.warmedAtMS });
        resolve(data.result);
      }
    };
    child.onerror = () => {
      markReady();
      finish();
      // A worker startup/resource failure falls back to the same strict checks
      // in this worker; a reported geometry failure above remains an error.
      resolve({ fallbackRequired: true });
    };
    child.onmessageerror = child.onerror;
    try { child.postMessage({...candidate,issueCertificate:true}); }
    catch { markReady(); finish(); resolve({ fallbackRequired: true }); }
    });
    task.ready = ready;
    return task;
  };
  try {
    const result = await convertNative({
        ...data,
        topologyCopyPrimary: true,
        checkCancelled: cancellation.check,
        waitForCancellation: cancellation.wait,
        validateBrepCandidate,
        onProgress: (progress, progressInfo) => {
          stage = progress;
          post({ progress, progressInfo });
        },
      }),
      moduleResult = await cancellation.wait(modulePending);
    if (moduleResult.error) throw moduleResult.error;
    cancellation.check();
    const m = moduleResult.value;
    stage = 'Checking the CAD display mesh';
    post({ progress: stage });
    let bodies;
    try {
      ({ bodies } = importSolid(m, result.geometry));
      if (bodies.length !== 1) throw Error('CAD display mesh is disconnected.');
      const geometry = meshData(bodies[0]);
      checkNativeDisplayMesh(geometry);
      result.geometry = geometry;
    } catch (error) {
      bodies?.forEach((body) => body.delete());
      bodies = null;
      if (error instanceof WebAssembly.RuntimeError) throw error;
      if (!result.report.meshTessellation?.converted?.reusedFaces) throw error;
      stage = 'Rebuilding the CAD display mesh';
      post({ progress: stage });
      const fresh = await nativeMeshExport({
        buffer: result.brep || result.step,
        format: result.brep ? 'brep' : 'step',
        displayOnly: true,
        onProgress: (progress) => {
          stage = progress;
          post({ progress });
        },
      });
      ({ bodies } = importSolid(m, fresh.geometry));
      if (bodies.length !== 1) throw Error('CAD display mesh is disconnected.');
      result.geometry = meshData(bodies[0]);
      checkNativeDisplayMesh(result.geometry);
      result.report.displayCacheFallback = error.message;
      result.report.displayMeshDeflectionMM =
        fresh.report.tessellationDeflectionMM;
      result.report.tessellationDeflectionMM = Math.max(
        result.report.tessellationDeflectionMM,
        fresh.report.tessellationDeflectionMM,
      );
      result.report.meshTessellation.converted = fresh.report.meshTessellation;
    } finally {
      bodies?.forEach((body) => body.delete());
    }
    result.report.closedMesh = true;
    // Transfer large export and preview buffers instead of copying them into
    // the UI thread. The worker is finished with these arrays.
    const transfers = new Set();
    for (const mesh of [result.geometry, result.added, result.removed]) {
      transfers.add(mesh.vertices.buffer);
      transfers.add(mesh.triangles.buffer);
    }
    for (const bytes of [
      result.step,
      result.sourceStep,
      result.brep,
      result.sourceBrep,
    ])
      if (bytes) transfers.add(bytes);
    cancellation.check();
    post({ result }, [...transfers]);
  } catch (e) {
    if (cancellation.isCancellation(e)) cancelled = true;
    else post({
      error: e.message ?? String(e),
      stage,
      stack: e.stack,
      errorName: e.name,
    });
  } finally {
    validationChildrenStopped = validators.size;
    for (const stop of pendingValidators) stop();
    pendingValidators.clear();
    for (const child of validators) child.terminate();
    validators.clear();
    if (warmedValidator) { warmedValidator.child.terminate(); warmedValidator = undefined; }
  }
  // A native trap or any cleanup exception bypasses this acknowledgment.
  // The preview worker may subsequently warm a new validator for the next task;
  // clean means this cancelled task and its children have been retired.
  if (cancelled) {
    const clean = cancellation.enabled && hasPreparedNativeDocument(data.documentId, data.bodyIndex ?? 0);
    post({ cancelled: true, clean, nativeDocumentId: clean ? data.documentId : undefined,
      validationChildrenStopped, pendingValidationTasks: pendingValidators.size });
  }
}
