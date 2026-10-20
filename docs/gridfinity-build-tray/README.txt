Portable Gridfinity workspace — V5 overhang revision

Gridfinity interfaces
The 42 mm pitch, standard feet, magnet positions and pocket dimensions, bin stacking receivers, and full 4x4 carrier/lid receivers are preserved from V4. interface-checks.json compares the actual CAD solids in these regions. The carrier remains 176 mm square, with a 42 mm assembled stacking pitch. Bins remain 33 mm tall with a 29.4 mm stacking pitch. Nominal clearances remain 1.5 mm below the next bare carrier and 3.15 mm below the recessed receiver lid.

Carrier assembly — two prints, bonded together
Print carrier-grid-deck feet down and carrier-wall flat lower rim down, exactly as exported. The assembled reference carrier-assembly.step is NOT a printable one-piece model.
The separate wall removes the unsupported outer rim and its groove-roof bridge. Its lower inside edge rises gradually inward. The deck retains the standard grid feet and sockets; only material outside those interfaces changes.
Join the wall to the deck with an adhesive suitable for the printed material, filling the perimeter joint. The nominal straight-side bond gap is 0.2 mm; the entry narrows near the deck's top. This is a bonded joint, not a snap fit or a friction fit.
To align: stand the grid deck feet on a flat surface. Print four copies of accessories/carrier-alignment-gauge.stl and place them under the middle of the wall's four sides, outside the feet. The gauges hold the wall's bottom edge 4.75 mm above the foot bottoms. Keep that alignment while the adhesive cures; remove the gauges afterward. The wall exports with its own lower rim at Z0, so it must move up 4.75 mm in the assembled reference.
The adhesive joint carries the deck when lifting the carrier by its wall. Bond strength and load capacity require physical testing. Do not use the unbonded assembly as a carrying tray.

Bins
Print feet down. Interior shoulder ramps now start 1.2 mm lower so the rounded corners no longer create the shallow V4 overhang. The bin heights, feet, magnets and top stacking profiles are unchanged. Main walls/dividers are 1.8 mm. Changes are confined to the inside below the stacking interface.

Lids
Slim: print lid-slim outer-face down as exported. Its roof is 1.6 mm thick with 1.8 mm ribs. Adds 2.25 mm above the carrier lip; geometry unchanged from V4.
Receiver: print lid-receiver-frame top-face down and lid-recessed-deck flat-base down, as exported. The frame and deck now meet on a continuous 45-degree taper rather than abrupt 1 mm ledges. Drop the deck into the frame from above, seat it evenly on the taper, and bond for retention. Do not sand the mating taper indiscriminately: it determines the deck height. Physical fit remains to be checked.
The receiver seating level is still Z46.65 in the assembly, with total lid top Z51.4 (2.65 mm above the carrier lip). Optional magnets and the complete 4x4 receiver are unchanged. Both lids are lift-off, unlatched covers.

Overhang evidence and remaining bridges
The exported meshes are audited in their actual print orientations. The carrier wall and both receiver-lid parts must have no elevated horizontal downward faces. The broad V4 carrier overhang and both abrupt lid ledges are removed.
Standard underside magnet-pocket roofs remain 6.2 mm bridges. Multi-cell feet retain the short bridges between adjacent Gridfinity foot pads; those grid features were deliberately preserved. The mesh audit reports these separately from sloped surfaces. Very small facets at curved/tessellated boundaries can differ slightly from the nominal CAD slope; see overhang-audit.json.
This is CAD and slicer evidence, not a successful physical print. Bridge quality, dimensional fit, adhesion, lid seating and bonded-joint strength need physical checks. Print STL files in their exported orientations; supports are not intended for these geometries. A 1x1 bin is a useful first fit/bridge check.

Files
models/: printable STL and STEP parts. accessories/: optional alignment gauge; print four.
Reference STEP assemblies are for viewing/assembly, not one-piece printing.
portable-grid-workspace.FCStd: printable components.
build.py, build_lids.py, profile_helpers.py: FreeCAD generators; run build.py then build_lids.py.
validation.json: solid, mesh, assembly interference and seating checks.
interface-checks.json: protected-interface comparison against V4.
overhang-audit.json: downward-face measurements in print orientations.
SLICE-NOTES.txt: current support-disabled slicer estimates; these are not print qualification.

Attribution
Inspired by Polymorphic's Build Tray: Modular organizer for assembly, disassembly and maintenance.
https://www.printables.com/model/1758185-build-tray-modular-organizer-for-assembly-disassem
Original attribution/license: CC BY 4.0. This remix substantially changes the geometry, grid layout, stacking, magnet bases and lids. This remix is also shared under CC BY 4.0.
