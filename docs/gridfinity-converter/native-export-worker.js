import { startParallelSourceBounds } from './native-parallel-source-bounds.js?v=native-step-20261021-1';
import { exportNativeOriginalPose } from './native-cad.js?v=native-step-20261021-1';
self.onmessage = async ({ data }) => {
  const started=performance.now();
  let stage = 'Preparing native export';
  const onProgress = (progress, progressInfo) => {
    stage = progress;
    self.postMessage({ progress, progressInfo, totalMS:performance.now()-started });
  };
  let boundsTask;
  try {
    if(data.type==='pose'&&data.format==='brep'&&data.requestedFormat==='step') boundsTask=startParallelSourceBounds(data,onProgress);
    let result;
    if (data.type === 'pose') result = await exportNativeOriginalPose({ ...data, sourceBoundsTask:boundsTask?.result, onProgress });
    else if (data.type === 'mesh') {
      const { runNativeMeshExport } = await import('./native-mesh-export.js?v=native-step-20261021-1');
      result = await runNativeMeshExport({ ...data, onProgress });
    } else throw Error('Unknown native export request.');
    const transfers = new Set();
    if (result.buffer instanceof ArrayBuffer) transfers.add(result.buffer);
    if (result.geometry) {
      transfers.add(result.geometry.vertices.buffer);
      transfers.add(result.geometry.triangles.buffer);
    }
    self.postMessage({ result, totalMS:performance.now()-started }, [...transfers]);
  } catch (error) {
    self.postMessage({ error: error.message ?? String(error), stage,
      stack: error.stack, errorName: error.name });
  } finally { boundsTask?.cancel(); }
};
