/* CAD import stays in a terminable worker; the original CAD is retained separately. */
importScripts('./vendor/occt/occt-import-js.js');
let ready;
onmessage = async ({ data }) => {
  try {
    const started = performance.now();
    postMessage({ progress: 'Loading the CAD engine…' });
    ready ??= occtimportjs({ locateFile: (path) => './vendor/occt/' + path });
    const occt = await ready;
    const engineReadyMS = performance.now() - started;
    const budget = data.previewTriangleBudget ?? 1000000;
    const levels = [
      [0.025, 0.15],
      [0.05, 0.25],
      [0.1, 0.35],
      [0.2, 0.5],
      [0.4, 0.65],
      [0.8, 0.8],
    ];
    let nextDeflection = 0;
    for (const [index, [deflection, angle]] of levels.entries()) {
      if (deflection < nextDeflection) continue;
      postMessage({
        progress: index
          ? `Adapting the CAD preview (${deflection} mm)… Original CAD retained.`
          : 'Reading CAD solids and building the preview…',
      });
      const result = occt.ReadFile(data.format, new Uint8Array(data.buffer), {
        linearUnit: 'millimeter',
        linearDeflectionType: 'absolute_value',
        linearDeflection: deflection,
        angularDeflection: angle,
      });
      if (!result.success)
        throw Error(
          'CAD import failed. The file could not be read as CAD geometry.',
        );
      const triangles = result.meshes.reduce(
        (sum, mesh) => sum + mesh.index.array.length / 3,
        0,
      );
      if (triangles <= budget) {
        // Transfer only detection/viewer geometry; normals and CAD face tables are unused.
        const transfers = [];
        const meshes = result.meshes.map((mesh) => {
          const positions = new Float32Array(mesh.attributes.position.array);
          const indices = new Uint32Array(mesh.index.array);
          transfers.push(positions.buffer, indices.buffer);
          return {
            attributes: { position: { array: positions } },
            index: { array: indices },
          };
        });
        postMessage(
          {
            result: { success: true, meshes },
            preview: {
              deflectionMM: deflection,
              angularDeflection: angle,
              triangles,
              adapted: index > 0,
              engineReadyMS,
              readAndMeshMS: performance.now() - started - engineReadyMS,
            },
          },
          transfers,
        );
        return;
      }
      // Jump past refinements unlikely to fit, avoiding a full STEP read at each level.
      nextDeflection = Math.min(0.8, (deflection * triangles) / budget);
    }
    throw Error(
      'This CAD file still exceeds browser preview capacity after automatic adaptation. The original CAD has not been changed.',
    );
  } catch (e) {
    postMessage({ error: e.message ?? String(e) });
  }
};
