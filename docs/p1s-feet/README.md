# P1S squash-ball foot — P01

Two-piece, gravity-assembled TPU prototype. Units: mm, N, MPa.

## Provisional inputs

- 40 mm ball; four feet; 12.95 kg bare printer.
- 20 kg is an illustrative total supported mass, not Bambu's packaged weight.
- Reference modulus 9.8 MPa, Poisson ratio 0.49; 7.4, 15 and 26 MPa sensitivities.
- Ball diameter, actual filament, AMS/spools, upper-holder clearance, and actual
  corner loads still need confirmation. These are printable prototypes, not a
  physically qualified isolation system.

## Geometry and assembly

80 mm maximum diameter. TPU assembly height 29.333 mm, unloaded. Cradle depth
13.333 mm, covering the lower third of the nominal ball's diameter. Ball bottom
is 16 mm above the table before deflection; the complete assembly including the
ball reaches 56 mm. The 29.333 mm dimension refers only to the TPU foot.

Base: annular pedestal, 14 mm seat height, 3 mm locating wall, three 2 mm-high
floor spokes and a central catch stop at z=5 mm. Cradle: spherical bowl, outer
seating ring, and six curved ribs in three diametrically matched pairs. The ribs
are 4 mm wide by 10 mm deep and have approximately 16.1, 18.7 and 21.8 mm free
centerline lengths. Their different stiffnesses do not establish independently
tuned resonances.

Drop the cradle ring into the base socket, then seat the ball in its cup. The
socket has 0.25 mm radial clearance and relies on gravity, not a positive lock.
Unloaded cup-to-stop clearance is 9 mm. The stop is disengaged in ordinary use.
Check upper ball-holder clearance under load. The bowl does not capture the ball
above its equator. Lift by the base; do not assume the pieces stay attached.

## Print

Print base.stl and cradle.stl exactly as exported, flat sides on the bed. Both
have z-min=0 and grow upward without free-floating islands, internal bridging or
support. Suggested starting geometry settings: 0.4 mm nozzle, 0.2 mm layer,
100% infill, at least four perimeters. Confirm fully filled ribs and connected
roots in your slicer. Use the filament manufacturer's temperature, drying and
speed settings. No slicer/toolpath or physical print validation is claimed.

Print one pair first; four pairs serve the printer. Estimated solid material
is about 58 g per pair at 1.22 g/cm³, before any brim or purge waste.

## Deflection estimate

See analysis.json for the reproducible numerical results. Each rib is represented
by 40 curved-frame segments with vertical displacement, bending rotation and
torsion. Timoshenko transverse shear and rectangular Saint-Venant torsion are
included. Cup and outer ring are rigid; their boundaries clamp both rotations.
Six stiffnesses sum for the centered vertical translation, because the opposite
pairs cancel net tipping moments in that load case.

At E=9.8 MPa: k ≈ 14.20 N/mm per foot. A 12.95 kg printer puts 31.75 N on each
equally loaded foot, giving 2.24 mm initial sag and 6.76 mm stop clearance. At
20 kg: 49.03 N, 3.45 mm sag, 5.55 mm clearance. At 20 kg, E=7.4 MPa and a corner
carrying 30% extra: 63.74 N, 5.95 mm sag and 3.05 mm remaining clearance.

The corresponding foot-only undamped vertical frequency is about 10.5 Hz for
the bare printer, or 8.5 Hz at 20 kg. Squash balls add series compliance and
their own damping; the whole assembly's modes cannot be determined without
their loaded stiffness. There is no claimed measured attenuation or frequency
response. A softer suspension may introduce rocking.

This is a sizing estimate, NOT nonlinear solid FEA. It neglects hyperelasticity,
creep, temperature, printed anisotropy, root stress concentrations, local cup and
base deflection, contact, and horizontal/rocking modes. Nominal bending strain in
the output excludes torsional strain and local concentrations and is not a
strength acceptance result. Large-deflection cases are linear extrapolations;
negative stop clearance means this model has ceased to apply. No safety factor
or fatigue life is established from tensile strength.

The solver verifies a straight fixed-guided beam against its analytical
Timoshenko solution, checks force equilibrium, and compares 40/80 segments per
rib. CAD exports are checked for valid single solids, nonintersecting unloaded
parts, positive-volume connected watertight meshes and bed-plane alignment.
The tiny degenerate triangles produced by OCCT at the spherical pole are removed
before STL export; this does not change the designed geometry.

## Calibration

Load one foot through the real ball, using 3.2375 kg for the bare-printer equal
corner case or the actual heaviest corner load. Measure the cup underside height
unloaded and after 1 minute, 1 hour and 24 hours under load at intended service
temperature. Sag is the difference. Keep at least 3 mm stop clearance after
settling as an initial design target, not a validated lifetime guarantee. Check
sideways tilt, joint seating and cracks. Calculate k_measured=force/sag; use that
to revise the ribs before printing all four. Check printer rocking and table
vibration before/after under the same printing conditions.

## Reproduce/edit

Python 3.14 was used with cadquery 2.8.0, trimesh 5.1.0 and numpy 2.5.3.
Install the supplied requirements.txt in a virtual environment, then run:

```sh
python analyze.py
python build.py
```

Edit design.py for parameters. Changing only one dimension without regenerating
and checking all outputs invalidates the saved calculation. Ball size changes
also require resizing the cup exterior, rim, base and rib spans; BALL_D alone is
not a complete proportional-scale control. STEP files expose individual solid
geometry for CAD editing; the CadQuery source is the editable construction model.

## Sources

- [Bambu P1S net mass](https://store.bblcdn.com/63ec128d3b8f4f32b7d60fe4dd112ed3.pdf)
- [Bambu TPU 95A HF moduli](https://store.bblcdn.com/s6/default/a6ca55f14aa54ddb92679d06df4700ae/Bambu_TPU_95A_HF_Technical_Data_Sheet.pdf)
- [NinjaTek Cheetah 95A modulus](https://ninjatek.com/wp-content/uploads/Cheetah-TDS.pdf)

Manufacturer values are reference inputs, not measurements of this print. 7.4–26
MPa is a sensitivity range, not a material guarantee.
