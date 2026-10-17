# Gridfinity pegboard shelf generator

Static browser application, served at `/gridfinity-shelves/`. Geometry runs in a
terminable module worker with locally vendored Manifold 3.2.1. Three.js and
OrbitControls are shared with `/p1s-feet/vendor/`. No CAD server or upload is used.

`kernel.js` mirrors the native generator at peg commit `26138c9`:
`bench/source/gridfinity_generator_v1`. `inputs.json` retains the native exported
PF02 #9 and upright PF07 #5 connector meshes and the allowed host envelope.
Native STEP exports remain available through the linked FreeCAD generator.

The browser approximates circular surfaces with 24 segments per quarter. It
checks one connected manifold, fixed board-side connector preservation, continuous
5.4 mm roots and reference bin-foot clearance (except intentionally tight negative
clearance) before enabling STL downloads. Mesh coordinates are float32; the
host trim begins at the exact float32 board plane to avoid a rounding-induced
separation. Boolean slivers below float32 resolution are collapsed in the kernel at the final print coordinates (0.0001 mm simplification tolerance); exported STL edges are then checked by their actual coordinates. No slicer repair is assumed. This is a prototype without measured
load, retention or creep ratings. New arrays/angles need slicer and physical tests.

## Checks and publication

- `node scripts/gridfinity/check-kernel.mjs /tmp/grid-checks`: seven native-volume
  comparisons, paired mesh edges/winding, bed pose and invalid parameter checks.
- `node scripts/gridfinity/browser-check.mjs public /tmp/grid-browser/mobile.png`:
  real Chromium worker generation, pose controls, stale-download invalidation,
  cancel/retry, STL and recipe downloads, 320/390 px layout. Create the output
  directory first. Requires the existing Chromium and Node runtimes.
- `npm run build` then `node scripts/export-pages.mjs`: commit the source and
  generated `docs/` together. The home page links directly to this generator.

Dependency: npm `manifold-3d@3.2.1`, Apache-2.0. Only `manifold.js`,
`manifold.wasm`, and `LICENSE` are copied from the verified upstream archive.
No package installation scripts run. See `provenance.json` for integrity and hashes.
