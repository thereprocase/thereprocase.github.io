# Paver foot design iterations (C02–C05)

The [public C01 project](/public/paver-feet/README.md) is the original corner-foot design. These files preserve the follow-on exploration and the limits of each calculation. The current live page and its C01 downloads are unchanged. None of the subsequent concepts has been load tested or accepted as a finished printer support.

| Revision | Idea | State |
| --- | --- | --- |
| [C02](c02/README.md) | Longer, wider curved TPU arms | Root strain remains problematic; FEA rejected the claim that the roots were fixed. |
| [C03](c03/README.md) | Metal compression spring with printed seats | Superseded when the requirement became TPU only. |
| [C04](c04/README.md) | One-piece folded annular TPU compression spring, Ø140 × 86 mm | Linear solid FEA tensile screen under 133.86 N/foot. Conditional FoS ≥4 needs at least 6.97 MPa measured weakest-direction print strength. No buckling, creep, or lateral validation. |
| [C05](c05/README.md) | Ten-petal vase-mode single wall, Ø125 × 50 mm, 1 mm wall | Printable CAD prototype only. No FoS or stiffness result; the thin wall needs lateral/rocking and nonlinear buckling checks before use. |

## Force path and next engineering step

A CoreXY toolhead accelerates horizontally. Its reaction force enters the printer frame, produces shear at the supports, and creates a rocking moment because the force acts above the support plane. The paver/foot system thus needs a **coupled X/Y translation, vertical compression, and pitch/roll** check. C01's chain model is only vertical. C04's tetrahedral model applies a vertical top traction with an eccentricity; it does not apply an independent lateral force or solve dynamic rocking. C05 was built as a geometric and manufacturing experiment, without new FEA.

Before selecting a replacement, measure paver/shelf accelerations in X, Y, and Z during the same printer move and measure a single foot's axial and transverse force–displacement curves at its operating preload. Next calibrate a large-deformation hyperelastic/viscoelastic shell or solid model against those curves, with initial wall imperfections, friction/contact, and a paver rocking mode. Check print-direction tensile coupons and sustained-load creep. The target FoS of 4 is **unproven** for SUNLU TPU and specifically unproven for C05.

## Reproduction

Each revision has its own README and build/analysis scripts. C04 and C05 `build.py` regenerate their STL/STEP models; C05 also regenerates the helical centerline CSV, which is not printer G-code. The binary models and previews are in the separately supplied prototype archives, and are omitted from this source branch. C04 FEA results are checked in as small JSON summaries; full simulation field archives and older intermediate outputs are omitted. Run from a revision folder with the dependencies described in its README.
