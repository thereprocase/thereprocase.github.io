import { startParallelSourceBounds, createSourceBoundsModuleWarmup } from './native-parallel-source-bounds.js?v=native-step-20261021-3';
import { exportNativeOriginalPose, warmNativeBrepValidator } from './native-cad.js?v=native-step-20261021-3';
let queue = Promise.resolve();
let consumed = false;
let boundsWarmup;
self.onmessage = ({ data }) => {
  queue = queue.then(() => handle(data)).catch(error => {
    boundsWarmup?.dispose();boundsWarmup=undefined;
    self.postMessage({ error: error.message ?? String(error), errorName: error.name });
  });
};
async function handle(data) {
  if (data?.type === 'warm') {
    if (consumed) throw Error('An export worker cannot be warmed after use.');
    const started = performance.now();
    boundsWarmup ??= createSourceBoundsModuleWarmup();
    await Promise.all([warmNativeBrepValidator({ certificateBounds: true }),boundsWarmup.ready]);
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
    if(data.type==='pose'&&data.format==='brep'&&data.requestedFormat==='step') {
      // Start independent engines together; keep the real child-start handshake.
      const startupStarted=performance.now();
      const mainReady=warmNativeBrepValidator({certificateBounds:true}).then(()=>performance.now()-startupStarted);
      const preparedWorker=boundsWarmup?.take();boundsWarmup?.dispose();boundsWarmup=undefined;
      boundsTask=startParallelSourceBounds(data,onProgress,{worker:preparedWorker});
      const [mainKernelMS]=await Promise.all([mainReady,boundsTask.started]);
      onProgress('STEP export engines ready…',{diagnostic:'step-export-startup',elapsedMS:performance.now()-startupStarted,mainKernelMS,boundsModulePrewarmed:Boolean(preparedWorker)});
    } else {boundsWarmup?.dispose();boundsWarmup=undefined;}
    let result;
    if (data.type === 'pose') result = await exportNativeOriginalPose({ ...data, sourceBoundsTask:boundsTask?.result, onProgress });
    else if (data.type === 'mesh') {
      const { runNativeMeshExport } = await import('./native-mesh-export.js?v=native-step-20261021-3');
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
  } finally { boundsTask?.cancel();boundsWarmup?.dispose();boundsWarmup=undefined; }
};
