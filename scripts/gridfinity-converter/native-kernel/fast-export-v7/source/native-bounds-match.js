/** Certify the six native extrema lie within the mesh-match tolerance.
 * Outer bounds enclose geometry; real vertex positions witness inner bounds.
 * A successful certificate replaces only the source/mesh matching heuristic,
 * never an exact bound or export-preservation calculation.
 */
export function extremaBracketMatches(
  outer,
  vertices,
  expected,
  tolerance = 0.1,
) {
  if (!expected || !(tolerance >= 0) || !Number.isFinite(tolerance))
    return false;
  const targets = [expected.min, expected.max];
  for (let axis = 0; axis < 3; axis++) {
    const values = [
      outer?.[0]?.[axis],
      outer?.[1]?.[axis],
      vertices?.[0]?.[axis],
      vertices?.[1]?.[axis],
      targets[0]?.[axis],
      targets[1]?.[axis],
    ];
    if (!values.every(Number.isFinite)) return false;
    const [lo, hi, vlo, vhi, wantLo, wantHi] = values;
    if (lo > vlo || vlo > vhi || vhi > hi || wantLo > wantHi) return false;
    if (
      lo < wantLo - tolerance ||
      vlo > wantLo + tolerance ||
      vhi < wantHi - tolerance ||
      hi > wantHi + tolerance
    )
      return false;
  }
  return true;
}
function readBounds(box) {
  const min = box.CornerMin(),
    max = box.CornerMax();
  try {
    return [
      [min.X(), min.Y(), min.Z()],
      [max.X(), max.Y(), max.Z()],
    ];
  } finally {
    min.delete();
    max.delete();
  }
}
function mergeBounds(into, bounds) {
  for (let a = 0; a < 3; a++) {
    into[0][a] = Math.min(into[0][a], bounds[0][a]);
    into[1][a] = Math.max(into[1][a], bounds[1][a]);
  }
}
const empty = () => [
  [Infinity, Infinity, Infinity],
  [-Infinity, -Infinity, -Infinity],
];
export function certifyNativeBoundsMatch(oc, shape, expected, tolerance = 0.1) {
  const started = performance.now(),
    outer = empty(),
    vertices = empty();
  let vertexTraversalComplete = true, uniqueVertexCount = 0;
  let faceCount = 0,
    refinedFaces = 0,
    vertexCount = 0;
  try {
    if (
      shape.wrapped.ShapeType().value !== oc.TopAbs_ShapeEnum.TopAbs_SOLID.value
    )
      throw Error('selected shape is not a solid');
    if (!expected || ![...expected.min, ...expected.max].every(Number.isFinite))
      throw Error('missing expected bounds');
    const faces = new oc.TopExp_Explorer(
      shape.wrapped,
      oc.TopAbs_ShapeEnum.TopAbs_FACE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    try {
      while (faces.More()) {
        const face = faces.Current(),
          box = new oc.Bnd_Box();
        try {
          oc.BRepBndLib.Add(face, box, false);
          let bounds = readBounds(box);
          const outside =
            bounds[0].some((v, i) => v < expected.min[i] - tolerance) ||
            bounds[1].some((v, i) => v > expected.max[i] + tolerance);
          if (outside) {
            if (refinedFaces >= 16) throw Error('too many loose face bounds');
            box.SetVoid();
            oc.BRepBndLib.AddOptimal(face, box, false, false);
            bounds = readBounds(box);
            refinedFaces++;
          }
          mergeBounds(outer, bounds);
          faceCount++;
        } finally {
          box.delete();
          face.delete();
        }
        faces.Next();
      }
    } finally {
      faces.delete();
    }
    const explorer = new oc.TopExp_Explorer(
      shape.wrapped,
      oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    const seenVertices = new Map();
    try {
      while (explorer.More()) {
        const raw = explorer.Current();
        let vertex, point, newWitness = false;
        try {
          vertexCount++;
          const hash = oc.ReplicadShapeHasher.HashCode(raw, 2147483647);
          const bucket = seenVertices.get(hash) || [];
          if (!bucket.some(previous => previous.IsSame(raw))) {
            bucket.push(raw.clone());
            seenVertices.set(hash, bucket);
            uniqueVertexCount++;
            vertex = oc.TopoDS.Vertex(raw);
            point = oc.BRep_Tool.Pnt(vertex);
            const xyz = [point.X(), point.Y(), point.Z()];
            mergeBounds(vertices, [xyz, xyz]);
            newWitness = true;
          }
        } finally {
          point?.delete();
          vertex?.delete();
          raw.delete();
        }
        // All faces have already supplied conservative outer bounds. Once
        // actual vertices witness all six extrema, visiting further vertices
        // cannot improve the required certificate for this validated solid.
        if (newWitness && extremaBracketMatches(outer, vertices, expected, tolerance)) {
          vertexTraversalComplete = false;
          break;
        }
        explorer.Next();
      }
    } finally {
      for (const bucket of seenVertices.values()) for (const vertex of bucket) vertex.delete();
      explorer.delete();
    }
    const matches =
      faceCount > 0 &&
      vertexCount > 0 &&
      extremaBracketMatches(outer, vertices, expected, tolerance);
    return {
      matches,
      method: 'conservative-face-and-vertex-extrema',
      faceCount,
      refinedFaces,
      vertexCount,
      vertexTraversalComplete,
      uniqueVertexCount,
      elapsedMS: performance.now() - started,
      reason: matches ? undefined : 'extrema not enclosed in match tolerance',
    };
  } catch (error) {
    if (error instanceof WebAssembly.RuntimeError) throw error;
    return {
      matches: false,
      reason: error.message,
      faceCount,
      refinedFaces,
      vertexCount,
      vertexTraversalComplete,
      uniqueVertexCount,
      elapsedMS: performance.now() - started,
    };
  }
}
