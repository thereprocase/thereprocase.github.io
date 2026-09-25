# C01 — flat TPU corner feet for a concrete paver

Four identical corner feet support a plain concrete paver carrying a P1S without
an AMS. Each assembled foot is **76.2 × 76.2 × 38 mm**: exactly 3 × 3 inches in
plan and just under 1.5 inches below the slab. **No locating lips.** The whole
foot can sit beneath the paver footprint, aligned visually with the corner.

## Two pieces per foot

- `base.stl`: square shelf-contact frame with a central catch stop.
- `floating-pad.stl`: flat bearing pad, four curved flexures and a seating ring.

Print four of each. Both parts are exported flat on the bed, with upward-growing
features and no designed support/roof bridging. The upper pad has a 24 mm open
recess to save material; its surrounding 48 mm chamfered square bearing face is
coplanar and has no lips. The concrete spans the recess. Check that the slab's
underside is flat and the contact surface bears evenly.

Drop the upper seating ring into the base. It is gravity-seated, with 0.25 mm
radial socket clearance, not snap-locked. Lift each foot by its base. Put the
assembled feet entirely underneath the four paver corners. Approximate center
locations for the reference 398.78 mm square slab are 38.1 mm inward from each
edge. Slight position adjustments are allowed; all feet must remain fully on
the shelf and loaded. There is no slab-width or thickness-specific socket.

The outer seating ring is part of the shelf-side load path. The paver must never
settle onto it: that would bypass the flexures. Nominal clearances are 13 mm
between pad underside and center stop, and 14.2 mm between paver and outer ring.
The pad's lower corners also need radial clearance from the frame.

## Reference load and material

A Lowe's 16-inch square paver, model 104801256, is listed at 36 lb (16.329 kg)
with actual 15.7-inch sides. Its page lists approximately 46–47 mm thickness;
the preview uses the operator's 45 mm estimate. This is a mass/shape reference,
not a claim that every local inexpensive paver has these dimensions or weight.

With a 12.95 kg bare P1S, the reference supported load is 29.279 kg. Size and
weigh the actual purchase. The design case is 35 kg total, 30% excess corner
loading, a 2 mm eccentric load, 5 MPa assumed effective TPU modulus, and 1.5×
displacement drift. The 5 MPa value is a chosen low-end scenario, not a guarantee
for unknown TPU. A separate 45 kg upset is included in the calculations.

The material is not yet identified. Geometry is calculated as solid TPU, so use
100% infill, at least four perimeters, a 0.4 mm nozzle and 0.2 mm layers. Dry and
print with the filament maker's recommended settings. Check filled flexures and
root continuity in the slicer. No completed slicing or physical print test is
claimed. Four solid assemblies use roughly 0.43 kg of TPU at 1.22 g/cm³.

## Analysis and interaction with the existing feet

The chosen flexures are 7.2 mm wide, 8.8 mm deep, and curve through 12 degrees.
The numerical screening compares 252 dimension combinations and chooses the
softest feasible centered vertical stiffness subject to underside, slab/rim
and radial clearances, including eccentric loading. A further 0.8 mm allowance
is deducted from the two vertical clearances for pad/base compression and fit.
This allowance is not a measured compression law or manufacturing tolerance.

See `analysis/results.json` for the exact stiffness, load cases, clearances and
coupled modes. The linear frame includes axial deformation, bending, shear and
torsion. A free pad with a 2 mm load eccentricity is a conservative local tilt
screen; it does not simulate all four pads contacting a rigid, possibly uneven
stone simultaneously. Linear beam accuracy is limited for these short, thick
ribs and large worst-case deflections. Rubber nonlinearity, layer anisotropy,
temperature, creep, contact and fatigue remain unvalidated.

The vibration model connects printer -> squash balls -> moving P02 cradles ->
P02 flexures -> paver -> C01 corner feet -> fixed shelf. It is a vertical
three-mass approximation, with 0.08 kg total hypothetical upper cradle moving
mass and 0.20 kg of lower moving pads included with the paver. Reference inputs
are E=9.8 MPa, ball stiffness 20 N/mm per ball and loss factor 0.30. Ninety cases
sweep assumed modulus, ball stiffness, loss and dynamic stiffening. Those are
not measured properties. The sheet does not model table/floor flexibility or
the full stack's lateral/rocking modes.

The paver adds an inertia stage. It can improve higher-frequency force isolation
while adding a lower-frequency resonance and worsening some bands. Decibel
values in the plot are transmitted-force ratios, not microphone sound reduction.
Do not add stage attenuation numbers together; the solved stack includes the
coupling. If using balls without the P02 cradles above the paver, rerun `chain`
with `with_upper_tpu=False`; the published reference curves include P02.

## One-foot check before a full set

1. Measure actual total mass and, if possible, the heaviest corner load. The
   reference corner is about 7.32 kg; the design corner is 11.375 kg equivalent.
2. Load one foot through a flat, rigid plate covering its bearing face, with a
   stable centered weight. Record pad displacement and both vertical gaps.
3. Repeat after 1 minute, 1 hour and 24 hours at service temperature. Retain at
   least 3 mm actual vertical gap at both the center stop and paver-to-ring
   interface after settling; check side clearance and tilt too. This is a
   prototype acceptance target, not a lifetime qualification.
4. On the full stack, verify that all four feet carry load, the paver clears all
   frames, and the existing printer feet have adequate paver support. Check
   rocking, shelf contact, cable tension, rim shifting and print quality.
5. Compare shelf vibration spectra with identical printer motion and sensor
   mounting before and after adding the lower stage. Recheck gaps periodically.

## Reproduce and edit

Install requirements.txt in a Python virtual environment, then run:

```sh
python analyze.py --optimize
python analyze.py
python build.py
```

`--optimize` reports a selected candidate but does not change design.py. The
actual exported geometry is controlled by design.py. If changing dimensions,
regenerate both CAD and analysis; verify the clearance constraints again.
The calculations check agreement of independent 3D/vertical beam solvers,
mesh refinement, positive stiffness and unit static force transmission.
CAD checks valid single solids, connected watertight meshes, bed alignment,
no unintended unloaded part intersection and no collision with the slab.

## Sources

- [Lowe's reference square paver, 36 lb](https://www.lowes.com/pd/Square-16-in-L-x-16-in-W-x-2-in-H-Concrete-Patio-Stone/3036362)
- [Bambu P1S reference mass](https://store.bblcdn.com/63ec128d3b8f4f32b7d60fe4dd112ed3.pdf)
- [Bambu TPU 95A HF reference moduli](https://store.bblcdn.com/s6/default/a6ca55f14aa54ddb92679d06df4700ae/Bambu_TPU_95A_HF_Technical_Data_Sheet.pdf)
- [Upper P02 foot and its assumptions](https://thereprocase.github.io/p1s-feet/)
