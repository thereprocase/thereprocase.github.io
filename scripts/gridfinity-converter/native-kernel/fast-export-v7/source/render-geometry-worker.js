import { illustrationGeometry } from './render-geometry.js?v=fast-export-20261021-025000';
self.onmessage = ({ data: { id, vertices, triangles } }) => {
  try {
    const result = illustrationGeometry(vertices, triangles);
    self.postMessage({ id, ...result }, [
      result.normals.buffer,
      result.edges.buffer,
    ]);
  } catch (error) {
    self.postMessage({ id, error: error.message ?? String(error) });
  }
};
