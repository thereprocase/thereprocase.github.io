/** Optional display-only cache. Native exports never use these buffers. */
const HASH_MAX = 2147483647;
const hash = (oc, face) => oc.ReplicadShapeHasher.HashCode(face, HASH_MAX);
function walkFaces(oc, shape, visit) {
  const ex = new oc.TopExp_Explorer(
    shape.wrapped,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  try {
    while (ex.More()) {
      const current = ex.Current();
      const face = oc.TopoDS.Face(current);
      current.delete();
      try {
        visit(face);
      } finally {
        face.delete();
      }
      ex.Next();
    }
  } finally {
    ex.delete();
  }
}
export function disposeFaceMeshCache(cache) {
  if (!cache) return;
  for (const entries of cache.faces.values())
    for (const entry of entries) {
      entry.face.delete();
      entry.mesh.delete();
    }
  cache.faces.clear();
  cache.shapes.forEach((shape) => shape.delete());
  cache.shapes.length = 0;
}
export function createFaceMeshCache(oc, shape, geometry, tolerance, angle) {
  const cache = {
    faces: new Map(),
    shapes: [shape.wrapped.clone()],
    vertices: geometry.vertices.slice(),
    triangles: geometry.triangles.slice(),
    tolerance,
    angle,
  };
  let vi = 0,
    ti = 0;
  try {
    const solids = new oc.TopExp_Explorer(
      shape.wrapped,
      oc.TopAbs_ShapeEnum.TopAbs_SOLID,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    try {
      while (solids.More()) {
        cache.shapes.push(solids.Current());
        solids.Next();
      }
    } finally {
      solids.delete();
    }
    walkFaces(oc, shape, (face) => {
      const location = new oc.TopLoc_Location();
      let mesh;
      try {
        mesh = oc.BRep_Tool.Triangulation(face, location, 0);
      } finally {
        location.delete();
      }
      if (!mesh) throw Error('Unmeshed source face.');
      const n = mesh.NbNodes(),
        t = mesh.NbTriangles(),
        key = hash(oc, face);
      if (!cache.faces.has(key)) cache.faces.set(key, []);
      cache.faces
        .get(key)
        .push({
          face: face.clone(),
          mesh,
          n,
          t,
          vi,
          ti,
          deflection: mesh.Deflection(),
        });
      vi += n * 3;
      ti += t * 3;
    });
    if (vi !== cache.vertices.length || ti !== cache.triangles.length)
      throw Error('Source mesh cache counts differ.');
    return cache;
  } catch (error) {
    disposeFaceMeshCache(cache);
    throw error;
  }
}
export function cacheMatchesSource(cache, shape) {
  return Boolean(cache?.shapes.some((source) => source.IsSame(shape.wrapped)));
}
export function isRigidMatrix(r, t) {
  if (
    !Array.isArray(r) ||
    r.length !== 9 ||
    !Array.isArray(t) ||
    t.length !== 3 ||
    [...r, ...t].some((v) => !Number.isFinite(v))
  )
    return false;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let dot = 0;
      for (let k = 0; k < 3; k++) dot += r[i * 3 + k] * r[j * 3 + k];
      if (Math.abs(dot - (i === j ? 1 : 0)) > 1e-12) return false;
    }
  const det =
    r[0] * (r[4] * r[8] - r[5] * r[7]) -
    r[1] * (r[3] * r[8] - r[5] * r[6]) +
    r[2] * (r[3] * r[7] - r[4] * r[6]);
  return Math.abs(det - 1) < 1e-12;
}
export function transformFaceMeshCache(oc, cache, shape, r, t) {
  const vertices = new Float32Array(cache.vertices.length);
  for (let i = 0; i < vertices.length; i += 3) {
    const x = cache.vertices[i],
      y = cache.vertices[i + 1],
      z = cache.vertices[i + 2];
    for (let k = 0; k < 3; k++)
      vertices[i + k] =
        r[k * 3] * x + r[k * 3 + 1] * y + r[k * 3 + 2] * z + t[k];
  }
  return createFaceMeshCache(
    oc,
    shape,
    { vertices, triangles: cache.triangles },
    cache.tolerance,
    cache.angle,
  );
}
/** Throws on a cache mismatch; caller must use the ordinary fresh mesher. */
export function meshWithFaceCache(oc, shape, cache, tolerance, angle, budget) {
  if (!cache || cache.tolerance !== tolerance || cache.angle !== angle)
    throw Error('Display mesh cache parameters differ.');
  const started = performance.now();
  const mesher = new oc.BRepMesh_IncrementalMesh(
    shape.wrapped,
    tolerance,
    false,
    angle,
    false,
  );
  mesher.delete();
  const records = [];
  let nodes = 0,
    triangles = 0,
    reusedFaces = 0;
  try {
    walkFaces(oc, shape, (face) => {
      const location = new oc.TopLoc_Location();
      let mesh, tf;
      try {
        mesh = oc.BRep_Tool.Triangulation(face, location, 0);
        if (!mesh) throw Error('Unmeshed result face.');
        const n = mesh.NbNodes(),
          t = mesh.NbTriangles();
        const cached = (cache.faces.get(hash(oc, face)) || []).find(
          (old) =>
            face.IsSame(old.face) &&
            face.Orientation() === old.face.Orientation() &&
            mesh.isAliasOf(old.mesh) &&
            n === old.n &&
            t === old.t &&
            mesh.Deflection() === old.deflection,
        );
        // IsSame includes the face location. A matching cache already stores
        // transformed vertices and winding, so its matrix is never consumed.
        let matrix, reverse;
        if (!cached) {
          tf = location.Transformation();
          matrix = [];
          for (let r = 1; r <= 3; r++)
            for (let c = 1; c <= 4; c++) matrix.push(tf.Value(r, c));
          const m = matrix;
          const det =
            m[0] * (m[5] * m[10] - m[6] * m[9]) -
            m[1] * (m[4] * m[10] - m[6] * m[8]) +
            m[2] * (m[4] * m[9] - m[5] * m[8]);
          reverse = (face.Orientation() === oc.TopAbs_Orientation.TopAbs_REVERSED) !== det < 0;
        }
        records.push({
          mesh,
          matrix,
          n,
          t,
          cached,
          reverse,
        });
        mesh = null;
        nodes += n;
        triangles += t;
        if (cached) reusedFaces++;
      } finally {
        mesh?.delete();
        tf?.delete();
        location.delete();
      }
    });
    if (!reusedFaces || triangles > budget)
      throw Error(
        'Display mesh cache has no reusable faces or exceeds its budget.',
      );
    const vertices = new Float32Array(nodes * 3),
      indices = new Uint32Array(triangles * 3);
    let vi = 0,
      ti = 0;
    for (const { mesh, matrix: m, n, t, cached, reverse } of records) {
      const base = vi / 3;
      if (cached) {
        vertices.set(cache.vertices.subarray(cached.vi, cached.vi + n * 3), vi);
        vi += n * 3;
        for (let j = cached.ti; j < cached.ti + t * 3; j++)
          indices[ti++] = cache.triangles[j] - cached.vi / 3 + base;
        continue;
      }
      for (let i = 1; i <= n; i++) {
        const p = mesh.Node(i);
        try {
          const x = p.X(),
            y = p.Y(),
            z = p.Z();
          vertices[vi++] = m[0] * x + m[1] * y + m[2] * z + m[3];
          vertices[vi++] = m[4] * x + m[5] * y + m[6] * z + m[7];
          vertices[vi++] = m[8] * x + m[9] * y + m[10] * z + m[11];
        } finally {
          p.delete();
        }
      }
      for (let i = 1; i <= t; i++) {
        const p = mesh.Triangle(i);
        try {
          const a = p.Value(1) - 1 + base,
            b = p.Value(2) - 1 + base,
            c = p.Value(3) - 1 + base;
          indices[ti++] = a;
          indices[ti++] = reverse ? c : b;
          indices[ti++] = reverse ? b : c;
        } finally {
          p.delete();
        }
      }
    }
    return {
      vertices,
      triangles: indices,
      reusedFaces,
      changedFaces: records.length - reusedFaces,
      elapsedMS: performance.now() - started,
    };
  } finally {
    records.forEach((record) => record.mesh.delete());
  }
}
