/** Preserve STEP/BREP boundary representations; meshes are display/export derivatives. */
import initOC from './vendor/replicad/replicad_single.js';
import * as cad from './vendor/replicad/replicad.js';
let ready, OC;
const volumeCache = new WeakMap();
async function kernel() {
  if (!ready)
    ready = initOC().then((oc) => {
      OC = oc;
      cad.setOC(oc);
      return oc;
    });
  return ready;
}
export async function previewNative({
  buffer,
  format,
  previewTriangleBudget = 1000000,
  initialDeflection = 0.025,
  onProgress = () => {},
}) {
  const started = performance.now();
  onProgress('Loading the CAD engine…', { stage: 1, total: 5 });
  const oc = await kernel();
  const engineReadyMS = performance.now() - started;
  onProgress('Reading native CAD…', { stage: 2, total: 5 });
  const source =
    format === 'brep'
      ? cad.cast(oc.BRepToolsWrapper.Read(new TextDecoder().decode(buffer)))
      : await cad.importSTEP(new Blob([buffer]));
  try {
    const faces = source.faces;
    const faceCount = faces.length;
    faces.forEach((face) => face.delete());
    const levels = [
      [0.025, 0.15],
      [0.05, 0.25],
      [0.1, 0.35],
      [0.2, 0.5],
      [0.4, 0.65],
      [0.8, 0.8],
    ];
    let nextDeflection = initialDeflection,
      attempts = 0,
      previousTriangles;
    for (const [index, [deflection, angle]] of levels.entries()) {
      if (deflection < nextDeflection) continue;
      attempts++;
      onProgress(
        `Building preview from ${faceCount.toLocaleString()} CAD faces…`,
        {
          stage: 3,
          total: 5,
          detail:
            `Preview attempt ${attempts} · ${deflection} mm` +
            (previousTriangles
              ? ` · Previous attempt: ${previousTriangles.toLocaleString()} triangles; limit ${previewTriangleBudget.toLocaleString()}`
              : ''),
        },
      );
      if (index) oc.BRepTools.Clean(source.wrapped, false);
      // Mesh the same parsed CAD body on retries. Copy only the two buffers
      // actually used by detection/viewing, and only once an attempt fits.
      const raw = oc.ReplicadMeshExtractor.extract(
        source.wrapped,
        deflection,
        angle,
        false,
      );
      try {
        const triangles = raw.getTrianglesSize() / 3;
        if (triangles <= previewTriangleBudget) {
          const vertices = new Float32Array(
            oc.wasmMemory.buffer,
            raw.getVerticesPtr(),
            raw.getVerticesSize(),
          ).slice();
          const indices = new Uint32Array(
            oc.wasmMemory.buffer,
            raw.getTrianglesPtr(),
            raw.getTrianglesSize(),
          ).slice();
          onProgress('CAD preview ready.', {
            stage: 3,
            total: 5,
            detail: `${faceCount.toLocaleString()} faces · ${triangles.toLocaleString()} triangles · ${attempts} preview attempt${attempts === 1 ? '' : 's'}`,
          });
          return {
            result: {
              success: true,
              meshes: [
                {
                  attributes: { position: { array: vertices } },
                  index: { array: indices },
                },
              ],
            },
            preview: {
              deflectionMM: deflection,
              angularDeflection: angle,
              triangles,
              faces: faceCount,
              attempts,
              nativeReadCount: 1,
              adapted: index > 0,
              engineReadyMS,
              readAndMeshMS: performance.now() - started - engineReadyMS,
            },
          };
        }
        previousTriangles = triangles;
        nextDeflection = Math.min(
          0.8,
          (deflection * triangles) / previewTriangleBudget,
        );
      } finally {
        raw.delete();
      }
    }
    throw Error(
      'This CAD file exceeds browser preview capacity. The original CAD has not been changed.',
    );
  } finally {
    source.delete();
  }
}
function volume(s) {
  if (volumeCache.has(s)) return volumeCache.get(s);
  const measured = s.isNull ? 0 : Math.abs(cad.measureVolume(s));
  volumeCache.set(s, measured);
  return measured;
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
  // Orientation changes are rigid, so volume is invariant.
  if (volumeCache.has(s)) volumeCache.set(out, volumeCache.get(s));
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
  onProgress('Checking imported CAD curve consistency…');
  let sourceCurveRepair = null;
  if (!valid(oc, source)) {
    onProgress('Curve repair 1 of 3: measuring the original body…');
    const beforeVolume = volume(source);
    const beforeBox = source.boundingBox;
    const beforeBounds = beforeBox.bounds;
    beforeBox.delete();
    const edgeKind = oc.TopAbs_ShapeEnum.TopAbs_EDGE;
    const vertexKind = oc.TopAbs_ShapeEnum.TopAbs_VERTEX;
    const maxTolerance = () =>
      Math.max(
        oc.BRep_Tool.MaxTolerance(source.wrapped, edgeKind),
        oc.BRep_Tool.MaxTolerance(source.wrapped, vertexKind),
      );
    const beforeTolerance = maxTolerance();
    // Recompute 2D edge parameter curves against the existing 3D curves and
    // surfaces. This does not replace the source with a tessellation.
    onProgress('Curve repair 2 of 3: rebuilding edge parameters…');
    oc.BRepLib.SameParameter(source.wrapped, 0.00001, true);
    volumeCache.delete(source);
    const afterTolerance = maxTolerance();
    const afterBox = source.boundingBox;
    const afterBounds = afterBox.bounds;
    afterBox.delete();
    const boundsChanged = beforeBounds.some((row, i) =>
      row.some((v, j) => Math.abs(v - afterBounds[i][j]) > 0.00001),
    );
    onProgress('Curve repair 3 of 3: measuring the repaired body…');
    const volumeChange = Math.abs(volume(source) - beforeVolume);
    const repairFailure = boundsChanged
      ? 'its bounds changed'
      : volumeChange > Math.max(0.001, beforeVolume * 1e-8)
        ? `its volume changed by ${volumeChange.toPrecision(4)} mm³`
        : afterTolerance > Math.max(beforeTolerance, 0.00001) + 1e-7
          ? 'it would require looser edge tolerances'
          : null;
    if (repairFailure)
      throw Error(
        `Automatic CAD curve repair was rejected because ${repairFailure}. Conversion stopped.`,
      );
    onProgress('Validating repaired CAD curve consistency…');
    if (!valid(oc, source))
      throw Error(
        'The imported solid still fails strict CAD validation after automatic curve repair. Conversion stopped.',
      );
    sourceCurveRepair = {
      method: 'same-parameter',
      volumeChange,
      beforeToleranceMM: beforeTolerance,
      afterToleranceMM: afterTolerance,
      strictValid: true,
    };
  }
  if (scale !== 1) {
    const previousVolume = volumeCache.get(source);
    source = source.scale(scale);
    if (previousVolume !== undefined)
      volumeCache.set(source, previousVolume * Math.abs(scale ** 3));
  }
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
  // Mesh detection uses float32 coordinates. Remove sub-tolerance noise before
  // native booleans so nominally coincident edges do not create sliver faces.
  // Source CAD curves and surfaces are unchanged; preservation is checked below.
  let nativeCoordinateAdjustmentMM = 0;
  p = {
    ...p,
    feet: p.feet.map((foot) => {
      const normalized = { ...foot };
      for (const key of ['x', 'y', 'sourceX', 'sourceY']) {
        if (foot[key] === undefined) continue;
        normalized[key] = Math.round(foot[key] * 100000) / 100000;
        nativeCoordinateAdjustmentMM = Math.max(
          nativeCoordinateAdjustmentMM,
          Math.abs(normalized[key] - foot[key]),
        );
      }
      return normalized;
    }),
  };
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
  onProgress('Preservation check 1 of 5: finding added material…');
  const added = cut(result, source);
  onProgress('Preservation check 2 of 5: finding removed material…');
  const removed = cut(source, result);
  onProgress('Preservation check 3 of 5: combining edit regions…');
  const allowed = union(regions);
  onProgress(
    'Preservation check 4 of 5: measuring added material outside the edit…',
  );
  const outsideAdded = volume(cut(added, allowed));
  onProgress(
    'Preservation check 5 of 5: measuring removed material outside the edit…',
  );
  const outsideChange = outsideAdded + volume(cut(removed, allowed));
  if (outsideChange > Math.max(0.001, volume(source) * 1e-8))
    throw Error(
      'Native CAD preservation check failed: ' + outsideChange + ' mm³.',
    );
  // Validate the serialized file, not only the in-memory boolean result.
  const serializeAndCheck = async (shape, mode) => {
    // Validate both supported representations of optional surface curves.
    const previousMode = oc.Interface_Static.IVal('write.surfacecurve.mode');
    let blob;
    try {
      oc.Interface_Static.SetIVal('write.surfacecurve.mode', mode);
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
  const checkedStep = async (shape, label) => {
    // Repaired sources need their corrected pcurves retained when possible.
    // Some other shapes serialize more reliably with reconstructed pcurves.
    const modes = sourceCurveRepair ? [1, 0] : [0, 1];
    let failure;
    for (const mode of modes) {
      const surfaceCurves = mode ? 'preserved' : 'reconstructed-on-import';
      onProgress(`Validating ${label} STEP (${surfaceCurves} surface curves)…`);
      try {
        return { buffer: await serializeAndCheck(shape, mode), surfaceCurves };
      } catch (error) {
        if (
          !/exported STEP fails strict|STEP export changed/.test(error.message)
        )
          throw error;
        failure = error;
      }
    }
    throw failure;
  };
  const restored = transform(oc, result, detection, true);
  let stepExport, sourceExport, brep, sourceBrep, stepExportError;
  try {
    stepExport = await checkedStep(result, 'base-down');
    sourceExport = await checkedStep(restored, 'original-pose');
  } catch (error) {
    if (!/exported STEP fails strict|STEP export changed/.test(error.message))
      throw error;
    stepExportError = error.message;
    stepExport = sourceExport = null;
    // BREP stores the kernel's native curves and topology without STEP
    // translation. It must independently survive serialization and reopening.
    const checkedBrep = (shape, label) => {
      onProgress(`Validating ${label} native BREP export…`);
      const text = shape.serialize();
      const reopened = cad.cast(oc.BRepToolsWrapper.Read(text));
      try {
        if (!valid(oc, reopened) || reopened.solids.length !== 1)
          throw Error('Native BREP export fails validation when reopened.');
        const expectedBox = shape.boundingBox;
        const actualBox = reopened.boundingBox;
        const boundsChanged = expectedBox.bounds.some((row, i) =>
          row.some(
            (value, j) => Math.abs(value - actualBox.bounds[i][j]) > 0.00001,
          ),
        );
        expectedBox.delete();
        actualBox.delete();
        if (
          boundsChanged ||
          Math.abs(volume(shape) - volume(reopened)) >
            Math.max(0.001, volume(shape) * 1e-8)
        )
          throw Error(
            'Native BREP export changed the solid geometry when reopened.',
          );
        return new TextEncoder().encode(text).buffer;
      } finally {
        reopened.delete();
      }
    };
    brep = checkedBrep(result, 'base-down');
    sourceBrep = checkedBrep(restored, 'original-pose');
  }
  onProgress('Preparing CAD preview…');
  const geometry = await tessellateNative(result);
  const addedMesh = await tessellateNative(added);
  const removedMesh = await tessellateNative(removed);
  return {
    geometry,
    added: addedMesh,
    removed: removedMesh,
    step: stepExport?.buffer,
    sourceStep: sourceExport?.buffer,
    brep,
    sourceBrep,
    report: {
      ...p,
      originalVolume: volume(source),
      convertedVolume: volume(result),
      addedVolume: volume(added),
      removedVolume: volume(removed),
      outsideChange,
      representation: 'native-brep',
      nativeBooleanToleranceMM: 0.00001,
      sourceCurveRepair,
      nativeCoordinateResolutionMM: 0.00001,
      nativeCoordinateAdjustmentMM,
      nativeValid: true,
      nativeExportFormat: stepExport ? 'step' : 'brep',
      stepRoundTripValid: Boolean(stepExport),
      brepRoundTripValid: Boolean(brep),
      stepExportError,
      stepSurfaceCurves: stepExport?.surfaceCurves,
      sourceStepSurfaceCurves: sourceExport?.surfaceCurves,
      connectedSolids: 1,
      tessellationDeflectionMM: Math.max(
        geometry.tessellationDeflectionMM,
        addedMesh.tessellationDeflectionMM,
        removedMesh.tessellationDeflectionMM,
      ),
    },
  };
}
