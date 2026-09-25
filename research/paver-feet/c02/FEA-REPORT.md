# Paver foot C01 versus C02: 3D solid FEA screening

**Result:** C02 is about 16% softer at the reference load in this linear model, and its inner-root strain is lower, but **neither C01 nor C02 is validated for TPU service**. The predicted root strains are far outside the small-strain assumptions. The existing C01/C02 beam clearance predictions are optimistic. C02 needs a true three-dimensional blend into the central pad and a nonlinear material/contact analysis followed by a printed load test.

## Model and boundary conditions

- Mesh: tetrahedra made from the published C01 STL and the C02 concept STL, using TetGen; 3D first-order displacement elements in scikit-fem.
- Material: isotropic linear elastic, E = 9.8 MPa; Poisson ratio 0.45. Sensitivity also run at 0.49. No measured TPU properties, viscoelasticity, hysteresis, large-deformation constitutive law, fatigue, or FDM layer interfaces.
- Fixture: only the bottom face of the **outer floating ring** is fixed in X, Y and Z. The central pad and all arms remain free. The separate shelf-side base is represented as a rigid ring seat. This excludes ring/base compliance and socket fit.
- Load: uniform downward traction on all 1,656 mm² of the top bearing face, resultant 71.78 N on one foot (reference stack total divided by four). The concrete is modeled as a uniform pressure, not as a separate bending slab. Eccentric corner load and paver rocking are not included in the solid run.
- Element stresses are constant within each linear tetrahedron. Local sharp-corner maxima are mesh-sensitive; the 99th percentile over the inner-root region is a comparative screening measure, not a failure criterion.

## Corrected results (E 9.8 MPa, nu 0.45, ~2 mm³ maximum tetra volume)

| Metric per foot | C01 | C02 |
| --- | ---: | ---: |
| Tetrahedra | 246,168 | 140,559 |
| Mean pad displacement at 71.78 N | 2.856 mm | 3.405 mm |
| Effective secant rate for this *linear* run | 25.14 N/mm | 21.08 N/mm |
| Inner-root 99th-percentile maximum principal strain | 50.0% | 28.2% |
| Outer-root 99th-percentile maximum principal strain | 26.2% | 14.3% |
| Inner-root element maximum principal strain | 306% | 112% |

These calculated strains are **not physical predictions of TPU strain** at service load. Linear elasticity and the small-strain tensor are invalid at these values. The high-strain spots occur at the upper edge where each arm enters the central pad (near z = 8.8 mm for C01, 10 mm for C02), including the sharp vertical change in height. C02's top-view flare reduces the comparative inner-root 99th percentile by about 44%, but does not smooth the 3D height transition. Maxima at sharp CAD corners should not be used to assert a safety factor.

## Numerical sensitivity

| Case | C01 displacement / inner-root p99 strain | C02 displacement / inner-root p99 strain |
| --- | ---: | ---: |
| ~20 mm³ maximum tet volume, nu 0.45 | 2.740 mm / 50.3% | 3.192 mm / 26.5% |
| ~2 mm³ maximum tet volume, nu 0.45 | 2.856 mm / 50.0% | 3.405 mm / 28.2% |
| ~20 mm³ maximum tet volume, nu 0.49 | 2.214 mm / 40.6% | 2.464 mm / 21.8% |

The pad displacement changes 4.2% for C01 and 6.7% for C02 on refinement; the C02 root percentile changes 6.5%. This is a useful comparison, not full convergence. First-order displacement tets can volumetrically lock near nu = 0.5; the nu = 0.49 results are therefore a sensitivity check, not a reliable nearly incompressible solution. Sum of vertical reactions equals the applied load to solver precision in every case.

## Engineering consequence

The old beam models give ~39.59 and 30.49 N/mm per foot for C01 and C02. The corresponding solid results are ~25.14 and 21.08 N/mm. Using those linear rates only as a provisional clearance screen, the worst assumed corner load (111.55 N), E = 5 MPa, and the original 1.5x displacement drift imply ~13.1 mm movement for C01 and ~15.6 mm for C02 before tilt/fit allowance. Against the original unloaded paver-to-ring gaps of 14.2 and 17.0 mm, subtracting the 0.8 mm allowance leaves about **0.3 mm C01 / 0.6 mm C02**, below the 3 mm target. This is an extrapolation beyond linear validity, so it is a warning to test, not a measured clearance.

A root fillet **in three dimensions**, or an arm that rises gradually into the pad rather than meeting its vertical wall at a hard 90° edge, is the next geometry step. Fillet both inner and outer roots, maintain printability, then test an isolated arm/pad specimen and a whole foot under load. The fundamental low-frequency goal also demands more static travel: an ideal spring with 3.4 mm static deflection has about 8.5 Hz natural frequency in isolation; damping, coupled masses, and dynamic TPU stiffness change this. A 5 Hz ideal target would require roughly 10 mm static deflection and a much larger clearance envelope.

## Reproduce

`python -m pip install -r requirements-fea.txt`

`OPENBLAS_NUM_THREADS=1 python fea/run.py c01 --volume 2 --nu .45`

`OPENBLAS_NUM_THREADS=1 python fea/run.py c02 --volume 2 --nu .45`

Run from the folder containing `paver-feet-c01`, `paver-feet-c02`, and `fea`. `maxvolume` sets a tetrahedral volume cap; the source triangulation also constrains the mesh. The script exports JSON and NPZ containing nodes, tetrahedral connectivity, nodal displacement and per-element strain/stress fields.
