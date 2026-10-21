import { checkMesh } from './kernel.js?v=native-step-20261021-2';

/** The same exact-coordinate, opposite-edge check as checkMesh, with packed
 * numeric edges instead of repeated coordinate strings for every half-edge. */
export function checkNativeDisplayMesh(data) {
  checkMesh(data, false);
  const { vertices, triangles } = data;
  const ids = new Uint32Array(vertices.length / 3);
  const coordinates = new Map();
  for (let i = 0; i < ids.length; i++) {
    const p = i * 3;
    const key = `${vertices[p]},${vertices[p + 1]},${vertices[p + 2]}`;
    let id = coordinates.get(key);
    if (id === undefined) {
      id = coordinates.size;
      coordinates.set(key, id);
    }
    ids[i] = id;
  }
  const stride = coordinates.size;
  // Keep the packed integer exactly representable, even for unusual arrays
  // containing many unused vertices. The general checker remains the fallback.
  if (!Number.isSafeInteger(2 * stride * stride)) return checkMesh(data);
  const edges = new Float64Array(triangles.length);
  for (let i = 0; i < triangles.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = ids[triangles[i + j]];
      const b = ids[triangles[i + ((j + 1) % 3)]];
      if (a === b) throw Error('The exported mesh has a collapsed edge.');
      edges[i + j] = a < b ? 2 * (a * stride + b) : 2 * (b * stride + a) + 1;
    }
  }
  edges.sort();
  for (let i = 0; i < edges.length; i += 2) {
    if (edges[i] % 2 || edges[i + 1] !== edges[i] + 1 ||
        (i > 0 && edges[i] === edges[i - 2])) {
      throw Error('Mesh is not closed with consistent face winding. Repair the source mesh before converting.');
    }
  }
}
