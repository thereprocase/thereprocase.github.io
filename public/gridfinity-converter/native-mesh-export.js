import { nativeMeshExport } from './native-cad.js?v=female-bases-20261021-3';
import Module from '../gridfinity-shelves/vendor/manifold.js';
import { importSolid, meshData, checkMesh } from './kernel.js?v=female-bases-20261021-3';
/** Build the original-quality export mesh and independently check connectivity. */
export async function runNativeMeshExport(data) {
  const result = await nativeMeshExport(data);
  data.onProgress?.('Checking the export mesh…');
  const m = await Module();
  m.setup();
  const { bodies } = importSolid(m, result.geometry);
  try {
    if (bodies.length !== 1) throw Error('CAD export mesh is disconnected.');
    result.geometry = meshData(bodies[0]);
    checkMesh(result.geometry);
    result.report.closedMesh = true;
    return result;
  } finally { bodies.forEach(body => body.delete()); }
}
