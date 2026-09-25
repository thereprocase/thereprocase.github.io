# C03: spring-supported paver foot, static tensile rupture FoS ≥ 4 design screen

C03 replaces C01/C02's highly strained printed TPU arms with a specified **ASTM A228 music-wire compression spring**. Printed PETG seats transmit axial load mostly in compression; a printed central post limits spring travel. The parametric CadQuery source, STL and STEP seat files, reference assembly STEP, preview and numerical screens are included.

## Specification for **four** springs

Order a professionally wound, **closed and ground** compression spring, **not** a printed spring:

- ASTM A228 music wire with certified minimum ultimate tensile strength **1,650 MPa at 5.0 mm wire diameter** (ASTM A228/A228M-18 Table 1). ASTM wire certification alone does not certify the finished spring.
- Wire diameter **5.00 ± 0.05 mm**; mean coil diameter **50.0 ± 0.5 mm** (nominal OD 55 mm); **five active coils**, nominal seven total including inactive ends; free length **58.0 ± 0.5 mm**; rate **9.91 N/mm ± 10%**; solid height **≤35.35 mm**.
- Verify each spring's rate and load at 13.5 mm compression, and the ends' planarity/ground seating. Reject sharp surface defects, permanent set at the design load and springs that violate the dimensions. Seek manufacturer fatigue and end-turn verification for cyclic use.

The supplied STEP helix is for layout only. It does not define actual end-coil geometry or replace a manufacturer's drawing. The two printed caps alone do not make a working isolator; obtain and measure the spring before using them.

## Tensile rupture screen

For a round-wire helical compression spring, the spring rate is `G d^4/(8 D^3 n)` with G = 79,300 MPa; maximum corrected wire shear is `K_w 8 F D/(π d^3)` with Wahl factor `K_w = (4C-1)/(4C-4)+0.615/C`, C = D/d = 10. For a conservative static tensile-rupture comparison, use `σ_equiv = sqrt(3) τ` and `FoS = S_ut,min/σ_equiv`. This is a helical-wire analytical stress screen, **not a nonlinear 3D spring FEA**, nor a yield/fatigue/end-turn safety factor.

| Load per foot | Force | Spring deflection | Static tensile-rupture FoS |
| --- | ---: | ---: | ---: |
| Reference 29.28 kg stack / four | 71.78 N | 7.24 mm | 11.38 |
| 35 kg stack × 1.3 corner multiplier | 111.55 N | 11.25 mm | 7.32 |
| Above plus 20% peak allowance | 133.86 N | 13.50 mm | 6.10 |
| Center stop first touches, nominal | 165 N | 16.65 mm | 4.95 |
| Stop tolerance: +10% rate and +1 mm stop travel | 192.4 N | actual constrained travel | **4.25** |
| Above plus worst specified diameter 4.95 mm and mean D 50.5 mm | 192.4 N | bounded | **4.09** |

The stop does not cap total external force; once it touches, further force bypasses the spring through the printed post. It does limit further spring compression under ideal axial alignment. Stop clearance at the 133.86 N peak is **3.14 mm**; the spring has 9.50 mm until estimated solid height at that load, and 6.35 mm at nominal stop engagement.

**Important scope:** This is a calculated factor of safety against **static wire tensile rupture** conditional on the specified and certified spring, nominal axial loading, and listed dimensional tolerances. It is not a guarantee of 4 against yielding, fatigue, end-coil failure, buckling, printed-seat fracture under lateral load, or an unknown purchased spring. A certified spring, load test, and cyclic evaluation are required for an actual assembly rating.

## Printed seat FEA and layout

- Two printed pieces per foot: lower Ø70 mm round plate with spring locator and compression stop; upper 76 mm square flat paver plate with spring locator. Each plate is 6 mm thick. Free height **70 mm**, before compression. Four feet cost about 0.41 kg of PETG for the seats (assuming 1.24 g/cm³), plus the steel springs.
- 3D linear tetrahedral FEA at **133.86 N**, isotropic PETG E=1,800 MPa, ν=.38, uniform axial pressure on the paver patch, spring-end contact on the 22–29 mm radial seat, and full bottom-shelf contact. The finer mesh has 57,312 upper and 37,141 lower tetrahedra. Maximum positive principal tensile stress is **0.904 MPa upper** and **0.377 MPa lower**; a provisional 20 MPa minimum printed tensile strength gives FoS >22 for these axial cases. At 192.4 N by linear scaling, upper stress ~1.30 MPa; a measured minimum printed tensile strength >5.2 MPa would meet FoS 4 in this idealized case.
- The seat FEA has no layer anisotropy, uneven shelf contact, eccentric slab force, guide collision or impact at the stop. Test fit all four feet and maintain lateral guide clearance. Do not fasten the upper and lower caps together with a rigid screw: it would bypass the spring.

## Isolation tradeoff

Ideal vertical natural frequency from the spring rate and supported mass is about **5.86 Hz** at the reference load, ignoring paver/printer coupled modes and spring dynamic response. Steel springs provide little intrinsic damping; the assembly may ring strongly around resonance. The earlier TPU arm spring had calculated solid-model rates of about 25 and 21 N/mm per foot (C01/C02). This C03 spring is ~9.91 N/mm per foot, but sound reduction cannot be inferred directly from rate alone. Measure shelf vibration and print quality. A separately tuned damper may be needed without creating a stiff bypass.

## Build and proof

1. Print one lower and one upper PETG seat, with each broad face on the build plate, at 100% infill and at least four perimeters. Verify the open gaps around the spring and both guide rings. The supplied STLs are for the printed seats only.
2. Obtain a spring to the specification above, or update `design.py` and rerun `spring_calc.py`, `build.py` and the seat FEA for a verified catalog spring.
3. Compress one assembly through a centered flat plate. Check force at 7.24, 11.25 and 13.50 mm travel and verify >3 mm clear stop gap at the 133.86 N peak. Never put hands between unrestrained parts during proof testing.
4. On the full paver, check four-foot load share, lateral stability, no top/bottom contact, cable bypass, resonance, and printer motion. Treat any rocking or spring rubbing on the printed locators as a failed fit.

## Primary sources

- ASTM A228/A228M-18 music spring wire Table 1 (5.0 mm minimum tensile strength 1,650 MPa): https://malinco.com/wp-content/uploads/A228A228Mqziz4630.pdf
- The preceding C01 and C02 CAD and FEA are in the earlier bundles; this is a different architecture.
