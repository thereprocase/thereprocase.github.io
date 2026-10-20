import { convertNative } from './native-cad.js?v=cad-consistency-1';
import Module from '../gridfinity-shelves/vendor/manifold.js';
import { importSolid, meshData, checkMesh } from './kernel.js?v=step-audit-1';
self.onmessage = async ({ data }) => {
  try {
    const result = await convertNative({
        ...data,
        onProgress: (progress) => self.postMessage({ progress }),
      }),
      m = await Module();
    m.setup();
    const { bodies } = importSolid(m, result.geometry);
    if (bodies.length !== 1) throw Error('CAD display mesh is disconnected.');
    result.geometry = meshData(bodies[0]);
    checkMesh(result.geometry);
    bodies.forEach((b) => b.delete());
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
    self.postMessage({ result }, [...transfers]);
  } catch (e) {
    self.postMessage({ error: e.message ?? String(e) });
  }
};
