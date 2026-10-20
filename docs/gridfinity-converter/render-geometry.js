/** Presentation-only adjacency. Positions and source triangle indices are unchanged. */
export function illustrationGeometry(vertices, triangles) {
  const count = vertices.length / 3;
  const ids = new Uint32Array(count),
    positions = new Map();
  for (let i = 0; i < count; i++) {
    const p = i * 3;
    const key = `${Math.round(vertices[p] * 1e4)},${Math.round(vertices[p + 1] * 1e4)},${Math.round(vertices[p + 2] * 1e4)}`;
    let id = positions.get(key);
    if (id === undefined) {
      id = positions.size;
      positions.set(key, id);
    }
    ids[i] = id;
  }
  const stride = positions.size;
  if (!Number.isSafeInteger(stride * stride))
    throw Error('Presentation mesh exceeds adjacency capacity.');
  positions.clear();
  const sums = new Float64Array(stride * 3);
  const faceNormals = new Float32Array(triangles.length);
  const keys = new Float64Array(triangles.length);
  const order = new Uint32Array(triangles.length);
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3,
      b = triangles[i + 1] * 3,
      c = triangles[i + 2] * 3;
    const ux = vertices[b] - vertices[a],
      uy = vertices[b + 1] - vertices[a + 1],
      uz = vertices[b + 2] - vertices[a + 2];
    const vx = vertices[c] - vertices[a],
      vy = vertices[c + 1] - vertices[a + 1],
      vz = vertices[c + 2] - vertices[a + 2];
    const x = uy * vz - uz * vy,
      y = uz * vx - ux * vz,
      z = ux * vy - uy * vx;
    const length = Math.hypot(x, y, z) || 1;
    faceNormals[i] = x / length;
    faceNormals[i + 1] = y / length;
    faceNormals[i + 2] = z / length;
    for (let j = 0; j < 3; j++) {
      const from = ids[triangles[i + j]],
        to = ids[triangles[i + ((j + 1) % 3)]];
      sums[from * 3] += x;
      sums[from * 3 + 1] += y;
      sums[from * 3 + 2] += z;
      keys[i + j] = Math.min(from, to) * stride + Math.max(from, to);
      order[i + j] = i + j;
    }
  }
  const normals = new Float32Array(vertices.length);
  for (let i = 0; i < count; i++) {
    const p = ids[i] * 3;
    const length = Math.hypot(sums[p], sums[p + 1], sums[p + 2]) || 1;
    normals[i * 3] = sums[p] / length;
    normals[i * 3 + 1] = sums[p + 1] / length;
    normals[i * 3 + 2] = sums[p + 2] / length;
  }
  order.sort((a, b) => keys[a] - keys[b]);
  const selected = [];
  const crease = Math.cos(Math.PI / 6);
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    while (end < order.length && keys[order[end]] === keys[order[start]]) end++;
    const first = order[start];
    let sharp = end - start !== 2;
    if (!sharp) {
      const a = first - (first % 3),
        other = order[start + 1],
        b = other - (other % 3);
      sharp =
        faceNormals[a] * faceNormals[b] +
          faceNormals[a + 1] * faceNormals[b + 1] +
          faceNormals[a + 2] * faceNormals[b + 2] <
        crease;
    }
    const base = first - (first % 3);
    const a = triangles[first],
      b = triangles[base + (((first % 3) + 1) % 3)];
    if (sharp && ids[a] !== ids[b]) selected.push(a, b);
    start = end;
  }
  const edges = new Float32Array(selected.length * 3);
  selected.forEach((vertex, i) =>
    edges.set(vertices.subarray(vertex * 3, vertex * 3 + 3), i * 3),
  );
  return { normals, edges };
}
