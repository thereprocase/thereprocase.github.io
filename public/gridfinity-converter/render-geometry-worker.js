import { illustrationGeometry } from './render-geometry.js?v=native-step-20261021-2';
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
