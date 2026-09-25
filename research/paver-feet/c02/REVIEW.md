# IMPORTANT: 3D SOLID FEA SUPERSEDES BEAM CLEARANCE SCREEN

The prior C02 beam-screen pass is **not valid evidence of clearance**. A subsequent 3D solid linear FEA estimates 3.405 mm nominal pad sag versus 2.35 mm from the beam model, with severe root strain that invalidates linear failure predictions. See `FEA-REPORT.md` in the updated bundle. Do not print four feet on the strength of the earlier beam result.

# C02 concept: room for flexure, room for travel

This is a **printable geometry candidate**, not a validated strength design. Source is the C01 bundle published at https://thereprocase.github.io/paver-feet/ on 24 September 2026.

## C01 wasted space and root concern

- C01 puts the moving pad edge at radius 24 mm and the ring inner edge at 33.5 mm: just 9.5 mm of radial room for four 7.2 × 8.8 mm short arms. The nominal arm path is about 11.5 mm long.
- The 76.2 mm square base leaves room to expand beneath the approximately 399 mm paver. It is a frame with broad unsupported corner regions that do not contribute to arm length; the top pad and ring dictate the short span.
- The straight-ish arm-to-pad and arm-to-ring transitions are the critical local strain sites. The beam model reports *nominal* bending strain and omits root concentration, layer bonding, nonlinear TPU, and dynamic contact.
- The generous center and outer-ring clearances are not interchangeable: a soft variant within the same 38 mm envelope consumes the paver-to-ring gap first.

## C02 geometry

| Dimension | C01 | C02 concept |
| --- | ---: | ---: |
| Footprint | 76.2 mm square | 98 mm square |
| Height below stone | 38 mm | 45 mm |
| Arm centerline radial reach | 24 → 33.5 mm | 24 → 40 mm |
| Arm centerline arc | 12° | 20° |
| Nominal arm section | 7.2 × 8.8 mm | 12 × 10 mm |
| Root treatment | abrupt polygon union | 16 mm local flare, smooth width taper (nominal beam model omits flare) |
| Four-arm modeled vertical rate | 39.59 N/mm | 30.49 N/mm |
| Nominal sag at reference total mass | 1.81 mm | 2.35 mm |
| Two nominal coupled modes | 7.16, 17.53 Hz | 6.89, 15.98 Hz |
| Worst-case modeled stop/ring clearance | 3.23 / 3.19 mm | 3.76 / 3.15 mm |
| Printed mass estimate per foot | 109 g | 194 g |

C02's 5 MPa, 35 kg, 1.3× corner load, 2 mm eccentricity, 1.5× displacement screen barely clears the 3 mm ring target. The root flare will raise the real stiffness and may shift the mode. The 5 MPa case is a hypothetical property, not proof of suitability for a specific TPU.

## Ideas to test

1. **C02 long curved arms**: print one full assembly; verify actual load-deflection and root strain/damage at 7.3 and 11.4 kg. The larger foot fits inside a ~399 mm slab when placed appropriately. Check all four contact patches and collision with the shelf.
2. **C02S same-height variant**: 98 mm plan, 40 mm ring radius, 12 × 10 mm arms, 12° sweep, 38 mm height. Nominal stiffness ~39.8 N/mm, so this spends the additional area primarily on a wider section and root relief rather than softness. It does *not* yet pass the 3 mm ring-clearance screen with the altered rim height; redesign the seating ring before printing.
3. **Separate shear/compression cartridge**: a hard printed cup with appropriately loaded Sorbothane inserts, chosen by manufacturer load calculator. The softer material can damp a measured resonance, but its dynamic stiffness and creep must be verified at 16 lb per corner. A large unconstrained pad is likely too stiff.

## Analysis limits

The provided solver treats each C02 arm as a constant 12 × 10 mm Timoshenko beam, **without root flare**. For equal nominal 18 N arm load, it estimates peak bending strain ~0.081 versus ~0.100 for C01. These are large strains and neither number is a credible fatigue or tear prediction. The flare, curved geometry and print direction need nonlinear solid analysis and physical cycling. The coupled model has a fixed shelf and assumed ball/TPU dynamic properties; it predicts relative shelf force, not audible sound. If the troubling band is under ~7 Hz, C02 only shifts the modeled mode slightly and could make amplification worse at a different frequency.

Print one C02 pair with the documented flat orientation and settings. Load it through a flat rigid plate; record both gaps after 1 minute, 1 hour and 24 hours; then cycle at the measured problem frequency. Reject if either gap settles below 3 mm, the foot rocks, a root whitens/tears, or layer separation develops.
