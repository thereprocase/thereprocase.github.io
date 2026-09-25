# C04 — one-piece TPU compression spring for a P1S paver

**Result:** A 140 mm diameter × 86 mm high, one-piece corrugated annular spring. Four identical prints fit under the reference 399 mm square paver with their centers 80 mm inward from each edge (about 10 mm perimeter setback). This replaces the four C01/C02 short-arm feet with no metal spring, bolt, rigid tie or load-carrying TPU root joint. Each is about 186 g for 1.22 g/cm³ TPU, about 0.74 kg for four.

## Conditional tensile safety factor

The design load on one foot is `35 kg × 9.80665 m/s² / 4 × 1.30 uneven-load factor × 1.20 peak factor = 133.86 N`. The final 3D linear-elastic tetrahedral model includes 2 mm pressure eccentricity in both X and Y. E = 9.8 MPa is a placeholder effective TPU modulus; Poisson ratios 0.45 and 0.49 bracket two assumed compressibility cases. The peak **positive maximum principal tensile stress** is used for the rupture screen.

| Final FEA case | Peak tension | Mean top travel | FoS for a measured 10 MPa weakest-direction printed tensile strength |
| --- | ---: | ---: | ---: |
| ν = 0.45, 136,986 tets | 1.311 MPa | 8.78 mm | 7.63 |
| ν = 0.49, 136,986 tets | **1.741 MPa** | 6.43 mm | **5.74** |

A factor of safety of four requires **at least 6.97 MPa actual tensile strength in the weakest relevant print direction**, using the 1.741 MPa model peak. For a useful model/print margin, specify **≥10 MPa measured printed coupon strength**; this gives a calculated 5.74 before model uncertainty, or 4.59 if peak stress is 25% higher than the model. If the actual weakest-direction coupon fails below 10 MPa, this design is not accepted under the stated design criterion.

Polymaker reports 26.6 ± 0.6 MPa X–Y tensile strength for PolyFlex TPU95-HF, but says the data are for reference, not a design specification, and does not give a Z-direction design strength. **Do not substitute that published X–Y value for a printed vertical coupon.** Source: https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/tpu/polyflex-tm-tpu95-hf

## Geometry and print

- A 4.5 mm thick, smoothly curved annular wall makes three large radial folds. The lower ring is 54–70 mm radius, z = 0–6 mm; the upper bearing ring is 23–37 mm radius, z = 80–86 mm. The paver bridges the open 46 mm central bore.
- The print grows upright from the 140 mm diameter bottom ring. No roof or bridge is needed. The steepest outward section is **61.1° from vertical**, about 0.22 mm of lateral change for a 0.12 mm layer. With a 0.5 mm bead, projected overlap is ~0.28 mm. This is a geometry check, not slicer validation; print a short annular section first and inspect outer-wall bonding and curl. Use slow TPU settings, adequate cooling, a dry spool, 100% infill, and **0.12 mm layers on the outward folds**. The 4.5 mm wall needs a slicer preview to confirm complete wall fill rather than a weak internal gap.
- The top and bottom annuli are open. The top face must bear fully on sound concrete; the bottom ring must lie flat on the shelf. Do not let the paver, printer or cables bridge directly to the shelf.

## FEA method and its limits

The source STL is tetrahedralized with TetGen; scikit-fem first-order 3D elements model isotropic linear elasticity. The bottom annular face is fixed; a downward face traction on the top annulus totals 133.86 N and has a 2 mm X/Y offset. Vertical reactions balance the force. The CAD solid is watertight and one connected printable part. A medium 71,033-element mesh of the same 4.5 mm geometry gave a 1.619 MPa centered peak at ν=.49; the 136,986-element mesh gave 1.729 MPa centered and 1.741 MPa eccentric. The centered peak changed 6.8% on this refinement. The maximum peak strain at the design load is about 6% in the ν=.49 final case and about 12% in the ν=.45 case. This is a **linear stress screen**, not nonlinear hyperelastic, creep, fatigue, tear, buckling or contact certification. First-order elements can volumetrically lock near ν=.5, so real load-deflection must be measured.

Approximate static spring rate from FEA is 15.2–20.8 N/mm per foot at the 133.86 N force. At the reference 71.78 N per foot, linearly scaled sag is ~3.45–4.71 mm. Ideal single-stage vertical natural frequency is therefore ~7.3–8.5 Hz, not a measured coupled resonance. TPU damping may tame amplification, but the paver, squash-ball stage and shelf must be measured together. Four 86 mm tall supports can rock; the test must include printer motion and lateral motion.

The worst-case factor of safety here is for **static tensile rupture of the printed TPU wall** under the specified axial/eccentric force and **only if coupon strength is at least 10 MPa**. It does not certify tear at a print flaw, cycle life, creep, stability, paver breakage, or a crash beyond the 20% peak allowance.

## Minimum prototype gate

1. Print a 20–30 mm tall curved-wall segment at the same orientation/settings; inspect every outward fold. Print tensile coupons in both XY and Z with the same filament, settings and conditioning. The lowest measured rupture strength must be ≥10 MPa for this conditional screen.
2. Print **one full foot**, load through a rigid plate to ~7.3 kg and then 13.65 kg (133.86 N). Measure deflection, drift after 1 min/1 h/24 h, rocking and any wall-to-wall contact. The model predicts 6.4–8.8 mm at 13.65 kg; a large discrepancy requires recalculation, not extrapolation.
3. If it passes, print the other three. Check paver load sharing on a level shelf and repeat the same printer move before/after. Watch shelf vibration near 5–20 Hz and any new rocking mode. Retest after warm-up and sustained loading.

## Reproduction

From this folder: `python build.py`, then `OPENBLAS_NUM_THREADS=1 python fea.py --volume 8 --nu .49 --force 133.8607725 --eccentric 2`. Dependencies: `cadquery`, `trimesh`, `tetgen`, `scikit-fem`, `numpy`, `scipy`, `matplotlib`. The STL/STEP and final FEA JSON/NPZ are included. `quality=False` is deliberately used for the reported TetGen mesh; further high-order or mixed near-incompressible analysis would improve confidence. All dimensions are millimetres.
