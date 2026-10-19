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

Choose **Closed** for a continuous floor or **Open** for rounded 32.5 mm windows
through each cell floor. Open retains a 2 mm ledge around the lower seat and at
least 2.4 mm of floor on either side of the shaped glue faces. The seat tapers,
outer frame, overall height and 42 mm pitch stay the same. Cuts through a cell
may divide its window with solid seam strips. Drawer-edge padding remains solid.
The tiles sit on the drawer floor.
Every tile must remain one connected, watertight solid in either mode.

Recipes save the selection. Existing recipes without a bottom field load Closed.
STL downloads are watertight solids even when the floor has open windows.

## Tiling and CA joints

Automatic tiling fits the specified usable print area in the displayed X/Y
orientation. Exclude purge lines, brim and bed exclusions yourself. Manual
cuts are distances from the left/front, separated by at least 12 mm. Cuts may
cross seats: closed floors or solid floor strips at glue faces keep tiles connected. Oversized manual tiles
are marked. Limits: 256 cells and 64 tiles per generation.

Internal mating faces form a shallow V through Z: zero lateral excursion at
bottom/top, 0.8 mm at mid-height by default. Each tile prints flat underneath.
These are glued registration faces, without positive engagement or latches.
The assumed horizontal CA bondline is **0.10 mm**, a starting point for FDM prints. Dry fit a small pair first.

Independent X/Y face-stock corrections add half their value to each opposing
face. Positive stock increases cross-seam pitch at a fixed bondline; negative
stock decreases it. Within-tile pitch remains 42 mm. Ignoring print error:

    cross-seam pitch error = stock correction + actual bondline − assumed bondline

Corrections accumulate across seams. The assembled preview shows nominal
registration; it does not simulate squeezing the gap shut. Align a 42 mm
reference across seams while curing. Keep adhesive off the reference bin.
Follow the adhesive manufacturer's handling instructions.

For a trial, generate a 2 × 1 insert with a center X cut; repeat in Y if needed.
Check bin seating and cross-seam pitch in the actual material before a full
insert.

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
