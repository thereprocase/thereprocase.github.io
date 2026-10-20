import { convertNative } from './native-cad.js';
import Module from '../gridfinity-shelves/vendor/manifold.js';
import { importSolid, meshData, checkMesh } from './kernel.js';
self.onmessage = async ({ data }) => {
  try {
    const result = await convertNative(data),
      m = await Module();
    m.setup();
    const { bodies } = importSolid(m, result.geometry);
    if (bodies.length !== 1) throw Error('CAD display mesh is disconnected.');
    result.geometry = meshData(bodies[0]);
    checkMesh(result.geometry);
    bodies.forEach((b) => b.delete());
    result.report.closedMesh = true;
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({ error: e.message ?? String(e) });
  }
};
