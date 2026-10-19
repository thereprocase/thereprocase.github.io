# Gridfinity pegboard shelf generator

Static browser application, served at `/gridfinity-shelves/`. Geometry runs in a
terminable module worker with locally vendored Manifold 3.2.1. Three.js and
OrbitControls are shared with `/p1s-feet/vendor/`. No CAD server or upload is used.

`kernel.js` mirrors the native generator at the linked peg branch revision:
`bench/source/gridfinity_generator_v1`. `inputs.json` retains the native exported
PF02 #9, upright PF07 #5 and intermediate bearing-locator meshes and the allowed host envelope.
Native STEP exports remain available through the linked FreeCAD generator.

The browser approximates circular surfaces with 24 segments per quarter. It
checks one connected manifold, fixed board-side connector preservation, continuous
5.4 mm roots and reference bin-foot clearance (except intentionally tight negative
clearance) before enabling STL downloads. Mesh coordinates are float32; the
host trim begins at the exact float32 board plane to avoid a rounding-induced
separation. Boolean slivers are simplified at 0.00001 mm in the design frame, and the result is re-imported into the kernel at the final float32 print coordinates without another simplification pass. Exported STL edges are then checked by their actual coordinates, and export volume must agree within 0.001%. No slicer repair is assumed.

## Checks and publication

- `GRIDFINITY_NATIVE=/path/to/native-cases node scripts/gridfinity/check-kernel.mjs /tmp/grid-checks`: nine native-volume
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

## Previous rail and web revision

The rear rail now ends at the frame (42 × columns + 4 mm). Mounting posts stay inside that width, moving inward by complete board pitches when required. The side webs extend to the front beam with a vertical end connection. Earlier sliced shelf packages retain the previous geometry; re-slice generated STLs.

## Continuous outer frame revision

The exterior is one frame with straight rear/side joins and tangent R5 front
corners. Beam and web solids share that trim. Cell profiles and internal ribs
are unchanged. Native evidence includes 13 lift positions per cell for
nonnegative clearance; both kernels check the full front core between outer
peg columns. At maximum clearance the checked thickness is 1.85 mm rather than
1.9 mm, matching the remaining rim. Earlier sliced packages are not this CAD.

Browser front-core checks allow a boundary skin of 0.00001 mm plus one float32
ULP at the core coordinate magnitude for rounding and Boolean simplification. The entire inset core must remain contained
(missing volume ≤0.000001 mm³), and total missing volume cannot exceed that
skin volume. Raw and inset missing volumes are retained in the test evidence.
Native solid checks retain their original 0.000001 mm³ containment threshold.

## Solid backplate and mounting height

Default parameters now include `mount_rows: 2` and `backplate: true`. A 5.4 mm continuous backplate connects 25.4 mm peg columns to 42 mm Gridfinity cell-boundary gussets. Height 1 is hook-only with 12.7 mm of backplate below the hook centers. Heights 2–4 retain top hooks and bottom hoops; 3–4 use exact native bearing locators between. Gussets extend to the selected backplate bottom. The open-back option retains continuous top/bottom ties and posts at both grids. STL and JSON outputs retain the selected settings.

The default 2×1 solid CAD volume rises from 16.18 to 29.44 cm³ with the solid backplate and third gusset. Printed mass depends on the actual walls and infill.

For a static-only generator update, copy this complete directory to `dist/client/gridfinity-shelves` and `docs/gridfinity-shelves` after checks. Keep their hashes equal; no framework rebuild is needed when other pages are unchanged.

## Peg fit and coupon

The three fit controls are offsets from the existing pegs, in 0.05 mm steps:

- `peg_clearance`: -0.15 to +0.15 mm per side. Positive narrows the crush ribs
  for an easier fit in the holes; negative makes them tighter. Bearing surfaces
  and the rear hook/hoop shapes stay in place.
- `hook_grip`: -0.20 to +0.20 mm. Positive adds upper-hook clamp against the board;
  negative gives it more room.
- `hoop_firmness`: -0.15 to +0.20 mm. Positive adds to the 0.80 mm flexing wall;
  negative makes the lower hoop easier to flex. Its outside catch stays the same.

Zero keeps the original connectors. Peg pitch remains 25.4 mm, Gridfinity pitch
42 mm, and the joining roots keep their dimensions. The fit library contains
native FreeCAD cores at each setting; the browser constructs the crush ribs.
No whole-peg scaling or interpolation is used. The library loads only when a
nonzero fit is selected.

Generate peg-pair coupon creates a 20 mm wide small backplate with the same
hook and hoop settings. It always uses two holes one inch apart, regardless
of the shelf array. Its STL is already in the print pose. Fit settings carry
through the size presets and saved recipes; Reset peg fit returns them to zero.

[FreeCAD source ZIP](downloads/peg-fit-source.zip) includes the controls and coupon:
run `bench/source/gridfinity_generator_v1/generate.py output --config recipe.json`
in FreeCAD Python; add `--coupon` for the peg pair. This source bundle extends
the original shelf source linked in the provenance record.

Run `node scripts/gridfinity/check-peg-fit.mjs /tmp/peg-fit-checks` for the
coupon, adjustment-independence, rib-width and parameter checks. Test outputs
are in [checks/peg-fit.json](checks/peg-fit.json).
