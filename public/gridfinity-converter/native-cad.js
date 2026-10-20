/** Preserve STEP/BREP boundary representations; meshes are display/export derivatives. */
import initOC from './vendor/replicad/replicad_single.js';
import * as cad from './vendor/replicad/replicad.js';
let ready, OC;
async function kernel() {
  if (!ready)
    ready = initOC().then((oc) => {
      OC = oc;
      cad.setOC(oc);
      return oc;
    });
  return ready;
}
function volume(s) {
  return s.isNull ? 0 : Math.abs(cad.measureVolume(s));
}
function boolean(kind, a, b) {
  const op = new OC['BRepAlgoAPI_' + kind](a.wrapped, b.wrapped);
  try {
    op.SetFuzzyValue(0.00001);
    op.Build();
    return cad.cast(op.Shape());
  } finally {
    op.delete();
  }
}
const cut = (a, b) => boolean('Cut', a, b),
  fuse = (a, b) => boolean('Fuse', a, b),
  intersect = (a, b) => boolean('Common', a, b);
function union(shapes) {
  return shapes.reduce((a, b) => (a ? fuse(a, b) : b), null);
}
function valid(oc, s) {
  const c = new oc.BRepCheck_Analyzer(s.wrapped, true, false, true);
  try {
    return c.IsValid();
  } finally {
    c.delete();
  }
}
function transform(oc, s, d, inverse = false) {
  const r = d.rotation,
    t = d.translation,
    tr = new oc.gp_Trsf();
  tr.SetValues(
    r[0],
    r[1],
    r[2],
    t[0],
    r[3],
    r[4],
    r[5],
    t[1],
    r[6],
    r[7],
    r[8],
    t[2],
  );
  const tf = new cad.Transformation(tr);
  if (inverse) tf.inverse();
  const out = cad.cast(tf.transform(s.wrapped));
  tf.delete();
  return out;
}
export async function nativeFoot(
  x = 0,
  y = 0,
  bottom = 0,
  height = 4.75,
  fit = 0,
) {
  await kernel();
  const sections = [
    [0, 35.6, 0.8],
    [0.8, 37.2, 1.6],
    [2.6, 37.2, 1.6],
    [4.75, 41.5, 3.75],
  ];
  if (height > 4.75) sections.push([height, 41.5, 3.75]);
  const sketches = sections.map(([z, w, r]) =>
    cad
      .drawRoundedRectangle(w + 2 * fit, w + 2 * fit, r + fit)
      .sketchOnPlane('XY', [x, y, bottom + z]),
  );
  return sketches[0].loftWith(sketches.slice(1), { ruled: true });
}
export async function tessellateNative(shape, triangleBudget = 1000000) {
  const oc = await kernel();
  const levels = [
    [0.01, 0.1],
    [0.025, 0.15],
    [0.05, 0.25],
    [0.1, 0.35],
    [0.2, 0.5],
    [0.4, 0.65],
    [0.8, 0.8],
  ];
  for (const [index, [tolerance, angularTolerance]] of levels.entries()) {
    // Discard only cached triangles, never CAD curves or surfaces.
    if (index) oc.BRepTools.Clean(shape.wrapped, false);
    const mesh = shape.mesh({ tolerance, angularTolerance });
    if (mesh.triangles.length / 3 <= triangleBudget)
      return {
        vertices: new Float32Array(mesh.vertices),
        triangles: new Uint32Array(mesh.triangles),
        volume: volume(shape),
        tessellationDeflectionMM: tolerance,
      };
  }
  throw Error(
    'The CAD result exceeds browser mesh capacity after automatic preview adaptation.',
  );
}
export async function convertNative({
  buffer,
  format,
  scale = 1,
  bodyIndex = 0,
  detection,
  options: p,
  onProgress = () => {},
}) {
  onProgress('Opening native CAD…');
  const oc = await kernel();
  let source =
    format === 'brep' || format === 'brp'
      ? cad.cast(oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
      : await cad.importSTEP(new Blob([buffer]));
  const bodies = source.solids.sort((a, b) => volume(b) - volume(a));
  if (!bodies[bodyIndex])
    throw Error('The selected native CAD solid was not found.');
  source = bodies[bodyIndex];
  // Conversion only uses the selected solid. Unrelated assembly parts must
  // not invalidate a sound selected part.
  if (!valid(oc, source))
    throw Error(
      'The selected CAD solid fails strict boundary-representation validation. Repair it in the source modeler.',
    );
  if (scale !== 1) source.scale(scale);
  source = transform(oc, source, detection);
  const bounds = source.boundingBox,
    actual = bounds.bounds,
    expected = detection.geometry.bounds;
  bounds.delete();
  if (
    (expected &&
      actual.some((row, i) =>
        row.some(
          (v, j) => Math.abs(v - (i ? expected.max : expected.min)[j]) > 0.1,
        ),
      )) ||
    Math.abs(volume(source) - p.originalVolume) >
      Math.max(0.1, p.originalVolume * 0.005)
  )
    throw Error(
      'Native CAD part does not match the detected mesh part. Export the selected solid separately and retry.',
    );
  const {
    feet,
    style,
    bottom,
    height,
    fit,
    magnetDiameter,
    magnetDepth,
    screwDiameter,
    screwDepth,
    minimumRoof: roof,
  } = p;
  const cuts = [],
    newFeet = [],
    holes = [],
    regions = [];
  for (const [index, f] of feet.entries()) {
    onProgress(`Checking attachment ${index + 1} of ${feet.length}…`);
    const sx = f.sourceX ?? f.x,
      sy = f.sourceY ?? f.y,
      lo = [
        Math.min(sx, f.x) - 20.99,
        Math.min(sy, f.y) - 20.99,
        bottom - 0.02,
      ],
      hi = [
        Math.max(sx, f.x) + 20.99,
        Math.max(sy, f.y) + 20.99,
        bottom + height,
      ],
      cut = cad.makeBox(lo, hi),
      foot = await nativeFoot(f.x, f.y, bottom, height + 0.02, fit);
    cuts.push(cut);
    newFeet.push(foot);
    regions.push(cut, foot);
    const seamSlice = cad.makeBox(
      [f.x - 21, f.y - 21, bottom + height],
      [f.x + 21, f.y + 21, bottom + height + 0.02],
    );
    // Clip the source to the narrow seam band first, so contact booleans
    // do not repeatedly process the entire foot profile and tool cavities.
    const contact = intersect(intersect(source, seamSlice), foot);
    if (volume(contact) < 0.02)
      throw Error(
        'Native CAD foot has no substantial contact with the part at the seam.',
      );
    for (const dx of [-13, 13])
      for (const dy of [-13, 13]) {
        const dims = [];
        if (['magnets', 'both'].includes(style))
          dims.push([magnetDiameter / 2, magnetDepth]);
        if (['screws', 'both'].includes(style))
          dims.push([screwDiameter / 2, screwDepth]);
        for (const [radius, depth] of dims) {
          const h = cad.makeCylinder(radius, depth + 0.02, [
            f.x + dx,
            f.y + dy,
            bottom - 0.02,
          ]);
          holes.push(h);
          regions.push(h);
        }
      }
  }
  onProgress('Replacing native CAD feet…');
  let result = fuse(cut(source, union(cuts)), union(newFeet));
  for (const f of feet)
    for (const dx of [-13, 13])
      for (const dy of [-13, 13]) {
        const dims = [];
        if (['magnets', 'both'].includes(style))
          dims.push([magnetDiameter / 2, magnetDepth]);
        if (['screws', 'both'].includes(style))
          dims.push([screwDiameter / 2, screwDepth]);
        for (const [radius, depth] of dims) {
          const cover = cad.makeCylinder(radius, roof, [
            f.x + dx,
            f.y + dy,
            bottom + depth,
          ]);
          if (
            volume(cut(cover, result)) > Math.max(0.001, volume(cover) * 0.001)
          )
            throw Error('Native CAD hole would break through its solid roof.');
        }
      }
  onProgress('Checking native CAD holes and solid validity…');
  if (holes.length) result = cut(result, union(holes));
  if (!valid(oc, result) || result.solids.length !== 1 || volume(result) <= 0)
    throw Error('Native CAD result is not one valid solid. Export blocked.');
  onProgress('Checking preserved CAD geometry…');
  const added = cut(result, source),
    removed = cut(source, result),
    allowed = union(regions),
    outsideChange = volume(cut(added, allowed)) + volume(cut(removed, allowed));
  if (outsideChange > Math.max(0.001, volume(source) * 1e-8))
    throw Error(
      'Native CAD preservation check failed: ' + outsideChange + ' mm³.',
    );
  // Validate the serialized file, not only the in-memory boolean result.
  const checkedStep = async (shape) => {
    // Keep native 3D curves/surfaces. Let the reader reconstruct optional
    // pcurves; serialized pcurves can fail exact checks after STEP rounding.
    const previousMode = oc.Interface_Static.IVal('write.surfacecurve.mode');
    let blob;
    try {
      oc.Interface_Static.SetIVal('write.surfacecurve.mode', 0);
      blob = await shape.blobSTEP();
    } finally {
      oc.Interface_Static.SetIVal('write.surfacecurve.mode', previousMode);
    }
    const reopened = await cad.importSTEP(blob);
    try {
      if (!valid(oc, reopened) || reopened.solids.length !== 1)
        throw Error(
          'The exported STEP fails strict CAD validation when reopened. Export blocked; this geometry is not currently supported for native export.',
        );
      const changed = Math.abs(volume(shape) - volume(reopened));
      const expectedBox = shape.boundingBox;
      const actualBox = reopened.boundingBox;
      const boundsChanged = expectedBox.bounds.some((row, i) =>
        row.some(
          (value, j) => Math.abs(value - actualBox.bounds[i][j]) > 0.00001,
        ),
      );
      expectedBox.delete();
      actualBox.delete();
      if (boundsChanged || changed > Math.max(0.001, volume(shape) * 1e-8))
        throw Error(
          'STEP export changed the solid geometry when reopened. Export blocked.',
        );
      return await blob.arrayBuffer();
    } finally {
      reopened.delete();
    }
  };
  onProgress('Validating exported STEP files…');
  const step = await checkedStep(result),
    restored = transform(oc, result, detection, true),
    sourceStep = await checkedStep(restored);
  onProgress('Preparing CAD preview…');
  const geometry = await tessellateNative(result);
  const addedMesh = await tessellateNative(added);
  const removedMesh = await tessellateNative(removed);
  return {
    geometry,
    added: addedMesh,
    removed: removedMesh,
    step,
    sourceStep,
    report: {
      ...p,
      originalVolume: volume(source),
      convertedVolume: volume(result),
      addedVolume: volume(added),
      removedVolume: volume(removed),
      outsideChange,
      representation: 'native-brep',
      nativeBooleanToleranceMM: 0.00001,
      nativeValid: true,
      stepRoundTripValid: true,
      stepSurfaceCurves: 'reconstructed-on-import',
      connectedSolids: 1,
      tessellationDeflectionMM: Math.max(
        geometry.tessellationDeflectionMM,
        addedMesh.tessellationDeflectionMM,
        removedMesh.tessellationDeflectionMM,
      ),
    },
  };
}
