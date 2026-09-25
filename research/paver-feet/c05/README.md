# C05: petal vase-mode TPU spring — experimental prototype

> Repository copy: run `python build.py` and `python preview.py` to create the STL, STEP, centerline CSV and preview listed below. The prebuilt models are in the separate C05 prototype archive.

Ten circumferential petals form one continuous open-ended cup. Its circular bottom and top rims blend into a gently corrugated 1 mm wall. Overall envelope is 125 mm diameter × 50 mm high; calculated solid volume is 16.807 cm³, about 20.3 g at SUNLU's published 1.21 g/cm³ density. Four fit under the 399 mm reference paver with centers 75–80 mm inward from the edges.

**Status: printable geometry, NOT a load-rated foot.** This is a deliberately aggressive prototype. There has been no credible shell buckling, nonlinear large-deflection, or viscoelastic creep FEA for C05. The C04 tensile FoS cannot be carried over; a 1 mm wall can buckle well before tensile failure. SUNLU's ~31 MPa published tensile strength is measured in XY; neither interlayer strength nor compression set for this print is established. Do not place the printer/paver on four untested C05 feet.

## Files

- `output/C05-petal-vase-1mm.stl`: watertight one-piece reference geometry for slicer vase mode.
- `output/C05-petal-vase-1mm.step`: editable reference solid; solid wall thickness is a CAD nominal, not a slicer command.
- `output/C05-vase-spiral-centerline.csv`: 112,501 point centerline, exactly 312.5 turns over 50 mm, 0.16 mm per turn. This is a **geometry reference**, not printer G-code.
- `output/C05-preview.png`: elevation and outlines; `design.py`, `build.py`, `preview.py` regenerate them.

## Printing

Use a **0.8 mm nozzle**, spiral vase mode, 1.0 mm outer extrusion width, 0.16 mm layer height, **zero bottom solid layers**, zero top layers, no infill or supports. Disable features that interrupt the single continuous perimeter. Feed dried TPU from an external spool. Preview the entire slice and check that it is one continuous wall with no seam, unsupported cap, or second perimeter. At 0.16 mm pitch the largest radial shift of a petal across one layer is 0.193 mm; that leaves ~0.807 mm radial overlap for a 1 mm bead. The CAD is a full 1 mm hollow wall; vase-mode slicers use its *outside contour* and set the printed width from the slicer. Confirm the actual width in a sectioned print. A 0.4 mm nozzle forcing 1 mm width is not the recommended first attempt.

The 1 mm top rim contacts the underside of concrete along a circle about 92 mm in diameter. Check actual contact, flatness, and paver soundness; any sharp concrete asperity can notch or concentrate load in the rim. The base also bears on a 1 mm annular rim and may dent a soft shelf. Small local load-spreading pads are possible, but they must be modeled and tested as part of the assembly.

## Load gate

At the earlier combined printer+paver assumption of 35 kg, the average foot force is 85.8 N (8.75 kg). The previous deliberately conservative load case is 133.86 N (13.65 kg) per foot including uneven sharing and a 20% peak factor. Use a flat rigid platen for an isolated foot and add ballast slowly: 2 kg, 5 kg, 8.75 kg, then 13.65 kg **only if stable**. Record height, lateral drift, sudden snap-through, wall contact, and any cracks. Leave it at 8.75 kg for 24 hours and repeat after seven days. Reject if it folds suddenly, continues creeping substantially, rocks, or cracks. A print that survives this gate still has no demonstrated FoS 4, fatigue life, or stability under a moving P1S; those require material testing and validated nonlinear shell analysis.

## Engineering sanity check

If this were a straight thin cylinder carrying axial load uniformly, the mean axial membrane stress at radius 46 mm and thickness 1 mm would be 133.86/(2π·46·1) ≈ 0.46 MPa. That is **not** a tensile or buckling prediction for the petals: local bending, eccentric load, and initial imperfections can dominate. The petal shape seeks to stiffen the hoop without thickening the wall; its effectiveness needs measurement. Relative to C04's 4.5 mm thickness, equal-curvature bending stress would scale roughly 20-fold at 1 mm thickness, which is why C04's FEA is inapplicable.
