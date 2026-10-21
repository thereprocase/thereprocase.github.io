import { startParallelSourceBounds } from './native-parallel-source-bounds.js?v=native-step-20261021-2';
import { exportNativeOriginalPose, warmNativeBrepValidator } from './native-cad.js?v=native-step-20261021-2';
let queue = Promise.resolve();
let consumed = false;
self.onmessage = ({ data }) => {
  queue = queue.then(() => handle(data)).catch(error => {
    self.postMessage({ error: error.message ?? String(error), errorName: error.name });
  });
};
async function handle(data) {
  if (data?.type === 'warm') {
    if (consumed) throw Error('An export worker cannot be warmed after use.');
    const started = performance.now();
    await warmNativeBrepValidator({ certificateBounds: true });
    self.postMessage({ warm: true, elapsedMS: performance.now() - started });
    return;
  }
  if (consumed) throw Error('An export worker can only serve one export.');
  consumed = true;
  const started=performance.now();
  let stage = 'Preparing native export';
  const onProgress = (progress, progressInfo) => {
    stage = progress;
    self.postMessage({ progress, progressInfo, totalMS:performance.now()-started });
  };
  let boundsTask;
  try {
    if(data.type==='pose'&&data.format==='brep'&&data.requestedFormat==='step') boundsTask=startParallelSourceBounds(data,onProgress);
    if(boundsTask)await boundsTask.started;
    let result;
    if (data.type === 'pose') result = await exportNativeOriginalPose({ ...data, sourceBoundsTask:boundsTask?.result, onProgress });
    else if (data.type === 'mesh') {
      const { runNativeMeshExport } = await import('./native-mesh-export.js?v=native-step-20261021-2');
      result = await runNativeMeshExport({ ...data, onProgress });
    } else throw Error('Unknown native export request.');
    const transfers = new Set();
    if (result.buffer instanceof ArrayBuffer) transfers.add(result.buffer);
    if (result.geometry) {
      transfers.add(result.geometry.vertices.buffer);
      transfers.add(result.geometry.triangles.buffer);
    }
    boundsTask?.cancel();
    boundsTask = undefined;
    self.postMessage({ result, totalMS:performance.now()-started }, [...transfers]);
  } catch (error) {
    boundsTask?.cancel();
    boundsTask = undefined;
    self.postMessage({ error: error.message ?? String(error), stage,
      stack: error.stack, errorName: error.name });
  } finally { boundsTask?.cancel(); }
};
