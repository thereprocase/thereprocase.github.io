# Gridfinity drawer insert generator

[Open generator](https://thereprocase.github.io/gridfinity-drawers/).

Static browser CAD: Manifold builds geometry in a worker; Three.js displays it.
No account, upload or remote geometry service is required. The initial page and
vendored modules must load before use. Source is `public/gridfinity-drawers/`.

## Dimensions

All values are millimeters. X runs left to right; Y front to back; Z up.
Enter the finished insert outline, allowing your own drawer clearance. Grid
pitch stays 42 mm. Columns and rows are explicit, or use Fit largest grid.
Independent X/Y anchors accept centered placement, signed center offsets,
near/far edge padding, or edge snaps. Snaps retain a 2 mm minimum rim outside
the nominal grid boundary. Padding is not measured to the curved pocket edge.

Default: 300 × 400 mm, 6 × 8 cells, 1.2 mm floor thickness and 5 mm seats. Closed is the default.
The profile follows the reviewed pegboard generator; reference foot checks
allow only 0.003 mm³ numerical intersection. Additional seat clearance is
separate from drawer padding and joint adjustments.

## Bottom styles

With hardware off, choose **Closed** for a continuous floor or **Open** for rounded 32.5 mm windows
through each cell floor. Open retains a 2 mm ledge around the lower seat and at
least 2.4 mm of floor on either side of the shaped glue faces. The seat tapers,
outer frame, overall height and 42 mm pitch stay the same. Cuts through a cell
may divide its window with solid seam strips. Drawer-edge padding remains solid.
The tiles sit on the drawer floor.
Every tile must remain one connected, watertight solid in either mode.

Recipes save the selection. Existing recipes without a bottom field load Closed.
STL downloads are watertight solids even when the floor has open windows.

## Magnets, screws and ballast

Floor, Magnets and M3 screw holes are independent buttons. Ballast requires Closed;
turning Ballast on closes the floor, and choosing Open turns Ballast off. These
provide the same 12 floor/hardware/ballast combinations as the shelf generator.

Magnet pockets are 2.4 mm deep for 6 × 2 mm magnets. Fit presets share the shelf
and converter definitions: **Snug glue** Ø6.2 mm (default), **Official** Ø6.5 mm,
and **Friction** Ø6.0 mm. Snug glue matches the stacking boxes and the owner's
reported fit; friction retention depends on printing tolerances.

Hardware centers are ±13 mm from each cell center. M3 clearance holes are
Ø3.2 mm and pass through the floor. Magnets raise the seat floor to 3.2 mm above
the underside, retaining 0.8 mm below each pocket. Open floors with hardware
use an octagonal central window, retaining four corner supports. Tile seam
lands remain, although hardware holes can cross them. Assemble tiles before
installing hardware that spans a cut.

Ballast raises the seat floor to 6.65 mm, with 21.4 × 21.4 × 4 mm weight cavities
and 2 mm-deep rubber-foot recesses opening from underneath. M3 hardware, when
enabled, also gets Ø6 mm underside head recesses. Weights need a suitable
retaining backing. Hardware remains optional. The 5 mm seat profile and 42 mm
pitch are preserved; total height includes the increased floor depth.

Recipes, shared links and download names carry these options. Older recipes
without hardware fields retain their original no-hardware geometry.
[Hardware geometry checks](checks/base-options.json) cover all combinations and
magnet fits, pocket probes, tiled cuts, valid connected meshes, reference-foot
clearance and unchanged legacy meshes. [Browser checks](checks/base-options-browser.json)
cover controls, saved settings, recipe/ZIP/STEP downloads and mobile layout.

## Tiling and CA joints

Automatic tiling fits the specified usable print area in the displayed X/Y
orientation. Exclude purge lines, brim and bed exclusions yourself. Manual
cuts are distances from the left/front, separated by at least 12 mm. Cuts may
cross seats: closed floors or solid floor strips at glue faces keep tiles connected. Oversized manual tiles
are marked. Limits: 256 cells and 64 tiles per generation.

Internal mating faces form a shallow V through Z: zero lateral excursion at
bottom/top, 0.8 mm at mid-height by default. Each tile prints flat underneath.
These are glued registration faces, without positive engagement or latches.
The default removes a **0.15 mm thick V-shaped strip** from the finished model at each seam: 0.075 mm off each opposing face. This is a printing-fit allowance, not a deliberately open adhesive joint. Tiles retain their original registration; no translation or added material closes the relief in CAD. The 42 mm grid and finished outline are unchanged before the seam strip is removed.

Dry-press the printed faces snugly together and check a bin across the seam. Remove the bin, apply a small amount of CA, and press the joint home while curing. The bin is a fit check, not an assembly spacer.

Independent X/Y face-stock corrections add half their value to each opposing face. Positive stock increases the snugly assembled cross-seam pitch; negative stock decreases it. Start at zero and use a trial to correct measured printing error. Within-tile pitch remains 42 mm. In terms of the opposing faces' combined printing growth:

    seated seam pitch error = combined face growth + stock correction - modeled fit relief + residual bondline

The working assumption is that the fit relief is largely consumed by the printed fit, leaving near-zero pitch change when pressed snug. The 0.15 mm default is a starting allowance, not a calibrated guarantee for every printer. Do not translate the CAD tiles to close the relief: that would deliberately shorten the nominal grid. The preview and ZIP origins preserve the original registration.

For a trial, load seam-trial.json or generate a 2 × 1 insert with a center X cut; repeat in Y if needed. Check cross-seam bin fit in your material before a full insert.

## Downloads and checks

Selected STL is local XY with the flat underside at Z=0. ZIP contains all tile
STLs, the input recipe and nominal assembly origins. Recipes reload into the
page. Settings changes invalidate downloads; Cancel stops geometry generation.

Every export is a connected Manifold solid, re-entered at actual float32 output
precision, then checked for closed edge incidence and winding before download.
Reference foot interference and automatic bed fit are checked. No downstream
mesh repair is used.

Run the repeatable geometry suite from the repository root:

    node scripts/check-drawer-gridfinity.mjs /tmp/drawer-checks

[Geometry test evidence](checks/geometry.json). The illustration is rendered
from actual default generator output, with tiles separated for visibility.
The project uses the existing locally vendored Manifold and Three.js assets
and their license files from the shelf and P1S-foot pages. Gridfinity reference:
https://github.com/kennetek/gridfinity-rebuilt-openscad .

Open-bottom geometry checks: `node scripts/check-drawer-open-bottoms.mjs /tmp/drawer-open-checks`. [Open-bottom evidence](checks/open-bottoms.json).

## Preview and exports

Bed presets and custom usable dimensions drive automatic tiling and the selected-tile preview. The bed choice is shared with the pegboard generator on this browser. Manual cuts remain fixed when the bed changes. In print view, the selected tile is centered on the bed and portions outside it appear red; STL and STEP remain in the original tile-local coordinates with the flat underside at Z=0.

Changed, computing, cancelled and failed generations keep the previous geometry visibly labelled until a new model succeeds. Geometry and rendering run in the browser.

Seat clearance ranges from -0.10 to +0.20 mm per side. Negative values tighten the seat and can lift the bin slightly on its taper; the reference-fit check accounts for that seating lift. The 42 mm grid pitch stays fixed.

Selected tiles can be downloaded as STL or faceted-solid STEP. Download names describe the drawer size, cell count, bottom style, placement and joint settings. Save the parameter recipe to reproduce the exact cuts.

[Fit-relief subtraction check](checks/fit-relief.json): exported X/Y tiles at their original assembly coordinates exactly match the finished insert minus the independently constructed 0.15 mm V strip, in both bottom modes. Repeat with `node scripts/check-drawer-fit-relief.mjs`.

## Tile preview labels and settings links

Preview IDs use the exact `tile-row-column` suffix from each download filename. Row 1 is at the drawer front (Y=0). The placement diagram and 3D preview show the IDs; click a 3D label to select that tile. Labels can be hidden, and crowded 3D labels appear as you zoom in. They are display overlays and do not change the exported geometry.

Copy settings link saves the current form inputs, usable bed dimensions, assembly/print view, selected tile, separation slider and label visibility in the URL fragment. Opening it restores the inputs and generates the tiles. Selected tile indices are clamped if the layout has fewer tiles. If clipboard access is blocked, a selectable URL is shown. Parameter files remain available for saving recipes.


## Shared runtime improvements (2026-10-21)

The viewer renders when the scene, camera or size changes and stops while idle, offscreen or hidden. This affects display scheduling only; STL, faceted STEP and 3MF geometry retain their existing precision and validation. The shared runtime is `../gridfinity-common/generator-runtime.js`.

Generation and export report actual operation stages and elapsed wall time. Drawer generation also reports completed tiles. Progress stays indeterminate during operations without a measurable total. Cancel terminates the active worker; cancelling export retains generated mesh data for retry. Cancelled workers cannot publish queued results or downloads. Leaving the page stops generation/export workers, and generation controls remain disabled until their handlers are attached. Each new operation owns a fresh worker, so a failed kernel is never reused.

These generators use Manifold and a faceted STEP writer. The converter's OCCT allocator changes, pthread validation overlap, source certificates and exact-curve STEP reader optimizations do not apply to this architecture. No OCCT kernel or extra thread pool is loaded. Future performance changes must retain geometry/export checks and compare complete user-visible wall time, including cold startup and repeated use.

Drawer ZIP packaging also runs in its export worker, with completed-tile progress, cancellation and completion timing. Cancelling it preserves the generated tiles. Local browser checks verify idle rendering, view updates, repeated generation, STEP cancellation/retry and page-hide cleanup; drawer ZIP cancellation/retry is checked separately. Six drawer geometry cases remain byte-identical to the previous STL output. See `checks/runtime-3.json` for the measured scope.

Cancellation and errors also record their own outcome and elapsed time. Windows Edge checks passed on both generators, including repeated generation, idle rendering and STEP cancel/retry; drawer ZIP contents stayed byte-identical after moving packaging into a worker. These changes reduce idle GPU work; the recorded generation timings are observations, not a measured generation-speed improvement.
