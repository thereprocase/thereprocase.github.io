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


## Board systems

The selector keeps the original round-hole PF02/PF07 mounts and adds IKEA
SKÅDIS drop-in retaining tails on a staggered 40 × 20 mm slot layout. The bin
seats remain on a 42 mm grid. A narrow shelf skips a slot row when its shifted
mounts cannot fit inside the backplate. One to four usable mounting rows can be
selected. The SKÅDIS coupon has two hooks offset 20 mm across and down.

SKÅDIS is modeled from reference dimensions, not print tested. The defaults are
5 × 15 mm rounded slots, 5.5 mm board thickness, 0.2 mm side clearance,
0.2 mm behind-board gap and a 3 mm deep retaining tail. These dimensions and the
source are in `board-sources.json`. The hook geometry is adapted from John
Mylchreest's MIT-licensed library; the original source and license are bundled
under `sources/skadis/`. The port raises the tab to account for the rounded slot
ends, derives its insertion travel from the actual tail envelope, and adds a
positive-volume tab/tail union.

SKÅDIS hook ledges need supports in the supplied frame-down pose. The digital
checks cover solids, connector preservation, bin-foot clearance, closed STL,
and insertion/removal through a modeled board; they do not represent a print.
The FreeCAD source download continues to support the original round-hole
system. `boards.js` is the editable browser CAD source for SKÅDIS.

The feedback section can open a GitHub issue draft with board, recipe and fit
notes, or save that information as local JSON. No feedback is sent automatically.

Run `node scripts/gridfinity/check-board-systems.mjs /tmp/board-checks` for the
new interface checks. `check-peg-fit.mjs` retains the original connector checks.


## Round-hole variants and industrial panels

| Preset | Hole opening | Mount pitch | Initial panel thickness |
| --- | --- | --- | --- |
| US small | 4.7625 mm round (3/16 in) | 25.4 mm | 3.2 mm |
| US large | 7.14375 mm round (9/32 in) | 25.4 mm | 5.5 mm |
| Wall Control | 6.35 mm round | 25.4 mm | 0.9 mm, provisional |
| Metric | 6 mm round | 25 mm | 5 mm |
| Bott Perfo | 9.2 mm square | 38.1 mm | 0.9 mm, provisional |

These are reference-based models, not print tested. Use measured hole openings
and panel thickness for your board. The 25 mm preset is a specific pattern, not
a claim that all metric panels use it. Wall Control uses its round holes here.
The Bott preset uses our rounded L-pins in the square openings, not Bott's
locking-clip attachment.

Upper L-hooks and lower locating pins are adapted from Eugene Vasenev's
MIT-licensed model, included with its license under `sources/round/`. Upper and
lower clearances are separate; no snap barb is used. Hook ledges need supports
in the supplied frame-down pose. Panel references and exact defaults are in
`board-sources.json`. Digital checks cover static board clearance, pitch,
connected solids and closed STL; they do not establish an insertion path or
physical fit. Print the selected coupon before a shelf.

## Multiboard and HSW screw inserts

These presets reuse separate M3 board inserts rather than embedding a copy of
their snap geometry. Get the inserts from the creator links shown in the form:
Multiboard **Drop-In Nut Snap — M3**, or HSW **insert-m3** with its M3 hardware.
Use one insert and screw per generated mount. The backplate seats against the
insert faces; choose screw length for the insert and nut engagement.

Multiboard mounts follow a 25 mm grid. HSW uses a 23.6 mm vertical pitch and
40.8763990586 mm horizontal mounting step (every other hex column). The HSW
pitch follows Xander/EdwinEesting/geru's CC BY 4.0 panel reference, linked in
`board-sources.json`. The original board inserts are not redistributed or
modified in this project.

The original screw interface defaults to 3.4 mm clearance holes and 6.2 mm head
recesses, 3.2 mm deep. Recess depth is limited to 3.1–3.4 mm so a 3 mm socket
head clears the adjacent frame while leaving at least 2 mm of backplate under
it. The coupon uses the same bores and pitch as the shelf. These models are
not print tested; the digital checks verify our fastener clearance and bearing
material, not the external inserts' snap retention.

Additional checks:

- `node scripts/gridfinity/check-round-boards.mjs /tmp/round-board-checks`
- `node scripts/gridfinity/check-bolted-boards.mjs /tmp/screw-board-checks`

STLs for new board systems include `NOT PRINT TESTED` in their header. The
original system's STL bytes and native-compatible parameter format are retained.


For screw-mounted shelves, the gussets reach the bottom of the backplate. This
keeps a continuous strip below the lowest head recess, including when a bore
aligns with a gusset. The strict connected-solid check remains in force.

The final STL check still requires exactly two oppositely directed uses of every
geometric edge. If float32 conversion flattens a microscopic triangle fan, new
board exports can simplify that fan in the solid kernel using a tolerance tied
to coordinate precision. Symmetric material change is limited to 0.001%, the
part must remain one solid, and the same strict edge check runs again. The
original system's export path is unchanged.

### Screw access

Multiboard and HSW mounts have a 10 mm forward clearance pocket at each screw head, including where a gusset crosses the screw position. Use a short L-shaped Allen key; these pockets do not provide a straight screwdriver path through the entire shelf.

## Reinforcement downloads

Every shelf and fit coupon, on all nine board systems, offers a faceted STEP and an Orca-compatible 3MF with separate reinforcement bodies. The main printable mesh is unchanged by reinforcement. These helpers occupy existing material; they are not additional parts.

Helpers span the complete peg and backplate thickness. Each peg/root envelope gets a 3.5 mm margin and a continuous full-thickness column up into the adjacent shelf frame, including lower pegs. Regions are clipped to the part, so bin seats, screw holes and mounting clearance remain open. Overlapping regions merge. Show reinforcement displays the regions in orange.

The 3MF stores one normal body and parameter modifiers with `sparse_infill_density=100%`. It supplies geometry and local infill overrides, not a machine, filament or global process profile. Retain your own printer/material settings when opening it.

The STEP contains separate named closed faceted solids: `Body_PRINT` and `Reinforcement_100pct_3p5mm_*`. STEP has no slicer infill metadata: import the helpers as modifiers and set them to 100% infill yourself, or use the 3MF. Faceted STEP preserves the browser mesh geometry and is not the analytic native FreeCAD model. The STEP-only conversion simplifies sub-micron mesh details at a 0.001 mm tolerance, with a 0.01% symmetric-volume guard; STL and 3MF main geometry stay unchanged. Large arrays can produce large STEP files.

Screw recess mouths have a 0.3 mm chamfer. The recess floor remains flat and the minimum 2 mm bearing thickness is preserved.
