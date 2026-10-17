# Gridfinity pegboard shelf generator

Static browser application, served at `/gridfinity-shelves/`. Geometry runs in a
terminable module worker with locally vendored Manifold 3.2.1. Three.js and
OrbitControls are shared with `/p1s-feet/vendor/`. No CAD server or upload is used.

`kernel.js` mirrors the native generator at peg commit `bff6ad1`:
`bench/source/gridfinity_generator_v1`. `inputs.json` retains the native exported
PF02 #9 and upright PF07 #5 connector meshes and the allowed host envelope.
Native STEP exports remain available through the linked FreeCAD generator.

The browser approximates circular surfaces with 24 segments per quarter. It
checks one connected manifold, fixed board-side connector preservation, continuous
5.4 mm roots and reference bin-foot clearance (except intentionally tight negative
clearance) before enabling STL downloads. Mesh coordinates are float32; the
host trim begins at the exact float32 board plane to avoid a rounding-induced
separation. Boolean slivers are simplified at 0.00001 mm in the design frame, and the result is re-imported into the kernel at the final float32 print coordinates without another simplification pass. Exported STL edges are then checked by their actual coordinates, and export volume must agree within 0.001%. No slicer repair is assumed. This is a prototype without measured
load, retention or creep ratings. New arrays/angles need slicer and physical tests.

## Checks and publication

- `node scripts/gridfinity/check-kernel.mjs /tmp/grid-checks`: nine native-volume
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

## Rail and web revision

The rear rail now ends at the frame (42 × columns + 4 mm). Mounting posts stay inside that width, moving inward by complete board pitches when required. The side webs extend to the front beam with a vertical end connection. Earlier sliced shelf packages retain the previous geometry; re-slice generated STLs.

## Continuous outer frame revision

The exterior is one frame with straight rear/side joins and tangent R5 front
corners. Beam and web solids share that trim. Cell profiles and internal ribs
are unchanged. Native evidence includes 13 lift positions per cell for
nonnegative clearance; both kernels check the full front core between outer
peg columns. At maximum clearance the checked thickness is 1.85 mm rather than
1.9 mm, matching the remaining rim. Earlier sliced packages are not this CAD.

Browser front-core checks allow a 0.00001 mm boundary skin for float rounding
and Boolean simplification. The entire inset core must remain contained
(missing volume ≤0.000001 mm³), and total missing volume cannot exceed that
skin volume. Raw and inset missing volumes are retained in the test evidence.
Native solid checks retain their original 0.000001 mm³ containment threshold.
