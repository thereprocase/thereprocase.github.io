import { exportNativeOriginalPose } from './native-cad.js?v=native-local-20261020-1';
self.onmessage = async ({ data }) => {
  let stage = 'Preparing native export';
  const onProgress = (progress, progressInfo) => {
    stage = progress;
    self.postMessage({ progress, progressInfo });
  };
  try {
    let result;
    if (data.type === 'pose') result = await exportNativeOriginalPose({ ...data, onProgress });
    else if (data.type === 'mesh') {
      const { runNativeMeshExport } = await import('./native-mesh-export.js?v=native-local-20261020-1');
      result = await runNativeMeshExport({ ...data, onProgress });
    } else throw Error('Unknown native export request.');
    const transfers = new Set();
    if (result.buffer instanceof ArrayBuffer) transfers.add(result.buffer);
    if (result.geometry) {
      transfers.add(result.geometry.vertices.buffer);
      transfers.add(result.geometry.triangles.buffer);
    }
    self.postMessage({ result }, [...transfers]);
  } catch (error) {
    self.postMessage({ error: error.message ?? String(error), stage,
      stack: error.stack, errorName: error.name });
  }
};
